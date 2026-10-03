(async () => {
  try {
    if (!(await FFF_AUTH.state()).unlocked) {
      const next = document.body?.dataset.authDestination === 'options' ? '?next=options' : '';
      location.replace(`login.html${next}`);
      return;
    }
    document.documentElement.removeAttribute('data-auth-pending');
    const script = document.createElement('script');
    script.src = document.body.dataset.authScript;
    document.body.appendChild(script);
  } catch {
    location.replace('login.html');
  }
})();
