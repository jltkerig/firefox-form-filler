import assert from 'node:assert/strict';
import {convertPageReport} from './convert-page-report.mjs';

const fixture=convertPageReport({format:'firefox-page-fixing-v1',hostname:'private.example.com',fields:[
  {tag:'input',type:'email',label:'Contact person@example.com',name:'email',required:true,autocomplete:'email'},
  {tag:'input',type:'tel',label:'Call +1 (202) 555-0147',name:'phone'}
]},'captured-workday.json');
assert.equal(fixture.hostname,'captured-workday.example');
assert.equal(fixture.fields.length,2);
const serialized=JSON.stringify(fixture);
assert.doesNotMatch(serialized,/person@example\.com|202.*555.*0147|private\.example\.com/);
assert.doesNotMatch(serialized,/"(?:value|answer)"/);
console.log('Saved-page fixture converter privacy checks passed.');
