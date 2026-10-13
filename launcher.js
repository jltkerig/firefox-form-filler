// Floating "Whitelist this site" button. It is registered on HTTPS pages only when "Floating Whitelist button" is switched
// on in the extension menu (Firefox then asks once for access to all websites). It never reads an answer or any page
// text: it counts visible form fields to decide whether to show itself, and sends the site name to the extension when
// you click it. Whitelisted sites get the normal Review & Fill buttons instead.
(() => {
  if (globalThis.__jamieLauncher) return;
  globalThis.__jamieLauncher = true;
  const isVisible = el => el.getClientRects().length > 0;
  function looksLikeAnApplicationForm() {
    const fields = [...document.querySelectorAll('input, textarea, select')].filter(isVisible);
    if (fields.some(el => (el.getAttribute('type') || '').toLowerCase() === 'password')) return false;  // a sign-in page
    const answerable = fields.filter(el => !['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio', 'search']
      .includes((el.getAttribute('type') || 'text').toLowerCase()));
    return answerable.length >= 3;
  }
  function show() {
    if (document.getElementById('jk-whitelist-launcher')) return;
    const button = document.createElement('button');
    button.id = 'jk-whitelist-launcher';
    button.type = 'button';
    button.textContent = 'Whitelist this site';
    button.title = 'Turn on Review & Fill, Autofill and Save for this website';
    button.style.cssText = 'position:fixed!important;right:18px!important;bottom:18px!important;z-index:2147483646!important;' +
      'padding:12px 18px!important;border:2px solid #194e9e!important;border-radius:24px!important;background:#fff!important;' +
      'color:#194e9e!important;font:600 14px system-ui,sans-serif!important;box-shadow:0 4px 18px #0003!important;cursor:pointer!important;';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Whitelisting…';
      try {
        const reply = await browser.runtime.sendMessage({type: 'whitelist-this-site'});
        if (!reply?.ok) throw new Error(reply?.error || 'not allowed');
        button.remove();  // the normal buttons take its place
      } catch {
        button.disabled = false;
        button.textContent = 'Could not whitelist: use the menu';
      }
    });
    document.body.appendChild(button);
  }
  const check = () => {
    if (globalThis.__jamieJobAutofill || !document.body) return;  // already whitelisted
    if (looksLikeAnApplicationForm()) show();
  };
  setTimeout(check, 1500);
  setTimeout(check, 6000);  // forms drawn later by the page
})();
