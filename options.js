const container = document.getElementById('fields');
const status = document.getElementById('status');
const controls = [];
const jobControls = [], schoolControls = [];
const friendly = {
  ssnLastFour:'Last four digits of Social Security Number',
  authorizedToWork:'Legally authorized to work', requiresSponsorship:'Requires sponsorship',
  desiredHoursPerWeek:'Preferred hours per week', referralSource:'How you heard about the job',
  currentlyAnEmployee:'Currently an employee of the hiring company',
  meetsListedMinimumRequirements:'Meets all listed minimum requirements (review for every job)',
  veteranStatus:'Veteran status', phoneDeviceType:'Phone device type', zipCode:'ZIP / postal code'
};
const booleanKeys = new Set(['authorizedToWork','requiresSponsorship','willingToRelocate','willingToTravel','previouslyEmployedByCompany','previouslyAppliedToCompany','nonCompeteAgreement','conflictOfInterest','currentlyAnEmployee','meetsListedMinimumRequirements']);
function labelFor(key) {return friendly[key] || key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());}
function field(parent,key,value) {
  const label = document.createElement('label'); label.textContent=labelFor(key);
  const el=document.createElement(booleanKeys.has(key)?'select':['summary','skills','description'].includes(key)?'textarea':'input');
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
  const saved=await browser.storage.local.get('jamieProfile');
  const data=saved.jamieProfile||JAMIE_DEFAULTS;
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
document.getElementById('profile').addEventListener('submit',async event=>{
  event.preventDefault();
  const data={profile:{},optional:{}};
  for(const {name,key,el} of controls)data[name][key]=el.value.trim();
  if(data.optional.ssnLastFour && !/^\d{4}$/.test(data.optional.ssnLastFour)){status.textContent='Enter exactly four digits for the SSN ending, or leave it blank.';return;}
  data.profile.jobs=jobControls.map(({fields})=>Object.fromEntries(Object.entries(fields).map(([key,el])=>[key,el.value.trim()])));
  data.profile.education=schoolControls.map(({fields})=>Object.values(fields).map(el=>el.value.trim()));
  try {await browser.storage.local.set({jamieProfile:data});status.textContent='Saved. Your next preview will use these answers.';}
  catch {status.textContent='Could not save. Please try again.';}
});
init().then(() => {document.getElementById('save-profile').disabled=false;}).catch(()=>{status.textContent='Could not load the profile. Close and reopen this page.';});
