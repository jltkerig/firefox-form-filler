(() => {
  'use strict';
  const choices = new Set(['system', 'light', 'dark']);
  const normalize = value => choices.has(value) ? value : 'system';
  const apply = value => {
    const theme = normalize(value);
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    return theme;
  };
  globalThis.FFF_THEME = Object.freeze({normalize, apply});
})();
