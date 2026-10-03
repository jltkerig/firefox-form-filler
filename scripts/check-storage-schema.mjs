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
assert.equal(stored.profileSchemaVersion, 4);
assert.equal(stored.settings.bitwardenCompatibilityMode, false);
assert.equal(stored.settings.theme, 'system');
assert.deepEqual(stored.learnedFields, []);
assert.deepEqual(stored.ignoredFields, []);
assert.equal(stored.profileVariants.length, 1);
assert.equal(stored.activeProfileVariant, 'default');
assert.deepEqual(stored.siteMappings, []);

const candidate = {
  format: context.FFF_STORAGE.EXPORT_FORMAT,
  schemaVersion: 4,
  data: {
    jamieProfile: structuredClone(stored.jamieProfile),
    learnedFields: [{id:'fixture',question:'preferred location',answer:'Remote',updatedAt:1}],
    ignoredFields: [{key:'ignored-fixture',question:'salary',host:'jobs.example',updatedAt:1}],
    siteMappings: [{key:'mapping-fixture',question:'city',host:'jobs.example',section:'profile',profileKey:'city',updatedAt:1}],
    profileVariants: [{id:'default',name:'Default',data:structuredClone(stored.jamieProfile)}],activeProfileVariant:'default',
    settings: {bitwardenCompatibilityMode:true,theme:'dark'}
  }
};
const validated = context.FFF_STORAGE.validateExport(candidate);
assert.equal(validated.learnedFields[0].answer, 'Remote');
assert.equal(validated.ignoredFields[0].host, 'jobs.example');
assert.equal(validated.siteMappings[0].profileKey, 'city');
assert.equal(validated.profileVariants[0].name, 'Default');
assert.equal(validated.settings.bitwardenCompatibilityMode, true);
assert.equal(validated.settings.theme, 'dark');
assert.equal(context.FFF_STORAGE.normalizeSettings({theme:'invalid'}).theme, 'system');
const previousVersion=context.FFF_STORAGE.validateExport({...candidate,schemaVersion:3,data:{...candidate.data,profileVariants:undefined,activeProfileVariant:undefined,siteMappings:undefined}});
assert.equal(previousVersion.ignoredFields.length, 1, 'older private exports must remain importable');
assert.equal(previousVersion.profileVariants.length, 1, 'older exports must gain a default variant');
assert.throws(() => context.FFF_STORAGE.validateExport({...candidate, schemaVersion:99}), /not supported/);
assert.throws(() => context.FFF_STORAGE.validateExport({...candidate, data:{...candidate.data, learnedFields:'invalid'}}), /must be a list/);
const futureField = context.FFF_STORAGE.normalizeProfile({...stored.jamieProfile, profile:{...stored.jamieProfile.profile, futureField:'keep me'}}, true);
assert.equal(futureField.profile.futureField, 'keep me', 'migrations must not discard unknown stored fields');

console.log('Storage migration and private import validation checks passed.');
