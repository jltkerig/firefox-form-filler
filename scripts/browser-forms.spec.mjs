import {test, expect} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const defaultsPath = fileURLToPath(new URL('defaults.js', root));
const autofillPath = fileURLToPath(new URL('autofill.js', root));
const largeFixtureUrl = pathToFileURL(fileURLToPath(new URL('docs/large-form-test.html', root))).href;
const popupUrl = pathToFileURL(fileURLToPath(new URL('popup.html', root))).href;
const optionsUrl = pathToFileURL(fileURLToPath(new URL('options.html', root))).href;
const syntheticProfile = {
  profile: {
    firstName:'Test', lastName:'Applicant', fullName:'Test Applicant', email:'autofill@example.invalid',
    phone:'2025550147', phoneDeviceType:'Mobile', phoneCountryCode:'+1', city:'Example City',
    state:'New York', stateCode:'NY', country:'United States', countryCode:'US', linkedin:'https://example.invalid/profile',
    jobs:[], education:[]
  },
  optional: {authorizedToWork:'Yes', requiresSponsorship:'No', desiredHoursPerWeek:'40', earliestStartDate:'10/15/2026'}
};

async function injectAutofill(page, overrides={}) {
  await page.evaluate(({profile,overrides}) => {
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
      return originalAttachShadow.call(this, {...options, mode:'open'});
    };
    const listeners=[], messageListeners=[];
    const stored={jamieProfile:profile,learnedFields:[],ignoredFields:[],siteMappings:[],settings:{bitwardenCompatibilityMode:false},...overrides};
    globalThis.__storageWrites=[];
    globalThis.__sendContentMessage=message=>Promise.all(messageListeners.map(listener=>listener(message)));
    globalThis.browser={
      runtime:{sendMessage:async()=>true,onMessage:{addListener:listener=>messageListeners.push(listener)}},
      menus:{getTargetElement:id=>document.querySelector(`[data-menu-target="${id}"]`)},
      storage:{
        local:{get:async()=>structuredClone(stored),set:async values=>{Object.assign(stored,structuredClone(values));globalThis.__storageWrites.push(structuredClone(values));}},
        onChanged:{addListener:listener=>listeners.push(listener)}
      }
    };
  }, {profile:syntheticProfile,overrides});
  await page.addScriptTag({path:defaultsPath});
  await page.addScriptTag({path:autofillPath});
  await expect(page.locator('#jk-autofill-launcher')).toBeVisible();
}

async function review(page) {
  await page.locator('#jk-autofill-launcher').click();
  const panel=page.locator('#jk-review-host');
  await expect(panel.locator('h2')).toHaveText('Review before filling');
  return panel;
}

