import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const fixture = readFileSync(new URL('../docs/large-form-test.html', import.meta.url), 'utf8');
const autofill = readFileSync(new URL('../autofill.js', import.meta.url), 'utf8');

assert.match(fixture, /const FIELD_COUNT = 1500;/, 'fixture must exercise more than the field scan limit');
assert.match(fixture, /const OPTION_COUNT = 25000;/, 'fixture must include a very large native select');
assert.match(fixture, /attachShadow\(\{mode: 'open'\}\)/, 'fixture must exercise open Shadow DOM discovery');
assert.match(fixture, /<iframe/, 'fixture must exercise embedded-form reporting');
assert.match(autofill, /fields: 1000/, 'production field scan must stay bounded');
assert.match(autofill, /shadowRoots: 24/, 'production shadow-root scan must stay bounded');
assert.match(autofill, /shadowHostNodes: 12000/, 'production shadow-host traversal must stay bounded');
const inlineScripts = [...fixture.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(inlineScripts.length, 1, 'fixture must contain one reviewable inline script');
new Script(inlineScripts[0][1], {filename: 'large-form-test.inline.js'});

console.log('Large-form fixture contract checks passed (interactive timing still requires a browser).');
