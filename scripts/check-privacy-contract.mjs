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
assert.match(read('README.txt'), new RegExp(`^FIREFOX FORM FILLER - VERSION ${manifest.version.replaceAll('.', '\\.')}`, 'm'),
  'README and manifest versions must match');

for (const name of ['autofill.js', 'background.js', 'options.js', 'popup.js', 'storage-schema.js']) {
  const source = read(name);
  assert.doesNotMatch(source, /browser\.storage\.sync|chrome\.storage\.sync/,
    `${name} must keep answers in Firefox local storage`);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|WebTransport)\s*\(?/,
    `${name} must not send form data over the network`);
  assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(|\.insertAdjacentHTML\s*\(|\.outerHTML\s*=|document\.write\s*\(|createContextualFragment\s*\(/,
    `${name} must not evaluate code or insert untrusted HTML`);
  const literalHtml = [...source.matchAll(/\.innerHTML\s*=\s*`([\s\S]*?)`/g)];
  for (const match of literalHtml) {
    assert.doesNotMatch(match[1], /\$\{/,
      `${name} innerHTML templates must not interpolate page or profile data`);
  }
  const withoutLiteralHtml = source.replace(/\.innerHTML\s*=\s*`[\s\S]*?`/g, '');
  assert.doesNotMatch(withoutLiteralHtml, /\.innerHTML\s*=/,
    `${name} innerHTML assignments must be fixed literal templates`);
}

const autofill = read('autofill.js');
assert.match(autofill, /if \(currentAnswer\(el\)\) continue;/,
  'review must skip existing answers');
assert.match(autofill, /\['hidden','submit','button','reset','password','image'\]\.includes\(el\.type\)/,
  'review must skip hidden and password fields');
assert.match(autofill, /!isVisible\(el\)/,
  'review must skip invisible fields');
assert.match(autofill, /await delay\(175\)/,
  'fills must be rechecked after framework state has time to react');
assert.match(autofill, /REVIEW_SCAN_LIMITS/,
  'shadow DOM discovery must remain bounded');
assert.doesNotMatch(read('popup.js'), /allFrames\s*:\s*true|all_frames\s*:\s*true/,
  'iframe origins must not be filled without a separate trust design');
assert.match(autofill, /privacy:'Contains structural field metadata only; no entered answers, cookies, storage, or page HTML\.'/,
  'failure reports must state their privacy boundary');
const failureRecord = autofill.match(/function failureRecord\(item\) \{([\s\S]*?)\n  \}\n  function downloadFailureReport/);
assert.ok(failureRecord, 'failure report serializer must exist');
assert.doesNotMatch(failureRecord[1], /(?:\.value|\.answer)/,
  'failure report records must not include field values or saved answers');
assert.match(read('options.js'), /Import preview ready\. Nothing has been changed\./,
  'imports must have a non-mutating preview step');
assert.match(read('background.js'), /permissions\.onRemoved/,
  'revoked site permissions must be reconciled');

console.log('Privacy contract checks passed (static source checks; live Firefox behavior still needs testing).');
