const container = document.getElementById('fields');
const status = document.getElementById('status');
const controls = [];
const jobControls = [], schoolControls = [];
let pendingImport = null;
const friendly = {
  eeoGender:'EEO gender (exact choice shown on applications)',
  eeoHispanicLatino:'EEO Hispanic or Latino (Yes, No, or exact choice)',
  eeoRace:'EEO race (exact choice shown on applications)',
  namePronunciation:'Name pronunciation (optional)',
  hasServedInMilitary:'Are you a veteran / have you served in the military? (Yes or No; separate from protected-veteran status)',
  expectedDayRate:'Expected day rate (leave blank if it varies by job)',
  leadershipPreference:'Leadership or individual contributor preference (exact choice)',
  teamInterest:'Team or area of interest (exact choice)',
  interestedFunctions:'Interested functions (one exact choice per line)',
  technicalSkillAreas:'Technical skill areas (one exact choice per line)',
  spokenLanguages:'Languages for checkbox questions (one exact choice per line)',
  coverLetter:'Reusable cover letter text (review for each job; text fields only)',
  certifications:'Current certifications',
  showreelUrl:'Showreel or website link',
  ssnLastFour:'Last four digits of Social Security Number',
  authorizedToWork:'Legally authorized to work', requiresSponsorship:'Requires sponsorship',
  desiredHoursPerWeek:'Preferred hours per week', referralSource:'How you heard about the job',
  currentlyAnEmployee:'Currently an employee of the hiring company',
  meetsListedMinimumRequirements:'Meets all listed minimum requirements (review for every job)',
  veteranStatus:'Protected-veteran status (exact choice shown on applications)', phoneDeviceType:'Phone device type', zipCode:'ZIP / postal code'
};
const booleanKeys = new Set(['authorizedToWork','requiresSponsorship','willingToRelocate','willingToTravel','previouslyEmployedByCompany','previouslyAppliedToCompany','nonCompeteAgreement','conflictOfInterest','currentlyAnEmployee','meetsListedMinimumRequirements','hasServedInMilitary']);
function labelFor(key) {return friendly[key] || key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());}
function field(parent,key,value) {
  const label = document.createElement('label'); label.textContent=labelFor(key);
  const el=document.createElement(booleanKeys.has(key)?'select':['summary','skills','description','interestedFunctions','technicalSkillAreas','spokenLanguages','coverLetter'].includes(key)?'textarea':'input');
  if (booleanKeys.has(key)) for(const text of ['','Yes','No']) {const o=document.createElement('option');o.value=text;o.textContent=text||'Leave unanswered';el.appendChild(o);}
  if(key==='ssnLastFour'){el.inputMode='numeric';el.maxLength=4;el.pattern='[0-9]{4}';el.autocomplete='off';}
  el.value=String(value??''); label.appendChild(el);parent.appendChild(label);return el;
}
function section(title){const el=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;el.appendChild(legend);container.appendChild(el);return el;}
function addRecord(parent, record, keys, destination) {
  const article=document.createElement('article');parent.appendChild(article);
  const fields=Object.fromEntries(keys.map(key=>[key,field(article,key,record[key]||'')]));
  const entry={article,fields};destination.push(entry);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove entry';
  remove.onclick=()=>{article.remove();destination.splice(destination.indexOf(entry),1);};article.appendChild(remove);
}
async function init(){
  await FFF_STORAGE.migrateStorage();
  const saved=await browser.storage.local.get(['jamieProfile','settings']);
  const data=saved.jamieProfile||JAMIE_DEFAULTS;
  document.getElementById('bitwarden-mode').checked = FFF_STORAGE.normalizeSettings(saved.settings).bitwardenCompatibilityMode;
  for(const [name,title] of [['profile','Contact and professional profile'],['optional','Application answers']]){
    const group=section(title);
    const merged={...JAMIE_DEFAULTS[name],...data[name]};
    for(const [key,value] of Object.entries(merged))if(!Array.isArray(value))controls.push({name,key,el:field(group,key,value)});
  }
  const jobs=section('Work history'), schools=section('Education');
  const jobKeys=['employer','title','location','start','end','description'];
  const schoolKeys=['school','location','degree','fieldOfStudy'];
  for(const job of data.profile.jobs||[])addRecord(jobs,job,jobKeys,jobControls);
  for(const school of data.profile.education||[])addRecord(schools,Object.fromEntries(schoolKeys.map((key,i)=>[key,school[i]])),schoolKeys,schoolControls);
  for(const [parent,label,keys,destination] of [[jobs,'Add job',jobKeys,jobControls],[schools,'Add school',schoolKeys,schoolControls]]){
    const add=document.createElement('button');add.type='button';add.textContent=label;add.onclick=()=>addRecord(parent,{},keys,destination);parent.appendChild(add);
  }
}
function downloadJson(data, filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
document.getElementById('export-profile').addEventListener('click',async()=>{
  try {
    await FFF_STORAGE.migrateStorage();
    const saved=await browser.storage.local.get(['jamieProfile','learnedFields','settings']);
    downloadJson({format:FFF_STORAGE.EXPORT_FORMAT,schemaVersion:FFF_STORAGE.SCHEMA_VERSION,
      exportedAt:new Date().toISOString(),data:{jamieProfile:saved.jamieProfile||JAMIE_DEFAULTS,
        learnedFields:saved.learnedFields||[],settings:FFF_STORAGE.normalizeSettings(saved.settings)}},
      `firefox-form-filler-profile-v${FFF_STORAGE.SCHEMA_VERSION}-${new Date().toISOString().slice(0,10)}.private.json`);
    status.textContent='Private profile exported. Store it somewhere protected.';
  } catch {status.textContent='Could not export the private profile.';}
});
document.getElementById('import-file').addEventListener('change',async event=>{
  pendingImport=null;document.getElementById('import-preview').hidden=true;
  try {
    const file=event.target.files[0];if(!file)return;
    if(file.size>5_000_000)throw new Error('The selected file is too large.');
    pendingImport=FFF_STORAGE.validateExport(JSON.parse(await file.text()));
    const populated=Object.values(pendingImport.jamieProfile.profile).filter(value=>typeof value==='string'&&value).length+
      Object.values(pendingImport.jamieProfile.optional).filter(Boolean).length;
    document.getElementById('import-summary').textContent=`Validated schema ${FFF_STORAGE.SCHEMA_VERSION}: ${populated} populated profile fields and ${pendingImport.learnedFields.length} remembered fields. Applying will replace the current saved profile, remembered fields, and compatibility setting.`;
    document.getElementById('import-preview').hidden=false;status.textContent='Import preview ready. Nothing has been changed.';
  } catch(error){status.textContent=`Import rejected: ${error.message}`;event.target.value='';}
});
document.getElementById('apply-import').addEventListener('click',async()=>{
  if(!pendingImport)return;
  try {
    await browser.storage.local.set({...pendingImport,profileSchemaVersion:FFF_STORAGE.SCHEMA_VERSION});
    status.textContent='Imported successfully. Reloading the validated profileâ€¦';
    setTimeout(()=>location.reload(),300);
  } catch {status.textContent='Could not apply the import. Existing data was left in place.';}
});
document.getElementById('cancel-import').addEventListener('click',()=>{
  pendingImport=null;document.getElementById('import-file').value='';document.getElementById('import-preview').hidden=true;
  status.textContent='Import cancelled. Nothing was changed.';
});
document.getElementById('profile').addEventListener('submit',async event=>{
  event.preventDefault();
  const data={profile:{},optional:{}};
  for(const {name,key,el} of controls)data[name][key]=el.value.trim();
  if(data.optional.ssnLastFour && !/^\d{4}$/.test(data.optional.ssnLastFour)){status.textContent='Enter exactly four digits for the SSN ending, or leave it blank.';return;}
  data.profile.jobs=jobControls.map(({fields})=>Object.fromEntries(Object.entries(fields).map(([key,el])=>[key,el.value.trim()])));
  data.profile.education=schoolControls.map(({fields})=>Object.values(fields).map(el=>el.value.trim()));
  const settings={bitwardenCompatibilityMode:document.getElementById('bitwarden-mode').checked};
  try {await browser.storage.local.set({jamieProfile:data,settings,profileSchemaVersion:FFF_STORAGE.SCHEMA_VERSION});status.textContent='Saved. Your next preview will use these answers.';}
  catch {status.textContent='Could not save. Please try again.';}
});
init().then(() => {document.getElementById('save-profile').disabled=false;document.getElementById('export-profile').disabled=false;}).catch(()=>{status.textContent='Could not load or migrate the profile. Existing storage was not replaced.';});
