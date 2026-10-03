browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'can-fill' || !sender.tab || !sender.url) return;
  let url;
  try { url = new URL(sender.url); } catch { respond(false); return; }
  if (url.protocol !== 'https:') { respond(false); return; }
  browser.permissions.contains({origins: [`https://${url.hostname}/*`]})
    .then(respond, () => respond(false));
  return true;
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
