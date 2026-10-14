const enable = document.getElementById('enable');
const disable = document.getElementById('disable');
const saveExample = document.getElementById('save-example');
const fillNow = document.getElementById('fill-now');
const startHere = document.getElementById('start-here');
const saveToProfile = document.getElementById('save-to-profile');
const floating = document.getElementById('floating-whitelist');
const status = document.getElementById('status');
document.getElementById('version').textContent = `Version ${browser.runtime.getManifest().version}`;
let tab, pattern, id;
const contentScripts = ['defaults.js', 'autofill.js'];
const themeSelect=document.getElementById('theme');
browser.storage.local.get('settings').then(saved=>{themeSelect.value=FFF_THEME.apply(saved.settings?.theme);});
themeSelect.addEventListener('change',async()=>{const theme=FFF_THEME.apply(themeSelect.value),saved=await browser.storage.local.get('settings');await browser.storage.local.set({settings:{...saved.settings,theme}});});

// The sites whitelisted so far, kept so an extension update can bring them back (background.js restores them).
async function rememberSite(host, add) {
  const saved = (await browser.storage.local.get('whitelistedSites')).whitelistedSites;
  const sites = new Set(Array.isArray(saved) ? saved : []);
  if (add) sites.add(host); else sites.delete(host);
  await browser.storage.local.set({whitelistedSites: [...sites].sort()});
}