test('popup fits without scrollbars and saves the selected theme', async ({page}) => {
  await page.setViewportSize({width:420,height:650});
  await page.addInitScript(() => {
    const stored={settings:{bitwardenCompatibilityMode:true,theme:'light'},authConfig:{version:1}};
    globalThis.__themeWrites=[];
    globalThis.browser={
      runtime:{getManifest:()=>({version:'1.6.0'}),openOptionsPage:async()=>{},sendMessage:async()=>true},
      storage:{local:{
        get:async keys=>{
          const names=Array.isArray(keys)?keys:[keys];
          return Object.fromEntries(names.filter(name=>name in stored).map(name=>[name,stored[name]]));
        },
        set:async values=>{Object.assign(stored,values);globalThis.__themeWrites.push(structuredClone(values));}
      },session:{get:async()=>({authUnlocked:true})}},
      scripting:{getRegisteredContentScripts:async()=>[]},
      tabs:{query:async()=>[{id:1,url:'https://careers.example/apply'}]},
      permissions:{contains:async()=>false}
    };
  });
  await page.goto(popupUrl);
  await expect(page.locator('#status')).toHaveText('Autofill is not enabled for this website.');
  expect(await page.locator('#status').evaluate(status=>status.previousElementSibling?.id)).toBe('disable');
  await expect(page.locator('#settings')).not.toHaveAttribute('open','');
  await expect(page.locator('#settings summary')).toHaveText('Settings');
  await page.locator('#settings summary').click();
  await expect(page.locator('#theme')).toHaveValue('light');
  const size=await page.evaluate(()=>({
    scrollWidth:document.body.scrollWidth,scrollHeight:document.body.scrollHeight,
    clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight);
  await page.locator('#theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>globalThis.__themeWrites.at(-1).settings)).toEqual({bitwardenCompatibilityMode:true,theme:'dark'});
});

test('options shows active variants, mappings, and backup health',async({page})=>{
  await page.addInitScript(profile=>{const stored={profileSchemaVersion:4,jamieProfile:profile,
    profileVariants:[{id:'default',name:'Default',data:profile},{id:'technical',name:'Technical',data:profile}],activeProfileVariant:'technical',
    learnedFields:[],ignoredFields:[],siteMappings:[{key:'m1',question:'city',name:'city',elementId:'',placeholder:'',type:'text',host:'jobs.example',label:'City',section:'profile',profileKey:'city',updatedAt:1}],
    settings:{bitwardenCompatibilityMode:false,theme:'system',lastProfileExportAt:'2026-10-03T00:00:00.000Z'}};
    globalThis.browser={storage:{local:{get:async keys=>{const names=Array.isArray(keys)?keys:[keys];return Object.fromEntries(names.filter(key=>key in stored).map(key=>[key,structuredClone(stored[key])]))},set:async values=>Object.assign(stored,structuredClone(values))},session:{get:async()=>({authUnlocked:true})}}};
  },syntheticProfile);
  await page.goto(optionsUrl);
  await expect(page.locator('#profile-variant')).toHaveValue('technical');
  await expect(page.locator('#mapping-count')).toContainText('1 answer-free');
  await expect(page.locator('#storage-health')).toContainText('last private export');
});

test('fills recognized fields, preserves existing values, and skips credentials', async ({page}) => {
  await page.setContent(`<form>
    <label>First name <input name="firstName"></label>
    <label>Last name <input name="lastName"></label>
    <label>E-mail address <input type="email" name="email"></label>
    <label>Phone <input type="tel" name="phone"></label>
    <label>Earliest start date <input type="date" name="startDate"></label>
    <label>City <input name="city" value="Keep this"></label>
    <label>Password <input type="password" name="password"></label>
    <button type="submit">Submit</button>
  </form>`);
  await injectAutofill(page);
  const panel=await review(page);
  await expect(panel.locator('input[type="checkbox"]')).toHaveCount(6);
  const cityProposal=panel.locator('label').filter({hasText:'City'});
  await expect(cityProposal.getByText('Already contains an answer')).toBeVisible();
  await expect(cityProposal.locator('input[type="checkbox"]')).not.toBeChecked();
  await expect(panel.getByText(/confidence ·/).first()).toBeVisible();
  await panel.locator('#apply').click();
  await expect(page.locator('[name="firstName"]')).toHaveValue('Test');
  await expect(page.locator('[name="lastName"]')).toHaveValue('Applicant');
  await expect(page.locator('[name="email"]')).toHaveValue('autofill@example.invalid');
  await expect(page.locator('[name="phone"]')).toHaveValue('2025550147');
  await expect(page.locator('[name="startDate"]')).toHaveValue('2026-10-15');
  await expect(page.locator('[name="city"]')).toHaveValue('Keep this');
  await expect(page.locator('[name="password"]')).toHaveValue('');
});

test('answer-free site mapping fills from the active profile and explains the match', async ({page}) => {
  await page.route('https://mapped.example/**',route=>route.fulfill({contentType:'text/html',body:'<label>Applicant municipality <input name="municipality-code"></label>'}));
  await page.goto('https://mapped.example/apply');
  await injectAutofill(page);
  page.once('dialog',dialog=>dialog.accept('profile.city'));
  await page.locator('[name="municipality-code"]').focus();
  await page.locator('#jk-field-memory-button').click();
  await page.locator('[data-memory="map"]').click();
  const panel=await review(page);
  await expect(panel.getByText('High confidence · Site mapping → profile.city')).toBeVisible();
  await panel.locator('#apply').click();
  await expect(page.locator('[name="municipality-code"]')).toHaveValue('Example City');
});

test('reports when a website reverts a filled value', async ({page}) => {
  await page.setContent('<label>First name <input name="firstName"></label>');
  await page.locator('[name="firstName"]').evaluate(el=>el.addEventListener('input',()=>{el.value='Website value';}));
  await injectAutofill(page);const panel=await review(page);await panel.locator('#apply').click();
  await expect(panel.getByText(/Website reverted or changed/)).toBeVisible();
});

test('can explicitly replace an incorrect resume answer', async ({page}) => {
  await page.setContent('<label>City <input name="city" value="Incorrect Resume City"></label>');
  await injectAutofill(page);
  const panel=await review(page), proposal=panel.locator('label').filter({hasText:'City'});
  await proposal.locator('input[type="checkbox"]').check();
  await panel.locator('#apply').click();
  await expect(page.locator('[name="city"]')).toHaveValue('Example City');
});

test('right-click menu can ignore, restore, and save a field', async ({page}) => {
  await page.route('https://careers.example/**',route=>route.fulfill({contentType:'text/html',body:'<label>City <input name="city" value="Private City" data-menu-target="17"></label>'}));
  await page.goto('https://careers.example/apply');
  await injectAutofill(page);
  expect((await page.evaluate(()=>globalThis.__sendContentMessage({type:'field-menu-state',targetElementId:17})))[0]).toMatchObject({supported:true,ignored:false,savable:true});
  await page.evaluate(()=>globalThis.__sendContentMessage({type:'set-ignore-field',targetElementId:17,ignored:true}));
  const ignored=await page.evaluate(()=>globalThis.__storageWrites.at(-1).ignoredFields[0]);
  expect(ignored.host).toBe('careers.example');
  expect(ignored.name).toBe('city');
  expect(JSON.stringify(ignored)).not.toContain('Private City');
  const panel=await review(page);
  await expect(panel.locator('input[type="checkbox"]')).toHaveCount(0);
  expect((await page.evaluate(()=>globalThis.__sendContentMessage({type:'field-menu-state',targetElementId:17})))[0].ignored).toBe(true);
  await page.evaluate(()=>globalThis.__sendContentMessage({type:'set-ignore-field',targetElementId:17,ignored:false}));
  expect(await page.evaluate(()=>globalThis.__storageWrites.at(-1).ignoredFields)).toEqual([]);
  await page.evaluate(()=>globalThis.__sendContentMessage({type:'save-field',targetElementId:17}));
  const learned=await page.evaluate(()=>globalThis.__storageWrites.at(-1).learnedFields[0]);
  expect(learned.answer).toBe('Private City');
  expect(learned.host).toBe('careers.example');
});

test('saved large-form fixture stays bounded and reports scan limits', async ({page}) => {
  await page.goto(largeFixtureUrl);
  await page.getByRole('button',{name:'Generate stress fixture'}).click();
  await expect(page.getByRole('status')).toContainText('1500 fields');
  await injectAutofill(page);
  const panel=await review(page);
  await expect(panel.getByText(/Safety scan limit reached/)).toBeVisible();
});

test('restores the launcher after a single-page app replaces the body', async ({page}) => {
  await page.setContent('<main>Initial route</main>');
  await injectAutofill(page);
  await page.evaluate(()=>{document.body.innerHTML='<main>New route</main>';});
  await expect(page.locator('#jk-autofill-launcher')).toBeVisible({timeout:2000});
});

for (const target of [
  {name:'W3C labeled controls',url:'https://www.w3.org/WAI/tutorials/forms/labels/'},
  {name:'httpbin demo form',url:'https://httpbin.org/forms/post',fill:true}
]) {
  test(`loads safely on public ${target.name} without submission`, async ({page}) => {
    await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:30000});
    await injectAutofill(page);
    const panel=await review(page);
    await expect(panel.locator('section')).toBeVisible();
    expect(await page.locator('form').count()).toBeGreaterThan(0);
    if(target.fill) {
      expect(await panel.locator('input[type="checkbox"]').count()).toBeGreaterThanOrEqual(2);
      await panel.locator('#apply').click();
      await expect(page.locator('[name="custtel"]')).toHaveValue('2025550147');
      await expect(page.locator('[name="custemail"]')).toHaveValue('autofill@example.invalid');
    }
    expect(page.url()).toBe(target.url);
  });
}
