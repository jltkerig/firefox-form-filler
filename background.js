browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'can-fill' || !sender.tab || !sender.url) return;
  let url;
  try { url = new URL(sender.url); } catch { respond(false); return; }
  if (url.protocol !== 'https:') { respond(false); return; }
  const pattern = `https://${url.hostname}/*`, auto = fffAutoSiteFor(url.hostname)?.match;
  // Allowed only where this website was whitelisted (its content script is registered), even when the broader
  // all-websites access of the floating Whitelist button is held. Automatic sites (auto-sites.js) count too.
  Promise.all([browser.permissions.contains({origins: [pattern]}), browser.scripting.getRegisteredContentScripts()])
    .then(([granted, entries]) => respond(granted && entries.some(entry => entry.id.startsWith('jamie-') &&
      (entry.matches.includes(pattern) || (auto && entry.matches.includes(auto))))),
      () => respond(false));
  return true;
});

// The floating Whitelist button on a page asks here. It only works while that button is switched on in the menu, which
// is when the extension holds access to all websites; the site is then whitelisted exactly as the menu would do it.
browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'whitelist-this-site' || !sender.tab || sender.id !== browser.runtime.id || sender.frameId !== 0) return;
  let url;
  try { url = new URL(sender.url); } catch { respond({ok: false, error: 'Unreadable address.'}); return; }
  if (url.protocol !== 'https:') { respond({ok: false, error: 'Only HTTPS websites can be whitelisted.'}); return; }
  const pattern = `https://${url.hostname}/*`, id = `jamie-${url.hostname}`, files = ['defaults.js', 'autofill.js'];
  (async () => {
    const launcher = await browser.scripting.getRegisteredContentScripts({ids: ['jk-launcher']});
    if (!launcher.length || !(await browser.permissions.contains({origins: [pattern]}))) throw new Error('The floating button is not switched on.');
    const registered = await browser.scripting.getRegisteredContentScripts({ids: [id]});
    if (!registered.length) await browser.scripting.registerContentScripts([{
      id, matches: [pattern], js: files, runAt: 'document_idle', persistAcrossSessions: true
    }]);
    await browser.scripting.executeScript({target: {tabId: sender.tab.id}, files});
    await rememberWhitelistedSite(url.hostname, true);
  })().then(() => respond({ok: true}), error => respond({ok: false, error: String(error?.message || error)}));
  return true;
});

// "Save page for fixing": the popup hands the report here. The popup closes as soon as the Save As window takes focus,
// and a file link made inside it would close too, so the download is made from this page, which stays open.
browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'save-fixing-report' || sender.tab || sender.id !== browser.runtime.id) return;
  if (typeof message.json !== 'string' || typeof message.filename !== 'string') { respond({ok: false, error: 'Nothing to save.'}); return; }
  const filename = message.filename.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 140) || 'page-for-fixing.private.json';
  const url = URL.createObjectURL(new Blob([message.json], {type: 'application/json'}));
  browser.downloads.download({url, filename, saveAs: true, conflictAction: 'uniquify'})
    .then(id => respond({ok: true, id}), error => respond({ok: false, error: String(error?.message || error)}))
    .finally(() => setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000));
  return true;
});

browser.menus.create({
  id: 'ignore-field',
  title: 'Ignore this field',
  type: 'checkbox',
  contexts: ['editable'],
  documentUrlPatterns: ['https://*/*']
}, () => void browser.runtime.lastError);
browser.menus.create({
  id: 'save-field',
  title: 'Save this field',
  contexts: ['editable'],
  documentUrlPatterns: ['https://*/*']
}, () => void browser.runtime.lastError);

// Right-click anywhere on a page: Firefox Form Filler in the menu, with the extension's panel and its two page actions.
const PAGE_CONTEXTS = ['page', 'selection', 'link', 'image', 'frame'];
browser.menus.create({
  id: 'jk-parent', title: 'Firefox Form Filler', contexts: [...PAGE_CONTEXTS, 'editable'], documentUrlPatterns: ['https://*/*']
}, () => void browser.runtime.lastError);
for (const [id, title] of [['jk-open-panel', 'Open the extension menu'], ['jk-fill-now', 'Review & Fill this page'], ['jk-save-profile', 'Save this page to my profile']]) {
  browser.menus.create({
    id, parentId: 'jk-parent', title, contexts: [...PAGE_CONTEXTS, 'editable'], documentUrlPatterns: ['https://*/*']
  }, () => void browser.runtime.lastError);
}

