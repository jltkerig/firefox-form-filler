import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stored = {};
const context = {
  browser: {storage: {local: {
    get: async keys => Object.fromEntries(keys.filter(key => Object.hasOwn(stored, key)).map(key => [key, stored[key]])),
    set: async values => Object.assign(stored, structuredClone(values))
  }}}
};
runInNewContext(read('defaults.js'), context);
runInNewContext(read('storage-schema.js'), context);

await context.FFF_STORAGE.migrateStorage();
assert.equal(stored.profileSchemaVersion, 1);
assert.equal(stored.settings.bitwardenCompatibilityMode, false);
assert.deepEqual(stored.learnedFields, []);

const candidate = {
  format: context.FFF_STORAGE.EXPORT_FORMAT,
  schemaVersion: 1,
  data: {
    jamieProfile: structuredClone(stored.jamieProfile),
    learnedFields: [{id:'fixture',question:'preferred location',answer:'Remote',updatedAt:1}],
    settings: {bitwardenCompatibilityMode:true}
  }
};
const validated = context.FFF_STORAGE.validateExport(candidate);
assert.equal(validated.learnedFields[0].answer, 'Remote');
assert.equal(validated.settings.bitwardenCompatibilityMode, true);
assert.throws(() => context.FFF_STORAGE.validateExport({...candidate, schemaVersion:99}), /not supported/);
assert.throws(() => context.FFF_STORAGE.validateExport({...candidate, data:{...candidate.data, learnedFields:'invalid'}}), /must be a list/);
const futureField = context.FFF_STORAGE.normalizeProfile({...stored.jamieProfile, profile:{...stored.jamieProfile.profile, futureField:'keep me'}}, true);
assert.equal(futureField.profile.futureField, 'keep me', 'migrations must not discard unknown stored fields');

console.log('Storage migration and private import validation checks passed.');
