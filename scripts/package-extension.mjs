import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const output = new URL('../.build/extension/', import.meta.url);

const files = [
  'manifest.json',
  'storage-schema.js',
  'background.js',
  'autofill.js',
  'defaults.js',
  'options.html',
  'options.css',
  'options.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'jk-toolbar-v112.svg',
];

if (manifest.browser_specific_settings?.gecko?.id !== 'jamie-job-autofill@local.invalid') {
  throw new Error('The extension ID changed; existing Firefox profiles would not migrate.');
}
if (manifest.browser_specific_settings.gecko.update_url !==
  'https://raw.githubusercontent.com/jltkerig/firefox-form-filler/main/updates.json') {
  throw new Error('The update URL does not match the published update feed.');
}

rmSync(output, { recursive: true, force: true });
for (const file of files) {
  const source = new URL(`../${file}`, import.meta.url);
  const target = new URL(file, output);
  mkdirSync(dirname(fileURLToPath(target)), { recursive: true });
  copyFileSync(source, target);
}

const context = {};
runInNewContext(readFileSync(new URL('defaults.js', output), 'utf8'), context);
const defaults = context.JAMIE_DEFAULTS;
const isBlank = value => Array.isArray(value) ? value.length === 0 :
  value && typeof value === 'object' ? Object.values(value).every(isBlank) : value === '';
if (!isBlank(defaults)) throw new Error('Packaged defaults contain saved answers.');

const contentScript = readFileSync(new URL('autofill.js', output), 'utf8');
for (const [name, expected] of [['PROFILE', defaults.profile], ['OPTIONAL', defaults.optional]]) {
  const match = contentScript.match(new RegExp(`  const ${name} = (\\{[\\s\\S]*?\\n  \\});`));
  if (!match || JSON.stringify(JSON.parse(match[1])) !== JSON.stringify(expected)) {
    throw new Error(`Packaged ${name} does not match blank profile defaults.`);
  }
}

console.log(`Packaged ${files.length} approved extension files for version ${manifest.version}.`);
