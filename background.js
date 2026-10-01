browser.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'can-fill' || !sender.tab || !sender.url) return;
  let url;
  try { url = new URL(sender.url); } catch { respond(false); return; }
  if (url.protocol !== 'https:') { respond(false); return; }
  browser.permissions.contains({origins: [`https://${url.hostname}/*`]})
    .then(respond, () => respond(false));
  return true;
});
