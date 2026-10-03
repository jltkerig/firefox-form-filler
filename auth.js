(() => {
  'use strict';
  const CONFIG_KEY = 'authConfig';
  const SESSION_KEY = 'authUnlocked';
  const ITERATIONS = 310000;

  const encode = bytes => btoa(String.fromCharCode(...bytes));
  const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

  async function derive(password, salt, iterations = ITERATIONS) {
    const material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
      {name: 'PBKDF2', hash: 'SHA-256', salt, iterations}, material, 256));
  }

  function equal(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
    return difference === 0;
  }

  async function state() {
    const [local, session] = await Promise.all([
      browser.storage.local.get(CONFIG_KEY), browser.storage.session.get(SESSION_KEY)
    ]);
    return {configured: !!local[CONFIG_KEY], unlocked: session[SESSION_KEY] === true};
  }

  async function create(password) {
    if (typeof password !== 'string' || password.length < 10) {
      throw new Error('Use at least 10 characters.');
    }
    const existing = await browser.storage.local.get(CONFIG_KEY);
    if (existing[CONFIG_KEY]) throw new Error('A password is already configured.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt);
    await browser.storage.local.set({[CONFIG_KEY]: {
      version: 1, algorithm: 'PBKDF2-SHA-256', iterations: ITERATIONS,
      salt: encode(salt), hash: encode(hash)
    }});
    await browser.storage.session.set({[SESSION_KEY]: true});
  }

  async function unlock(password) {
    const saved = (await browser.storage.local.get(CONFIG_KEY))[CONFIG_KEY];
    if (!saved || saved.version !== 1 || saved.algorithm !== 'PBKDF2-SHA-256' ||
        !Number.isInteger(saved.iterations) || saved.iterations < 100000) return false;
    let valid = false;
    try {
      valid = equal(await derive(password, decode(saved.salt), saved.iterations), decode(saved.hash));
    } catch {}
    if (valid) await browser.storage.session.set({[SESSION_KEY]: true});
    return valid;
  }

  async function lock() {
    await browser.storage.session.remove(SESSION_KEY);
  }

  globalThis.FFF_AUTH = {state, create, unlock, lock};
})();
