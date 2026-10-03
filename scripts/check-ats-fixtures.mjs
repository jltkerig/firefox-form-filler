import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const directory = new URL('../docs/ats-fixtures/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.json'));
assert.ok(files.length, 'at least one sanitized ATS fixture is required');

const forbiddenKeys = new Set(['value', 'answer', 'cookie', 'html', 'resume', 'token']);
const privatePatterns = [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, /\b(?:\+?\d[\s().-]*){10,}\b/];

for (const name of files) {
  const raw = readFileSync(new URL(name, directory), 'utf8');
  const fixture = JSON.parse(raw);
  assert.equal(fixture.format, 'firefox-form-filler-ats-fixture', `${name}: format`);
  assert.equal(fixture.schemaVersion, 1, `${name}: schema version`);
  assert.match(fixture.hostname, /\.example$/, `${name}: hostname must be synthetic`);
  assert.ok(Array.isArray(fixture.fields) && fixture.fields.length, `${name}: fields`);
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assert.ok(!forbiddenKeys.has(key.toLowerCase()), `${name}: forbidden key ${key}`);
        visit(child);
      }
    } else if (typeof value === 'string') {
      for (const pattern of privatePatterns) assert.doesNotMatch(value, pattern, `${name}: possible private data`);
    }
  };
  visit(fixture);
}

console.log(`ATS fixture checks passed for ${files.length} sanitized fixture(s).`);
