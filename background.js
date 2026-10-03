browser.runtime.onMessage.addListener((message, sender, respond) => {
  const extensionPage = sender.id === browser.runtime.id && sender.url?.startsWith(browser.runtime.getURL(''));
  if (message?.type === 'lock-extension' && extensionPage) {
    (async () => {
      await FFF_AUTH.lock();
      const tabs = await browser.tabs.query({});
      await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.tabs.sendMessage(tab.id, {type:'destroy-extension-ui'})));
      respond(true);
    })().catch(() => respond(false));
    return true;
  }
  if (message?.type === 'unlock-extension' && extensionPage) {
    activateAuthorizedTabs().then(() => respond(true), () => respond(false));
    return true;
  }
  if (message?.type !== 'can-fill' || !sender.tab || !sender.url) return;
  let url;
  try { url = new URL(sender.url); } catch { respond(false); return; }
  if (url.protocol !== 'https:') { respond(false); return; }
  Promise.all([FFF_AUTH.state(), browser.permissions.contains({origins: [`https://${url.hostname}/*`]})])
    .then(([auth, permitted]) => respond(auth.unlocked && permitted), () => respond(false));
  return true;
});

async function activateAuthorizedTabs() {
  const entries = (await browser.scripting.getRegisteredContentScripts()).filter(entry => entry.id.startsWith('jamie-'));
  const matches = [...new Set(entries.flatMap(entry => entry.matches || []))];
  if (!matches.length) return;
  const tabs = await browser.tabs.query({url: matches});
  await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => browser.scripting.executeScript({
    target: {tabId: tab.id}, files: ['defaults.js', 'autofill.js']
  })));
}

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

async function trustedFieldContext(info, tab) {
  if (!tab?.id || info.targetElementId == null || !info.pageUrl) return null;
  const url = new URL(info.pageUrl);
  if (url.protocol !== 'https:' || !(await FFF_AUTH.state()).unlocked ||
      !(await browser.permissions.contains({origins: [`https://${url.hostname}/*`]}))) return null;
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

async function refreshRegisteredScripts() {
  const wanted = ['defaults.js', 'autofill.js'];
  const entries = (await browser.scripting.getRegisteredContentScripts()).filter(entry => entry.id.startsWith('jamie-'));
  for (const entry of entries) {
    if (entry.js?.join() !== wanted.join()) await browser.scripting.updateContentScripts([{id: entry.id, js: wanted}]);
  }
}

async function initializeExtension() {
  await Promise.all([migrateProfile(), refreshRegisteredScripts()]);
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

browser.permissions.onRemoved.addListener(permissions => {
  reconcileRemovedOrigins(permissions).catch(error => console.error('Could not reconcile removed site access:', error));
});
browser.runtime.onInstalled.addListener(initializeExtension);
browser.runtime.onStartup.addListener(initializeExtension);
initializeExtension().catch(error => console.error('Extension initialization failed:', error));
