import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

function storageArea() {
  const records = new Map();
  return {
    async get(key) {
      if (typeof key === 'string') return {[key]: records.get(key)};
      return Object.fromEntries(records);
    },
    async set(values) { for (const [key, value] of Object.entries(values)) records.set(key, value); },
    async remove(key) { records.delete(key); }
  };
}

const local = storageArea(), session = storageArea();
const context = {
  browser: {storage: {local, session}}, crypto: webcrypto,
  TextEncoder, Uint8Array,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary')
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(new URL('../auth.js', import.meta.url), 'utf8'), context);

assert.equal(JSON.stringify(await context.FFF_AUTH.state()), JSON.stringify({configured: false, unlocked: false}));
await assert.rejects(context.FFF_AUTH.create('too-short'), /10 characters/);
await context.FFF_AUTH.create('correct horse battery staple');
assert.equal(JSON.stringify(await context.FFF_AUTH.state()), JSON.stringify({configured: true, unlocked: true}));
const config = (await local.get('authConfig')).authConfig;
assert.equal(config.algorithm, 'PBKDF2-SHA-256');
assert.equal(JSON.stringify(config).includes('correct horse'), false, 'password must not be stored in plaintext');
await context.FFF_AUTH.lock();
assert.equal((await context.FFF_AUTH.state()).unlocked, false);
assert.equal(await context.FFF_AUTH.unlock('incorrect password'), false);
assert.equal(await context.FFF_AUTH.unlock('correct horse battery staple'), true);
assert.equal((await context.FFF_AUTH.state()).unlocked, true);
console.log('Local password setup, lock, and unlock checks passed.');