async function trustedFieldContext(info, tab) {
  if (!tab?.id || info.targetElementId == null || !info.pageUrl) return null;
  const url = new URL(info.pageUrl);
  if (url.protocol !== 'https:' || !(await browser.permissions.contains({origins: [`https://${url.hostname}/*`]}))) return null;
  return {tabId: tab.id, options: {frameId: info.frameId || 0}, targetElementId: info.targetElementId};
}

browser.menus.onShown.addListener((info, tab) => {
  (async () => {
    const target = await trustedFieldContext(info, tab);
    const state = target && await browser.tabs.sendMessage(target.tabId,
      {type: 'field-menu-state', targetElementId: target.targetElementId}, target.options);
    await Promise.all([
      browser.menus.update('ignore-field', {visible: !!state?.supported, checked: !!state?.ignored}),
      browser.menus.update('save-field', {visible: !!state?.savable})
    ]);
    await browser.menus.refresh();
  })().catch(() => {});
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'jk-open-panel') { browser.action ? browser.action.openPopup().catch(() => {}) : browser.browserAction.openPopup().catch(() => {}); return; }
  if (info.menuItemId === 'jk-fill-now' || info.menuItemId === 'jk-save-profile') {
    try {
      await browser.tabs.sendMessage(tab.id, {type: info.menuItemId === 'jk-fill-now' ? 'fill-now' : 'save-to-profile'}, {frameId: 0});
    } catch (error) {
      // This website isn't whitelisted yet (nothing is listening on the page): the panel is where to whitelist it.
      (browser.action || browser.browserAction).openPopup().catch(() => {});
    }
    return;
  }
  if (!['ignore-field','save-field'].includes(info.menuItemId)) return;
  try {
    const target = await trustedFieldContext(info, tab);
    if (!target) return;
    await browser.tabs.sendMessage(target.tabId, info.menuItemId === 'ignore-field' ? {
      type: 'set-ignore-field', targetElementId: target.targetElementId, ignored: info.checked === true
    } : {type: 'save-field', targetElementId: target.targetElementId}, target.options);
  } catch (error) {
    console.error('Could not use the field context menu:', error);
  }
});

async function migrateProfile() {
  try { await FFF_STORAGE.migrateStorage(); }
  catch (error) { console.error('Profile migration was not applied:', error); }
}

