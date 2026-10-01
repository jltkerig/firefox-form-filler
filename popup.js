const enable = document.getElementById('enable');
const disable = document.getElementById('disable');
const status = document.getElementById('status');
let tab, pattern, id;

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
      id, matches: [pattern], js: ['autofill.js'], runAt: 'document_idle', persistAcrossSessions: true
    }]);
    await browser.scripting.executeScript({target: {tabId: tab.id}, files: ['autofill.js']});
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