async function refreshList() {
  const entries = (await browser.scripting.getRegisteredContentScripts()).filter(e => e.id.startsWith('jamie-'));
  const list = document.getElementById('whitelist');
  list.replaceChildren();
  const sites = [...new Set(entries.flatMap(e => e.matches))].sort();
  for (const site of sites.length ? sites : ['No websites added yet.']) {
    const item = document.createElement('li');
    item.textContent = site.replace(/^https:\/\//, '').replace(/\/\*$/, '');
    list.appendChild(item);
  }
  return entries;
}
async function updateButtons() {
  const entries = await refreshList();
  enable.disabled = !pattern;
  startHere.disabled = !pattern;
  // Whitelisted = its script is registered, or access was granted for exactly this site (all-websites access, which the
  // floating Whitelist button holds, does not count as having whitelisted every site).
  const granted = pattern ? (await browser.permissions.getAll()).origins?.includes(pattern) : false;
  disable.disabled = !pattern || (!entries.some(e => e.matches.includes(pattern)) && !granted);
  floating.checked = (await browser.scripting.getRegisteredContentScripts({ids: ['jk-launcher']})).length > 0;
  fillNow.disabled = disable.disabled;  // the page can only be filled once the website is whitelisted
  saveToProfile.disabled = disable.disabled;
}
floating.addEventListener('change', async () => {
  const turningOn = floating.checked;
  floating.disabled = true;
  try {
    if (turningOn) {
      const granted = await browser.permissions.request({origins: ['https://*/*']});
      if (!granted) { floating.checked = false; status.textContent = 'Not turned on. Access to all websites was not granted.'; return; }
      const registered = await browser.scripting.getRegisteredContentScripts({ids: ['jk-launcher']});
      if (!registered.length) await browser.scripting.registerContentScripts([{
        id: 'jk-launcher', matches: ['https://*/*'], js: ['launcher.js'], runAt: 'document_idle', persistAcrossSessions: true
      }]);
      status.textContent = 'Floating Whitelist button is on. It shows on pages that have forms.';
    } else {
      await browser.scripting.unregisterContentScripts({ids: ['jk-launcher']}).catch(() => {});
      await browser.permissions.remove({origins: ['https://*/*']}).catch(() => {});
      // A site added by the floating button had no access of its own: take those off the whitelist too.
      const granted = (await browser.permissions.getAll()).origins || [];
      const orphans = (await browser.scripting.getRegisteredContentScripts())
        .filter(e => e.id.startsWith('jamie-') && !e.matches.every(match => granted.includes(match)));
      if (orphans.length) await browser.scripting.unregisterContentScripts({ids: orphans.map(e => e.id)});
      status.textContent = orphans.length
        ? `Floating Whitelist button is off. ${orphans.length} site${orphans.length === 1 ? '' : 's'} added with it need whitelisting again from this menu.`
        : 'Floating Whitelist button is off.';
    }
  } catch (error) {
    floating.checked = !turningOn;
    status.textContent = `Could not change this setting: ${error.message}`;
  } finally { floating.disabled = false; await updateButtons(); }
});
saveToProfile.addEventListener('click', async () => {
  saveToProfile.disabled = true;
  try {
    await browser.tabs.sendMessage(tab.id, {type: 'save-to-profile'});
    window.close();  // the list of answers to save shows on the page
  } catch {
    status.textContent = 'Could not reach the page. Reload it and try again.';
    saveToProfile.disabled = false;
  }
});
fillNow.addEventListener('click', async () => {
  fillNow.disabled = true;
  try {
    await browser.tabs.sendMessage(tab.id, {type: 'fill-now'});
    window.close();  // back to the page, where the result shows
  } catch {
    status.textContent = 'Could not reach the page. Reload it and try again.';
    fillNow.disabled = false;
  }
});
async function initialize() {
  await refreshList();
  [tab] = await browser.tabs.query({active: true, currentWindow: true});
  const url = new URL(tab?.url || 'about:blank');
  if (url.protocol !== 'https:') {
    document.getElementById('site').textContent = 'Open an HTTPS job application first.';
    return;
  }
  pattern = `https://${url.hostname}/*`;
  id = `jamie-${url.hostname}`;
  document.getElementById('site').textContent = url.hostname;
  saveExample.disabled = false;
  await updateButtons();
  // Site access can be given in Firefox's own extensions panel ("Always allow on this site"), which registers no script
  // and so shows no buttons. The popup says the site is enabled in that state, so it finishes the job here.
  let repaired = false;
  const registered = await browser.scripting.getRegisteredContentScripts({ids: [id]});
  if (!registered.length && (await browser.permissions.getAll()).origins?.includes(pattern)) {
    try {
      await browser.scripting.registerContentScripts([{
        id, matches: [pattern], js: contentScripts, runAt: 'document_idle', persistAcrossSessions: true
      }]);
      await browser.scripting.executeScript({target: {tabId: tab.id}, files: contentScripts});
      await rememberSite(url.hostname, true);
      repaired = true;
    } catch (error) { status.textContent = `Could not finish enabling this website: ${error.message}`; return; }
    await updateButtons();
  }
  status.textContent = disable.disabled ? 'Autofill is not enabled for this website.'
    : repaired ? 'Autofill is enabled for this website. The buttons should now be on the page.'
    : 'Autofill is enabled for this website.';
}
enable.addEventListener('click', async () => {
  enable.disabled = disable.disabled = true;
  try {
    const granted = await browser.permissions.request({origins: [pattern]});
    if (!granted) { status.textContent = 'Not added. Site access was not granted.'; return; }
    const registered = await browser.scripting.getRegisteredContentScripts({ids: [id]});
    if (!registered.length) await browser.scripting.registerContentScripts([{
      id, matches: [pattern], js: contentScripts, runAt: 'document_idle', persistAcrossSessions: true
    }]);
    else if (registered[0].js?.join() !== contentScripts.join()) {
      await browser.scripting.updateContentScripts([{id, js: contentScripts}]);
    }
    await browser.scripting.executeScript({target: {tabId: tab.id}, files: contentScripts});
    await rememberSite(new URL(tab.url).hostname, true);
    status.textContent = 'Whitelisted. The floating button will appear on future visits.';
  } catch (error) { status.textContent = `Could not finish whitelisting: ${error.message}`; }
  finally { await updateButtons(); }
});
disable.addEventListener('click', async () => {
  enable.disabled = disable.disabled = true;
  try {
    const entries = await browser.scripting.getRegisteredContentScripts();
    const matches = entries.filter(e => e.id.startsWith('jamie-') && e.matches.includes(pattern));
    for (const entry of matches) {
      const remaining = entry.matches.filter(match => match !== pattern);
      if (remaining.length) await browser.scripting.updateContentScripts([{id: entry.id, matches: remaining}]);
      else await browser.scripting.unregisterContentScripts({ids: [entry.id]});
    }
    const pages = await browser.tabs.query({url: pattern});
    await Promise.allSettled(pages.map(page => browser.scripting.executeScript({
      target: {tabId: page.id}, func: () => globalThis.__jamieJobAutofill?.destroy()
    })));
    await browser.permissions.remove({origins: [pattern]}).catch(() => {});  // none of its own when added by the floating button
    await rememberSite(new URL(tab.url).hostname, false);
    status.textContent = 'Removed from the whitelist. The button will no longer load here.';
  } catch (error) { status.textContent = `Could not remove this website: ${error.message}`; }
  finally { await updateButtons(); }
});
// Starts the extension on this page right now: for a website that is not whitelisted yet, or one where the buttons did
// not show up. The page is the one you have open, so Firefox lets the popup run the script on it. A website that has
// access but no registered script is set up as well, so the buttons come back on later visits too.
startHere.addEventListener('click', async () => {
  startHere.disabled = true;
  try {
    if (!tab?.id || !pattern) throw new Error('Open an HTTPS job application first.');
    const granted = (await browser.permissions.getAll()).origins?.includes(pattern);
    const registered = await browser.scripting.getRegisteredContentScripts({ids: [id]});
    if (granted && !registered.length) {
      await browser.scripting.registerContentScripts([{
        id, matches: [pattern], js: contentScripts, runAt: 'document_idle', persistAcrossSessions: true
      }]);
      await rememberSite(new URL(tab.url).hostname, true);
    }
    await browser.scripting.executeScript({target: {tabId: tab.id}, files: contentScripts});
    status.textContent = granted ? 'Started on this page. The buttons are at the bottom right of the page.'
      : 'Started on this page for now. The buttons are at the bottom right; whitelist this website to keep them on future visits.';
  } catch (error) { status.textContent = `Could not start on this page: ${error.message}`; }
  finally { await updateButtons(); }
});
initialize().catch(error => { status.textContent = error.message; });

document.getElementById('edit-profile').addEventListener('click', () => browser.runtime.openOptionsPage());

// Runs only after the popup button is clicked. It reads form structure, never
// input values, cookies, storage, hidden controls, or complete page HTML.
function captureCurrentForm(includeInline) {
  const redact = text => String(text || '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\+?\d[\s().-]*){10,}\b/g, '[phone]')
    .replace(/\b\d{4,}\b/g, '[number]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\s+/g, ' ').trim().slice(0, 220);
  const labelFor = el => {
    const linked = [...(el.labels || [])].map(label => label.textContent);
    const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/);
    const aria = ids.map(id => document.getElementById(id)?.textContent || '');
    const parent = el.closest('label')?.textContent || '';
    return redact([...linked, ...aria, el.getAttribute('aria-label'), parent]
      .find(part => String(part || '').trim()) || '');
  };
  const fields = [...document.querySelectorAll('input, select, textarea, [role="combobox"], [role="checkbox"], [role="radio"]')]
    .filter(el => !['hidden', 'password'].includes(el.type) && !el.closest('[aria-hidden="true"]'))
    .slice(0, 300).map(el => {
      const group = el.closest('fieldset, [role="group"], [role="radiogroup"]');
      const result = {
        tag: el.tagName.toLowerCase(), type: el.type || el.getAttribute('role') || '',
        label: labelFor(el), group: redact(group?.querySelector('legend')?.textContent || group?.getAttribute('aria-label')),
        name: redact(el.getAttribute('name')), id: redact(el.id),
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        placeholder: redact(el.getAttribute('placeholder')),
        autocomplete: redact(el.getAttribute('autocomplete')),
        inputMode: redact(el.getAttribute('inputmode')),
        pattern: redact(el.getAttribute('pattern')),
        maxLength: el.getAttribute('maxlength') || '',
        dynamicAttributes: [...el.attributes].map(attr => attr.name)
          .filter(name => /^(?:hx-|data-|on)/.test(name)).slice(0, 30)
      };
      if (el.tagName === 'SELECT') result.choices = [...el.options]
        .filter(option => option.value && !option.disabled).slice(0, 50)
        .map(option => redact(option.textContent));
      return result;
    });
  const scripts = [...document.scripts];
  const externalScripts = scripts.filter(script => script.src).slice(0, 100).map(script => {
    try {
      const url = new URL(script.src, location.href);
      return `${url.origin}${url.pathname}`
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
        .replace(/\b\d{4,}\b/g, '[number]').slice(0, 300);
    } catch { return '[unreadable script path]'; }
  });
  let budget = 250000;
  const inlineScripts = scripts.filter(script => !script.src && script.textContent.trim() &&
    (!script.type || /^(?:module|(?:text|application)\/javascript)$/i.test(script.type))).slice(0, 50)
    .map(script => {
      const length = script.textContent.length;
      if (!includeInline) return {length};
      const code = script.textContent.slice(0, Math.min(length, budget));
      budget -= code.length;
      return {length, code, truncated: code.length < length};
    });
  return {format: 'firefox-page-fixing-v1', capturedAt: new Date().toISOString(), hostname: location.hostname,
    note: 'Review before sharing. Form values, hidden fields, cookies, and storage were not captured. Inline JavaScript may contain private data if included.',
    fields, javascript: {externalScripts, inlineScripts, inlineIncluded: !!includeInline}};
}

saveExample.addEventListener('click', async () => {
  saveExample.disabled = true;
  try {
    const granted = await browser.permissions.request({permissions: ['downloads']});
    if (!granted) throw new Error('Firefox needs download permission to show the Save As window.');
    const includeInline = document.getElementById('include-inline-js').checked;
    const [result] = await browser.scripting.executeScript({
      target: {tabId: tab.id}, func: captureCurrentForm, args: [includeInline]
    });
    if (!result?.result) throw new Error('No form data was returned.');
    const safeHostname = result.result.hostname.replace(/[^a-z0-9.-]+/gi, '-').slice(0, 80) || 'page';
    status.textContent = 'Choose where to save in the Save As window…';
    // The background page makes the download: this popup closes the moment the Save As window takes focus, and the
    // file's temporary link would close with it, which made the download fail.
    const reply = await browser.runtime.sendMessage({
      type: 'save-fixing-report',
      filename: `page-for-fixing-${safeHostname}-${new Date().toISOString().slice(0, 10)}.private.json`,
      json: JSON.stringify(result.result, null, 2)
    });
    if (!reply?.ok) throw new Error(reply?.error || 'Firefox could not save the file.');
    status.textContent = `Saved a private fixing report with ${result.result.fields.length} fields. Review it before sharing.`;
  } catch (error) {
    status.textContent = `Could not save this page: ${error.message}`;
  } finally { saveExample.disabled = false; }
});
