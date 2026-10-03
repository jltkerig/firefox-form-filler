const enable = document.getElementById('enable');
const disable = document.getElementById('disable');
const saveExample = document.getElementById('save-example');
const status = document.getElementById('status');
document.getElementById('version').textContent = `Version ${browser.runtime.getManifest().version}`;
let tab, pattern, id;
const contentScripts = ['defaults.js', 'autofill.js'];
const themeSelect=document.getElementById('theme');
browser.storage.local.get('settings').then(saved=>{themeSelect.value=FFF_THEME.apply(saved.settings?.theme);});
themeSelect.addEventListener('change',async()=>{const theme=FFF_THEME.apply(themeSelect.value),saved=await browser.storage.local.get('settings');await browser.storage.local.set({settings:{...saved.settings,theme}});});

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
  disable.disabled = !pattern || (!entries.some(e => e.matches.includes(pattern)) &&
    !(await browser.permissions.contains({origins: [pattern]})));
}
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
  status.textContent = disable.disabled ? 'Not on the whitelist.' : 'This website has a whitelist entry or site access.';
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
    await browser.permissions.remove({origins: [pattern]});
    status.textContent = 'Removed from the whitelist. The button will no longer load here.';
  } catch (error) { status.textContent = `Could not remove this website: ${error.message}`; }
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
    const blob = new Blob([JSON.stringify(result.result, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const safeHostname = result.result.hostname.replace(/[^a-z0-9.-]+/gi, '-').slice(0, 80) || 'page';
    try {
      await browser.downloads.download({
        url,
        filename: `page-for-fixing-${safeHostname}-${new Date().toISOString().slice(0, 10)}.private.json`,
        saveAs: true,
        conflictAction: 'uniquify'
      });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 60000); }
    status.textContent = `Saved a private fixing report with ${result.result.fields.length} fields. Review it before sharing.`;
  } catch (error) {
    status.textContent = `Could not save this page: ${error.message}`;
  } finally { saveExample.disabled = false; }
});
