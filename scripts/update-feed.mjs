import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [assetPath] = process.argv.slice(2);
if (!assetPath) throw new Error('Pass the signed XPI path.');

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const id = manifest.browser_specific_settings.gecko.id;
const version = manifest.version;
const name = `firefox-form-filler-v${version}.xpi`;
if (!assetPath.endsWith(name)) throw new Error('Signed XPI name does not match manifest version.');

const xpi = readFileSync(assetPath);
const hash = createHash('sha256').update(xpi).digest('hex');
const feed = JSON.parse(readFileSync('updates.json', 'utf8'));
if (!feed.addons?.[id]?.updates) throw new Error('Update feed extension ID mismatch.');

const updates = feed.addons[id].updates.filter(update => update.version !== version);
updates.push({
  version,
  update_link: `https://github.com/jltkerig/firefox-form-filler/releases/download/v${version}/${name}`,
  update_hash: `sha256:${hash}`,
});
feed.addons[id].updates = updates;
writeFileSync('updates.json', `${JSON.stringify(feed, null, 2)}\n`);
console.log(`Prepared Firefox update feed for signed version ${version}.`);
