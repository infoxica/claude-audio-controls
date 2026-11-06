import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

async function tour(page) {
  await page.addInitScript(() => {
    window.tourSaved = {};
    Object.defineProperty(window, 'chrome', { configurable:true, value:{storage:{local:{set:async values => { window.tourSaved=values; sessionStorage.setItem('tourSaved', JSON.stringify(values)); }}}} });
  });
  await page.route('https://claude.ai/**', route => route.fulfill({body:'Claude destination'}));
  await page.route('http://127.0.0.1:4173/**', route => {
    const file=resolve('dist', '.'+new URL(route.request().url()).pathname);
    if (!file.startsWith(resolve('dist')+ '/' ) && !file.startsWith(resolve('dist')+'\\')) return route.abort();
    if (!existsSync(file)) return route.fulfill({status:404});
    return route.fulfill({body:readFileSync(file), contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream'});
  });
  await page.goto('http://127.0.0.1:4173/src/tour/index.html');
  await expect(page.locator('#progress')).toHaveText('1 of 5');
}

test('feature tour supports keyboard, back, completion, and narrow screens', async ({page}) => {
  await tour(page);
  await expect(page.getByRole('button',{name:'Back',exact:true})).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('h1')).toHaveText('Listen at your own pace');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#progress')).toHaveText('1 of 5');
  await page.emulateMedia({colorScheme:'dark'});
  await page.screenshot({path:'build/tour-dark.png'});
  await page.setViewportSize({width:320,height:640});
  for(let i=0;i<5;i++) {
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('#next')).toBeInViewport();
    if(i<4) await page.locator('#next').click();
  }
  await page.emulateMedia({colorScheme:'light'});
  await page.screenshot({path:'build/tour-mobile.png'});
  await expect(page.locator('#next')).toHaveText('Open Claude');
  await page.locator('#next').click();
  await expect(page).toHaveURL('https://claude.ai/new');
  await page.goBack();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tourSaved'))['claude-ra-tour-v1'])).toBe('completed');
});

test('skip persists the choice and opens Claude', async ({page}) => {
  await tour(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('https://claude.ai/new');
  await page.goBack();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tourSaved'))['claude-ra-tour-v1'])).toBe('skipped');
});

test('userscript contains no tour and installation does not open it on updates', async () => {
  expect(readFileSync('userscript/claude-audio-controls.user.js','utf8')).not.toContain('claude-ra-tour-v1');
  const {runInNewContext}=await import('node:vm');
  let installed; const opened=[];
  const event={addListener:()=>{}};
  const chrome={
    runtime:{onInstalled:{addListener:fn=>installed=fn},onStartup:event,onMessage:event,getURL:path=>'chrome-extension://test/'+path,getPlatformInfo:async()=>({os:'win'}),setUninstallURL:async()=>{}},
    tabs:{onRemoved:event,create:async tab=>opened.push(tab)},commands:{onCommand:event},
    storage:{local:{get:async()=>({})},sync:{get:async()=>({})},onChanged:event},
  };
  runInNewContext(readFileSync('dist/background/worker.js','utf8'),{chrome,console,URL,URLSearchParams,navigator:{language:'en'}});
  installed({reason:'update'});
  expect(opened).toHaveLength(0);
  installed({reason:'install'});
  expect(opened).toEqual([{url:'chrome-extension://test/src/tour/index.html'}]);
});
