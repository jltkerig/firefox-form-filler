import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const defaultsContext = {};
runInNewContext(read('defaults.js'), defaultsContext);

function assertBlank(value, path = 'defaults') {
  if (Array.isArray(value)) {
    assert.equal(value.length, 0, `${path} must start empty`);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) assertBlank(child, `${path}.${key}`);
  } else {
    assert.equal(value, '', `${path} must start blank`);
  }
}

assertBlank(defaultsContext.JAMIE_DEFAULTS);
assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'storage']);
assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);

for (const name of ['autofill.js', 'background.js', 'options.js', 'popup.js']) {
  const source = read(name);
  assert.doesNotMatch(source, /browser\.storage\.sync|chrome\.storage\.sync/,
    `${name} must keep answers in Firefox local storage`);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/,
    `${name} must not send form data over the network`);
}

const autofill = read('autofill.js');
assert.match(autofill, /if \(currentAnswer\(el\)\) continue;/,
  'review must skip existing answers');
assert.match(autofill, /\['hidden','submit','button','reset','password','image'\]\.includes\(el\.type\)/,
  'review must skip hidden and password fields');
assert.match(autofill, /!isVisible\(el\)/,
  'review must skip invisible fields');

console.log('Privacy contract checks passed (static source checks; live Firefox behavior still needs testing).');
