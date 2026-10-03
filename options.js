const container = document.getElementById('fields');
const status = document.getElementById('status');
const controls = [];
const jobControls = [], schoolControls = [];
let pendingImport = null;
let learnedFields = [];
let ignoredFields = [];
let siteMappings = [], profileVariants = [], activeProfileVariant = 'default';
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
  const inputTypes={email:'email',phone:'tel',linkedin:'url',portfolio:'url',github:'url',otherWebsite:'url',showreelUrl:'url'};
  if(el instanceof HTMLInputElement&&inputTypes[key])el.type=inputTypes[key];
  if(key==='earliestStartDate'&&(!value||/^\d{4}-\d{2}-\d{2}$/.test(value)))el.type='date';
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
async function saveLearnedFields(next, message) {
  await browser.storage.local.set({learnedFields:next});
  learnedFields=next;
  status.textContent=message;
}
function renderLearnedFields() {
  const list=document.getElementById('memory-list'), query=document.getElementById('memory-search').value.trim().toLowerCase();
  const visible=learnedFields.filter(item=>`${item.label} ${item.question} ${item.host} ${item.type}`.toLowerCase().includes(query));
  document.getElementById('memory-count').textContent=`${visible.length} of ${learnedFields.length} remembered fields shown.`;
  list.replaceChildren();
  for(const item of visible) {
    const article=document.createElement('article'), title=document.createElement('strong'), meta=document.createElement('small');
    title.textContent=(item.label||item.question||'Unlabeled field').slice(0,240);
    meta.textContent=([item.host,item.type].filter(Boolean).join(' · ')||'No website metadata').slice(0,240);
    const label=document.createElement('label');label.textContent='Saved answer';
    const answer=document.createElement('input');answer.value=item.answer||'';answer.autocomplete='off';label.appendChild(answer);
    const save=document.createElement('button');save.type='button';save.textContent='Save answer';
    save.onclick=async()=>{const value=answer.value.trim();if(!value){status.textContent='A remembered answer cannot be blank. Remove the field instead.';return;}
      if(value.length>20000){status.textContent='A remembered answer cannot exceed 20,000 characters.';return;}
      const next=learnedFields.map(saved=>saved===item?{...saved,answer:value,updatedAt:Date.now()}:saved);
      try{await saveLearnedFields(next,`Updated remembered field: ${title.textContent}.`);renderLearnedFields();}catch{status.textContent='Could not update the remembered field.';}};
    const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Remove remembered field';
    remove.onclick=async()=>{const target=`${title.textContent}${item.host?` on ${item.host}`:''}`;
      if(!confirm(`Remove only the remembered field “${target}”? This does not change your main profile.`))return;
      const next=learnedFields.filter(saved=>saved!==item);try{await saveLearnedFields(next,`Removed remembered field: ${title.textContent}.`);renderLearnedFields();}catch{status.textContent='Could not remove the remembered field.';}};
    article.append(title,meta,label,save,remove);list.appendChild(article);
  }
}
async function saveIgnoredFields(next, message) {
  await browser.storage.local.set({ignoredFields:next});
  ignoredFields=next;
  status.textContent=message;
}
function renderIgnoredFields() {
  const list=document.getElementById('ignored-list'), query=document.getElementById('ignored-search').value.trim().toLowerCase();
  const visible=ignoredFields.filter(item=>`${item.label} ${item.question} ${item.host} ${item.type}`.toLowerCase().includes(query));
  document.getElementById('ignored-count').textContent=`${visible.length} of ${ignoredFields.length} ignored fields shown.`;
  list.replaceChildren();
  for(const item of visible) {
    const article=document.createElement('article'), title=document.createElement('strong'), meta=document.createElement('small');
    title.textContent=(item.label||item.question||'Unlabeled field').slice(0,240);
    meta.textContent=([item.host,item.type].filter(Boolean).join(' · ')||'No website metadata').slice(0,240);
    const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Use this field again';
    remove.onclick=async()=>{const target=`${title.textContent}${item.host?` on ${item.host}`:''}`;
      if(!confirm(`Use the ignored field “${target}” again? This removes only its ignore rule.`))return;
      const next=ignoredFields.filter(saved=>saved!==item);try{await saveIgnoredFields(next,`Removed ignore rule: ${title.textContent}.`);renderIgnoredFields();}catch{status.textContent='Could not remove the ignore rule.';}};
    article.append(title,meta,remove);list.appendChild(article);
  }
}
function renderMappings() {
  const list=document.getElementById('mapping-list');list.replaceChildren();
  document.getElementById('mapping-count').textContent=`${siteMappings.length} answer-free site mappings.`;
  for(const item of siteMappings) {
    const article=document.createElement('article'),title=document.createElement('strong'),meta=document.createElement('small'),remove=document.createElement('button');
    title.textContent=(item.label||item.question||'Unlabeled field').slice(0,240);
    meta.textContent=`${item.host} · ${item.section}.${item.profileKey}`;remove.type='button';remove.className='danger';remove.textContent='Remove mapping';
    remove.onclick=async()=>{if(!confirm(`Remove only the site mapping “${title.textContent}” on ${item.host}?`))return;
      siteMappings=siteMappings.filter(saved=>saved!==item);await browser.storage.local.set({siteMappings});renderMappings();status.textContent='Site mapping removed.';};
    article.append(title,meta,remove);list.appendChild(article);
  }
}
function renderVariants() {
  const select=document.getElementById('profile-variant');select.replaceChildren();
  for(const variant of profileVariants){const option=document.createElement('option');option.value=variant.id;option.textContent=variant.name;select.appendChild(option);}
  select.value=activeProfileVariant;document.getElementById('delete-variant').disabled=profileVariants.length<2;
}
function updateStorageHealth(saved) {
  const approximate=new Blob([JSON.stringify(saved)]).size;
  const last=saved.settings?.lastProfileExportAt?new Date(saved.settings.lastProfileExportAt).toLocaleString():'Never';
  document.getElementById('storage-health').textContent=`Storage health: about ${(approximate/1024).toFixed(1)} KB · ${learnedFields.length} remembered · ${ignoredFields.length} ignored · ${siteMappings.length} mappings · last private export: ${last}.`;
}
async function init(){
  await FFF_STORAGE.migrateStorage();
  const saved=await browser.storage.local.get(['jamieProfile','profileVariants','activeProfileVariant','settings','learnedFields','ignoredFields','siteMappings']);
  const data=saved.jamieProfile||JAMIE_DEFAULTS;
  learnedFields=FFF_STORAGE.normalizeLearnedFields(saved.learnedFields||[]);renderLearnedFields();
  ignoredFields=FFF_STORAGE.normalizeIgnoredFields(saved.ignoredFields||[]);renderIgnoredFields();
  siteMappings=FFF_STORAGE.normalizeSiteMappings(saved.siteMappings||[]);renderMappings();
  profileVariants=FFF_STORAGE.normalizeProfileVariants(saved.profileVariants,data);activeProfileVariant=saved.activeProfileVariant||profileVariants[0].id;renderVariants();
  updateStorageHealth(saved);
  document.getElementById('theme').value=FFF_THEME.apply(saved.settings?.theme);
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
document.getElementById('memory-search').addEventListener('input',renderLearnedFields);
document.getElementById('ignored-search').addEventListener('input',renderIgnoredFields);
document.getElementById('profile-variant').addEventListener('change',async event=>{
  const variant=profileVariants.find(item=>item.id===event.target.value);if(!variant)return;
  if(!confirm(`Switch to “${variant.name}”? Save current edits first; unsaved form changes will be discarded.`)){event.target.value=activeProfileVariant;return;}
  await browser.storage.local.set({activeProfileVariant:variant.id,jamieProfile:variant.data});location.reload();
});
document.getElementById('new-variant').addEventListener('click',async()=>{
  const name=prompt('Name the new variant. It will duplicate the currently saved variant.');if(!name?.trim())return;
  if(profileVariants.length>=20){status.textContent='The 20-variant limit has been reached.';return;}
  const id=`variant-${Date.now().toString(36)}`,base=profileVariants.find(item=>item.id===activeProfileVariant);
  profileVariants.push({id,name:name.trim().slice(0,80),data:structuredClone(base.data)});await browser.storage.local.set({profileVariants,activeProfileVariant:id,jamieProfile:base.data});location.reload();
});
document.getElementById('rename-variant').addEventListener('click',async()=>{
  const variant=profileVariants.find(item=>item.id===activeProfileVariant),name=prompt('Rename this variant.',variant.name);if(!name?.trim())return;
  variant.name=name.trim().slice(0,80);await browser.storage.local.set({profileVariants});renderVariants();status.textContent='Variant renamed.';
});
document.getElementById('delete-variant').addEventListener('click',async()=>{
  if(profileVariants.length<2)return;const variant=profileVariants.find(item=>item.id===activeProfileVariant);
  if(!confirm(`Delete only the profile variant “${variant.name}”? Its saved answers will be removed. Export a private backup first if needed.`))return;
  profileVariants=profileVariants.filter(item=>item!==variant);const next=profileVariants[0];await browser.storage.local.set({profileVariants,activeProfileVariant:next.id,jamieProfile:next.data});location.reload();
});
document.getElementById('theme').addEventListener('change',async event=>{
  const theme=FFF_THEME.apply(event.target.value), saved=await browser.storage.local.get('settings');
  await browser.storage.local.set({settings:{...saved.settings,theme}});
});
function downloadJson(data, filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
document.getElementById('export-profile').addEventListener('click',async()=>{
  try {
    await FFF_STORAGE.migrateStorage();
    const saved=await browser.storage.local.get(['jamieProfile','profileVariants','activeProfileVariant','learnedFields','ignoredFields','siteMappings','settings']);
    const exportedAt=new Date().toISOString(),settings={...FFF_STORAGE.normalizeSettings(saved.settings),lastProfileExportAt:exportedAt};
    downloadJson({format:FFF_STORAGE.EXPORT_FORMAT,schemaVersion:FFF_STORAGE.SCHEMA_VERSION,
      exportedAt,data:{jamieProfile:saved.jamieProfile||JAMIE_DEFAULTS,profileVariants:saved.profileVariants||[],activeProfileVariant:saved.activeProfileVariant,
        learnedFields:saved.learnedFields||[],ignoredFields:saved.ignoredFields||[],siteMappings:saved.siteMappings||[],settings}},
      `firefox-form-filler-profile-v${FFF_STORAGE.SCHEMA_VERSION}-${new Date().toISOString().slice(0,10)}.private.json`);
    await browser.storage.local.set({settings});document.getElementById('storage-health').textContent=document.getElementById('storage-health').textContent.replace(/last private export: [^.]*\./,`last private export: ${new Date(exportedAt).toLocaleString()}.`);
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
    document.getElementById('import-summary').textContent=`Validated schema ${FFF_STORAGE.SCHEMA_VERSION}: ${populated} populated fields, ${pendingImport.profileVariants.length} variants, ${pendingImport.learnedFields.length} remembered fields, ${pendingImport.ignoredFields.length} ignored fields, and ${pendingImport.siteMappings.length} mappings. Applying replaces those saved records and settings.`;
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
  const settings={bitwardenCompatibilityMode:document.getElementById('bitwarden-mode').checked,theme:FFF_THEME.normalize(document.getElementById('theme').value)};
  try {const prior=await browser.storage.local.get('settings');settings.lastProfileExportAt=FFF_STORAGE.normalizeSettings(prior.settings).lastProfileExportAt;
    profileVariants=profileVariants.map(item=>item.id===activeProfileVariant?{...item,data}:item);
    await browser.storage.local.set({jamieProfile:data,profileVariants,activeProfileVariant,settings,profileSchemaVersion:FFF_STORAGE.SCHEMA_VERSION});status.textContent='Saved. Your next preview will use this variant.';}
  catch {status.textContent='Could not save. Please try again.';}
});
init().then(() => {document.getElementById('save-profile').disabled=false;document.getElementById('export-profile').disabled=false;}).catch(()=>{status.textContent='Could not load or migrate the profile. Existing storage was not replaced.';});
