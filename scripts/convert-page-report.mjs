import {readFileSync, writeFileSync} from 'node:fs';
import {basename, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const fixtureRoot = resolve('docs/ats-fixtures');
const clean = value => String(value || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]')
  .replace(/\b(?:\+?\d[\s().-]*){10,}\b/g,'[phone]').replace(/https?:\/\/\S+/gi,'[url]').replace(/\b\d{4,}\b/g,'[number]').slice(0,240);
const ariaNames = new Set(['aria-label','aria-labelledby','aria-describedby','aria-required','aria-invalid','aria-haspopup','aria-expanded','aria-controls','role','autocomplete','inputmode']);
export function convertPageReport(source, outputName) {
  if (source?.format !== 'firefox-page-fixing-v1' || !Array.isArray(source.fields)) throw new Error('The input is not a supported page-for-fixing report.');
  const fixture={format:'firefox-form-filler-ats-fixture',schemaVersion:1,source:'sanitized-page-report',
    hostname:`${basename(outputName,'.json').toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,50)||'ats'}.example`,
    fields:source.fields.slice(0,300).map(field=>({fieldType:clean(field.type||field.tag||'unknown'),label:clean(field.label||field.name||field.id||'unlabeled field'),
    reason:'Captured for regression review',aria:Object.fromEntries(Object.entries({
      'aria-label':field.ariaLabel,'aria-required':field.required?'true':'','autocomplete':field.autocomplete,'inputmode':field.inputMode,'role':field.role
    }).filter(([key,value])=>ariaNames.has(key)&&value).map(([key,value])=>[key,clean(value)]))}))};
  if (!fixture.fields.length) throw new Error('The report contains no fields.');
  return fixture;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [, , input, outputName] = process.argv;
  if (!input || !outputName) throw new Error('Usage: node scripts/convert-page-report.mjs <page-for-fixing.private.json> <fixture-name.json>');
  const output = resolve(fixtureRoot, basename(outputName));
  if (!output.startsWith(`${fixtureRoot}${sep}`) || !output.endsWith('.json')) throw new Error('Fixture output must be a JSON filename.');
  const fixture=convertPageReport(JSON.parse(readFileSync(resolve(input),'utf8')),outputName);
  writeFileSync(output,`${JSON.stringify(fixture,null,2)}\n`,'utf8');
  console.log(`Created sanitized fixture ${output} with ${fixture.fields.length} fields. Review it before committing.`);
}