// Firefox clears scripts registered with the scripting API when the extension updates, which took the buttons off every
// whitelisted site. The sites to bring back are the ones this extension holds access for, plus the list it keeps of
// sites whitelisted with the floating button (which have no access of their own).
async function restoreRegisteredScripts() {
  const wanted = ['defaults.js', 'autofill.js'];
  const entries = await browser.scripting.getRegisteredContentScripts();
  const known = new Set(entries.map(entry => entry.id));
  const granted = (await browser.permissions.getAll()).origins || [];
  const saved = (await browser.storage.local.get('whitelistedSites')).whitelistedSites;
  const hosts = new Set([...(Array.isArray(saved) ? saved : []),
    ...granted.map(origin => /^https:\/\/([^/*]+)\/\*$/.exec(origin)?.[1]).filter(Boolean)]);
  for (const host of hosts) {
    const pattern = `https://${host}/*`;
    if (known.has(`jamie-${host}`) || !(await browser.permissions.contains({origins: [pattern]}))) continue;
    await browser.scripting.registerContentScripts([{
      id: `jamie-${host}`, matches: [pattern], js: wanted, runAt: 'document_idle', persistAcrossSessions: true
    }]).catch(() => {});
  }
  if (granted.includes('https://*/*') && !known.has('jk-launcher')) {
    await browser.scripting.registerContentScripts([{
      id: 'jk-launcher', matches: ['https://*/*'], js: ['launcher.js'], runAt: 'document_idle', persistAcrossSessions: true
    }]).catch(() => {});
  }
}

// The automatic sites (auto-sites.js) are whitelisted by Firefox granting their access at install, so the script is
// registered here without any click, and put into tabs already open on them. Where access was taken away in Firefox's
// extensions panel nothing is registered, and the registration is dropped again by reconcileRemovedOrigins.
async function registerAutoSites() {
  const known = new Set((await browser.scripting.getRegisteredContentScripts()).map(entry => entry.id));
  const files = ['defaults.js', 'autofill.js'];
  for (const site of FFF_AUTO_SITES) {
    if (known.has(site.id) || !(await browser.permissions.contains({origins: [site.match]}))) continue;
    await browser.scripting.registerContentScripts([{
      id: site.id, matches: [site.match], js: files, runAt: 'document_idle', persistAcrossSessions: true
    }]).catch(() => {});
    for (const tab of await browser.tabs.query({url: site.match})) {
      await browser.scripting.executeScript({target: {tabId: tab.id}, files}).catch(() => {});
    }
  }
}

async function refreshRegisteredScripts() {
  await restoreRegisteredScripts().catch(error => console.error('Could not restore whitelisted sites:', error));
  await registerAutoSites().catch(error => console.error('Could not set up the automatic sites:', error));
  const wanted = ['defaults.js', 'autofill.js'];
  const entries = (await browser.scripting.getRegisteredContentScripts()).filter(entry => entry.id.startsWith('jamie-'));
  for (const entry of entries) {
    if (entry.js?.join() !== wanted.join()) await browser.scripting.updateContentScripts([{id: entry.id, js: wanted}]);
  }
}

// The sites whitelisted so far, kept so they can be brought back after an update (see restoreRegisteredScripts).
async function rememberWhitelistedSite(host, add) {
  const saved = (await browser.storage.local.get('whitelistedSites')).whitelistedSites;
  const sites = new Set(Array.isArray(saved) ? saved : []);
  if (add) sites.add(host); else sites.delete(host);
  await browser.storage.local.set({whitelistedSites: [...sites].sort()});
}

// Startup and install both initialize; one at a time, so a site is never registered twice at once.
let initializing = Promise.resolve();
function initializeExtension() {
  initializing = initializing.then(() => Promise.all([migrateProfile(), refreshRegisteredScripts()]), () => {});
  return initializing;
}

async function reconcileRemovedOrigins(permissions) {
  const removed = new Set((permissions?.origins || []).filter(origin => origin.startsWith('https://')));
  if (!removed.size) return;
  const entries = (await browser.scripting.getRegisteredContentScripts()).filter(entry => entry.id.startsWith('jamie-'));
  for (const entry of entries) {
    const matches = entry.matches || [];
    const remaining = matches.filter(match => !removed.has(match));
    if (remaining.length === matches.length) continue;
    if (remaining.length) await browser.scripting.updateContentScripts([{id: entry.id, matches: remaining}]);
    else await browser.scripting.unregisterContentScripts({ids: [entry.id]});
  }
}

// Access to one website can also be given in Firefox's own extensions panel ("Always allow on this site"), which
// registers no script, so no buttons showed up there. The script is registered here as the popup would have done, and
// put into the tabs already open on that site.
async function registerGrantedSites(permissions) {
  const hosts = (permissions?.origins || []).map(origin => /^https:\/\/([^/*]+)\/\*$/.exec(origin)?.[1]).filter(Boolean);
  for (const host of hosts) {
    const pattern = `https://${host}/*`, id = `jamie-${host}`, files = ['defaults.js', 'autofill.js'];
    const known = await browser.scripting.getRegisteredContentScripts({ids: [id]});
    if (!known.length) await browser.scripting.registerContentScripts([{
      id, matches: [pattern], js: files, runAt: 'document_idle', persistAcrossSessions: true
    }]);
    for (const tab of await browser.tabs.query({url: pattern})) {
      await browser.scripting.executeScript({target: {tabId: tab.id}, files}).catch(() => {});
    }
    await rememberWhitelistedSite(host, true);
  }
}

browser.permissions.onAdded.addListener(permissions => {
  initializing = initializing.then(() => Promise.all([registerGrantedSites(permissions), registerAutoSites()]), () => {})
    .catch(error => console.error('Could not set up a newly allowed site:', error));
});

browser.permissions.onRemoved.addListener(permissions => {
  reconcileRemovedOrigins(permissions).catch(error => console.error('Could not reconcile removed site access:', error));
});
browser.runtime.onInstalled.addListener(initializeExtension);
browser.runtime.onStartup.addListener(initializeExtension);
initializeExtension().catch(error => console.error('Extension initialization failed:', error));
