(() => {
  'use strict';

  const SCHEMA_VERSION = 4;
  const EXPORT_FORMAT = 'firefox-form-filler-private-profile';
  const MAX_LEARNED_FIELDS = 2000;
  const MAX_TEXT_LENGTH = 20000;
  const SETTINGS_DEFAULTS = Object.freeze({bitwardenCompatibilityMode: false, theme: 'system'});
  const learnedKeys = ['id', 'question', 'name', 'placeholder', 'type', 'host', 'label', 'answer'];
  const ignoredKeys = ['key', 'question', 'name', 'elementId', 'placeholder', 'type', 'host', 'label'];
  const mappingKeys = [...ignoredKeys, 'section', 'profileKey'];

  function text(value, path) {
    if (typeof value !== 'string') throw new Error(`${path} must be text.`);
    if (value.length > MAX_TEXT_LENGTH) throw new Error(`${path} is too long.`);
    return value;
  }

  function normalizeRecord(source, defaults, path, preserveUnknown = false) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error(`${path} must be an object.`);
    }
    const result = preserveUnknown ? {...source} : {};
    for (const key of Object.keys(defaults)) {
      if (Array.isArray(defaults[key])) continue;
      result[key] = source[key] == null ? '' : text(source[key], `${path}.${key}`);
    }
    return result;
  }

  function normalizeProfile(source, preserveUnknown = false) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('jamieProfile must be an object.');
    }
    const profile = normalizeRecord(source.profile || {}, JAMIE_DEFAULTS.profile, 'jamieProfile.profile', preserveUnknown);
    const optional = normalizeRecord(source.optional || {}, JAMIE_DEFAULTS.optional, 'jamieProfile.optional', preserveUnknown);
    const jobs = source.profile?.jobs ?? [];
    const education = source.profile?.education ?? [];
    if (!Array.isArray(jobs) || !Array.isArray(education)) throw new Error('Work history and education must be lists.');
    if (jobs.length > 200 || education.length > 200) throw new Error('Work history and education cannot exceed 200 entries each.');
    profile.jobs = jobs.map((job, index) => normalizeRecord(job,
      {employer:'', title:'', location:'', start:'', end:'', description:''}, `jamieProfile.profile.jobs[${index}]`, preserveUnknown));
    profile.education = education.map((school, index) => {
      if (!Array.isArray(school) || school.length > 4) throw new Error(`jamieProfile.profile.education[${index}] must be a four-item list.`);
      return ['school','location','degree','fieldOfStudy'].map((key, itemIndex) =>
        text(school[itemIndex] ?? '', `jamieProfile.profile.education[${index}].${key}`));
    });
    return preserveUnknown ? {...source, profile, optional} : {profile, optional};
  }

  function normalizeLearnedFields(source) {
    if (!Array.isArray(source)) throw new Error('learnedFields must be a list.');
    if (source.length > MAX_LEARNED_FIELDS) throw new Error(`learnedFields cannot exceed ${MAX_LEARNED_FIELDS} entries.`);
    return source.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`learnedFields[${index}] must be an object.`);
      const record = Object.fromEntries(learnedKeys.map(key => [key, text(item[key] ?? '', `learnedFields[${index}].${key}`)]));
      const updatedAt = Number(item.updatedAt || 0);
      if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error(`learnedFields[${index}].updatedAt is invalid.`);
      record.updatedAt = updatedAt;
      return record;
    });
  }

  function normalizeIgnoredFields(source) {
    if (!Array.isArray(source)) throw new Error('ignoredFields must be a list.');
    if (source.length > MAX_LEARNED_FIELDS) throw new Error(`ignoredFields cannot exceed ${MAX_LEARNED_FIELDS} entries.`);
    return source.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`ignoredFields[${index}] must be an object.`);
      const record = Object.fromEntries(ignoredKeys.map(key => [key, text(item[key] ?? '', `ignoredFields[${index}].${key}`)]));
      const updatedAt = Number(item.updatedAt || 0);
      if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error(`ignoredFields[${index}].updatedAt is invalid.`);
      record.updatedAt = updatedAt;
      return record;
    });
  }

  function normalizeSiteMappings(source) {
    if (!Array.isArray(source)) throw new Error('siteMappings must be a list.');
    if (source.length > MAX_LEARNED_FIELDS) throw new Error(`siteMappings cannot exceed ${MAX_LEARNED_FIELDS} entries.`);
    return source.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`siteMappings[${index}] must be an object.`);
      const record = Object.fromEntries(mappingKeys.map(key => [key, text(item[key] ?? '', `siteMappings[${index}].${key}`)]));
      if (!['profile','optional'].includes(record.section) || !Object.hasOwn(JAMIE_DEFAULTS[record.section], record.profileKey) ||
          Array.isArray(JAMIE_DEFAULTS[record.section][record.profileKey])) throw new Error(`siteMappings[${index}] has an invalid profile field.`);
      const updatedAt = Number(item.updatedAt || 0);
      if (!Number.isFinite(updatedAt) || updatedAt < 0) throw new Error(`siteMappings[${index}].updatedAt is invalid.`);
      record.updatedAt = updatedAt;
      return record;
    });
  }

  function normalizeProfileVariants(source, fallback) {
    const input = Array.isArray(source) && source.length ? source : [{id:'default',name:'Default',data:fallback || JAMIE_DEFAULTS}];
    if (input.length > 20) throw new Error('Profile variants cannot exceed 20 entries.');
    const ids = new Set();
    return input.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`profileVariants[${index}] must be an object.`);
      const id = text(item.id ?? '', `profileVariants[${index}].id`).trim();
      const name = text(item.name ?? '', `profileVariants[${index}].name`).trim();
      if (!/^[a-z0-9-]{1,80}$/.test(id) || ids.has(id)) throw new Error(`profileVariants[${index}].id is invalid.`);
      if (!name || name.length > 80) throw new Error(`profileVariants[${index}].name is invalid.`);
      ids.add(id); return {id,name,data:normalizeProfile(item.data || JAMIE_DEFAULTS)};
    });
  }

  function normalizeSettings(source = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('settings must be an object.');
    return {
      bitwardenCompatibilityMode: source.bitwardenCompatibilityMode === true,
      theme: ['system','light','dark'].includes(source.theme) ? source.theme : 'system',
      lastProfileExportAt: typeof source.lastProfileExportAt === 'string' ? source.lastProfileExportAt.slice(0,40) : ''
    };
  }

  function validateExport(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('The selected file is not a profile backup.');
    if (source.format !== EXPORT_FORMAT) throw new Error('The selected file has an unsupported format.');
    const version = Number(source.schemaVersion);
    if (!Number.isInteger(version) || version < 1 || version > SCHEMA_VERSION) {
      throw new Error(`Schema version ${source.schemaVersion ?? 'missing'} is not supported.`);
    }
    const jamieProfile = normalizeProfile(source.data?.jamieProfile || JAMIE_DEFAULTS);
    const profileVariants = normalizeProfileVariants(source.data?.profileVariants, jamieProfile);
    const activeProfileVariant = profileVariants.some(item => item.id === source.data?.activeProfileVariant) ? source.data.activeProfileVariant : profileVariants[0].id;
    return {
      jamieProfile: profileVariants.find(item => item.id === activeProfileVariant).data,
      profileVariants, activeProfileVariant,
      learnedFields: normalizeLearnedFields(source.data?.learnedFields || []),
      ignoredFields: normalizeIgnoredFields(source.data?.ignoredFields || []),
      siteMappings: normalizeSiteMappings(source.data?.siteMappings || []),
      settings: normalizeSettings(source.data?.settings || {})
    };
  }

  async function migrateStorage() {
    const saved = await browser.storage.local.get(['profileSchemaVersion', 'jamieProfile', 'profileVariants', 'activeProfileVariant', 'learnedFields', 'ignoredFields', 'siteMappings', 'settings']);
    const version = Number(saved.profileSchemaVersion || 0);
    if (version > SCHEMA_VERSION) throw new Error('This profile was created by a newer extension version.');
    if (version === SCHEMA_VERSION) return saved;
    const variants = normalizeProfileVariants(saved.profileVariants, saved.jamieProfile || JAMIE_DEFAULTS);
    const active = variants.some(item => item.id === saved.activeProfileVariant) ? saved.activeProfileVariant : variants[0].id;
    const migrated = {
      profileSchemaVersion: SCHEMA_VERSION,
      jamieProfile: variants.find(item => item.id === active).data,
      profileVariants: variants, activeProfileVariant: active,
      learnedFields: normalizeLearnedFields(saved.learnedFields || []),
      ignoredFields: normalizeIgnoredFields(saved.ignoredFields || []),
      siteMappings: normalizeSiteMappings(saved.siteMappings || []),
      settings: normalizeSettings(saved.settings || {})
    };
    await browser.storage.local.set(migrated);
    return migrated;
  }

  globalThis.FFF_STORAGE = Object.freeze({
    SCHEMA_VERSION, EXPORT_FORMAT, SETTINGS_DEFAULTS, normalizeProfile,
    normalizeLearnedFields, normalizeIgnoredFields, normalizeSiteMappings, normalizeProfileVariants,
    normalizeSettings, validateExport, migrateStorage
  });
})();
