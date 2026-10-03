import {test, expect} from '@playwright/test';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = new URL('../', import.meta.url);
const defaultsPath = fileURLToPath(new URL('defaults.js', root));
const autofillPath = fileURLToPath(new URL('autofill.js', root));
const largeFixtureUrl = pathToFileURL(fileURLToPath(new URL('docs/large-form-test.html', root))).href;
const popupUrl = pathToFileURL(fileURLToPath(new URL('popup.html', root))).href;
const syntheticProfile = {
  profile: {
    firstName:'Test', lastName:'Applicant', fullName:'Test Applicant', email:'autofill@example.invalid',
    phone:'2025550147', phoneDeviceType:'Mobile', phoneCountryCode:'+1', city:'Example City',
    state:'New York', stateCode:'NY', country:'United States', countryCode:'US', linkedin:'https://example.invalid/profile',
    jobs:[], education:[]
  },
  optional: {authorizedToWork:'Yes', requiresSponsorship:'No', desiredHoursPerWeek:'40', earliestStartDate:'10/15/2026'}
};

async function injectAutofill(page) {
  await page.evaluate(profile => {
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
      return originalAttachShadow.call(this, {...options, mode:'open'});
    };
    const listeners=[];
    globalThis.browser={
      runtime:{sendMessage:async()=>true},
      storage:{
        local:{get:async()=>({jamieProfile:profile,learnedFields:[],settings:{bitwardenCompatibilityMode:false}}),set:async()=>{}},
        onChanged:{addListener:listener=>listeners.push(listener)}
      }
    };
  }, syntheticProfile);
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
  await page.setViewportSize({width:420,height:600});
  await page.addInitScript(() => {
    const stored={settings:{bitwardenCompatibilityMode:true,theme:'light'}};
    globalThis.__themeWrites=[];
    globalThis.browser={
      runtime:{getManifest:()=>({version:'1.4.3'}),openOptionsPage:async()=>{}},
      storage:{local:{
        get:async keys=>{
          const names=Array.isArray(keys)?keys:[keys];
          return Object.fromEntries(names.filter(name=>name in stored).map(name=>[name,stored[name]]));
        },
        set:async values=>{Object.assign(stored,values);globalThis.__themeWrites.push(structuredClone(values));}
      }},
      scripting:{getRegisteredContentScripts:async()=>[]},
      tabs:{query:async()=>[{id:1,url:'https://careers.example/apply'}]},
      permissions:{contains:async()=>false}
    };
  });
  await page.goto(popupUrl);
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
  await expect(panel.locator('input[type="checkbox"]')).toHaveCount(5);
  await panel.locator('#apply').click();
  await expect(page.locator('[name="firstName"]')).toHaveValue('Test');
  await expect(page.locator('[name="lastName"]')).toHaveValue('Applicant');
  await expect(page.locator('[name="email"]')).toHaveValue('autofill@example.invalid');
  await expect(page.locator('[name="phone"]')).toHaveValue('2025550147');
  await expect(page.locator('[name="startDate"]')).toHaveValue('2026-10-15');
  await expect(page.locator('[name="city"]')).toHaveValue('Keep this');
  await expect(page.locator('[name="password"]')).toHaveValue('');
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
