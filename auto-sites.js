// Websites that are whitelisted without a click. Firefox grants their access when the extension is installed
// (host_permissions in manifest.json lists the same patterns), and background.js registers the content script for them.
const FFF_AUTO_SITES = Object.freeze([
  // Workday job sites, one subdomain per employer: acme.wd5.myworkdayjobs.com
  Object.freeze({id: 'jamie-auto-workday-wd5', match: 'https://*.wd5.myworkdayjobs.com/*'})
]);

// The automatic site that covers this hostname (the domain itself or any subdomain of it), or undefined.
function fffAutoSiteFor(hostname) {
  const host = String(hostname || '').toLowerCase();
  return FFF_AUTO_SITES.find(site => {
    const domain = site.match.replace(/^https:\/\/\*\./, '').replace(/\/\*$/, '');
    return host === domain || host.endsWith(`.${domain}`);
  });
}
