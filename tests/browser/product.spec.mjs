import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const content = readFileSync('dist/content/content.js', 'utf8');
const css = readFileSync('dist/content/player.css', 'utf8');
const userScript = readFileSync('userscript/claude-audio-controls.user.js', 'utf8');
const locales = JSON.parse(execFileSync('bun', ['-e', "import { LOCALES } from './src/shared/i18n/core'; console.log(JSON.stringify(Object.keys(LOCALES)))"], { encoding: 'utf8' }));
const fixture = `<!doctype html><html data-mode="dark"><head><meta charset="utf-8"><style>
:root{--cds-page-bg:#191919;--cds-fill-control:#2d2d2d;--cds-text-primary:#eee;--cds-text-secondary:#aaa;--cds-border-line:#393939;--cds-fill-accent:#257de0;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--cds-page-bg);color:var(--cds-text-primary);font:16px system-ui}header{padding:24px;border-bottom:1px solid #333;display:flex;justify-content:space-between}main{max-width:760px;margin:70px auto;padding:0 24px 220px;line-height:1.7}h1{font-size:28px;font-weight:500}.reply{margin-top:30px}button{font:inherit;color:inherit;background:#303030;border:1px solid #444;border-radius:8px;padding:10px;cursor:pointer}.composer{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);width:min(760px,calc(100% - 32px));border-radius:16px;border:1px solid #444;background:#262626;padding:20px;min-height:104px}[contenteditable]{outline:0;min-height:50px}.caption{font-size:13px;color:#999}header .caption{max-width:300px}
</style></head><body><header><span>Claude Audio Controls</span><span class="caption">Fictional demonstration · development preview</span></header><main><div class="caption">A quieter way to learn</div><h1>How does a tiny seed become a tree?</h1><section class="reply"><p>A seed carries the beginning of a tree and a small store of energy. When water, warmth, and air are right, it begins to grow.</p><p>The first root reaches into the soil. A small shoot then pushes toward the light. Its first leaves turn sunlight into the energy needed to grow.</p><p>Over time, the roots deepen, the trunk strengthens, and new branches form. What began as a seed becomes a living home for birds and insects.</p><div data-testid="message-actions"><button data-testid="action-bar-read-aloud" data-state="paused" aria-label="Read aloud">Read aloud</button></div></section></main><div class="composer" data-cds="ChatComposer"><div data-cds="ChatComposerEditor"><div data-testid="chat-input" role="textbox" aria-label="Write your prompt to Claude" contenteditable="true">Ask a follow-up</div></div></div></body></html>`;

async function setup(page, standalone = false, format = 'pcm_16000') {
  await page.route('https://claude.ai/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://claude.ai/chat/fictional-tree');
  await page.evaluate(async format => {
    window.fixtureFormat = format;
    window.fixtureChunks = Array.from({length:30},()=>new ArrayBuffer(32000));
    if (format === 'opus_48000_32') {
      window.fixtureChunks = [];
      const encoder = new AudioEncoder({output:packet=>{const bytes=new Uint8Array(packet.byteLength);packet.copyTo(bytes);window.fixtureChunks.push(bytes.buffer);},error:error=>{throw error;}});
      encoder.configure({codec:'opus',sampleRate:48000,numberOfChannels:1,bitrate:32000});
      for(let i=0;i<200;i++){const data=new AudioData({format:'f32-planar',sampleRate:48000,numberOfFrames:960,numberOfChannels:1,timestamp:i*20000,data:new Float32Array(960)});encoder.encode(data);data.close();}
      await encoder.flush(); encoder.close();
    }
    window.WebSocket = class extends EventTarget { constructor() { super(); window.nativeSocket = this; } };
    document.querySelector('[data-testid="action-bar-read-aloud"]').addEventListener('click', event => {
      const button = event.currentTarget;
      if (button.dataset.state === 'playing') { button.dataset.state = 'paused'; return; }
      button.dataset.state = 'playing'; new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format='+window.fixtureFormat);
      for (const data of window.fixtureChunks) nativeSocket.dispatchEvent(new MessageEvent('message', { data }));
      nativeSocket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'SpeechComplete', audio_sent_ms: window.fixtureFormat === 'pcm_16000' ? 30000 : 4000 }) }));
    });
  }, format);
  if (!standalone) await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: standalone ? userScript : content });
  await expect(page.locator('#claude-ra-floating-toggle')).toBeVisible();
  await page.getByTestId('action-bar-read-aloud').click();
  await expect(page.locator('[data-claude-ra-action]')).toBeVisible();
  await expect(page.locator('.claude-ra-download')).toBeEnabled();
}

for (const standalone of [false, true]) test(`${standalone ? 'userscript' : 'extension'} clears playback labels and position across chat navigation`, async ({ page }) => {
  await setup(page, standalone);
  await page.locator('.claude-ra-play').click();
  await page.locator('.claude-ra-seek-slider').fill('12');
  await expect(page.locator('.claude-ra-current')).toHaveText('0:12');
  for (const path of ['/new', '/chat/another-reply']) {
    await page.evaluate(path => history.pushState(null, '', path), path);
    await page.locator('#claude-ra-floating-toggle').click();
    await expect(page.locator('.claude-ra-current')).toHaveText('0:00');
    await expect(page.locator('.claude-ra-duration')).toHaveText('--:--');
    await expect(page.locator('.claude-ra-seek-slider')).toHaveValue('0');
    await expect(page.locator('.claude-ra-download')).toBeDisabled();
    await expect(page.locator('[data-claude-ra-action]')).toHaveCount(0);
    await expect(page.locator('#claude-ra-ready-toast')).toHaveCount(0);
    // Late frames from the previous reply cannot restore its position or controls.
    await page.evaluate(()=>nativeSocket.dispatchEvent(new MessageEvent('message',{data:new ArrayBuffer(32000)})));
    await expect(page.locator('.claude-ra-seek-slider')).toBeDisabled();
  }
});

test('help fits the viewport and native composer corners are shared by controls', async ({ page }) => {
  await page.setViewportSize({width:1280,height:800});
  await setup(page);
  await page.locator('.claude-ra-help-wrap > button').click();
  const help = page.locator('.claude-ra-help');
  await expect(help).toBeVisible();
  expect(await help.evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(help.locator('.claude-ra-help-links')).toHaveCSS('border-top-style','solid');
  await expect(help.getByRole('link')).toHaveCSS('text-decoration-line','underline');
  expect(await page.locator('#claude-ra-floating-toggle').evaluate(el => getComputedStyle(el,'::before').borderRadius)).toBe('16px');
  await expect(page.locator('.claude-ra-grip').first()).toHaveCSS('border-radius','16px');
  expect(await page.locator('.claude-ra-play').evaluate(el => getComputedStyle(el,'::before').inset)).toBe('4px');
});

test('opaque download toast and compact support actions with review held for store launch', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await page.addInitScript(()=>{
    const fresh = {status:'new',displays:0,shownAt:0,afterTime:0,afterUses:0};
    localStorage.setItem('claude-ra-engagement-v1',JSON.stringify({version:1,uses:4,enabled:true,lastShown:0,review:fresh,donation:fresh}));
    document.addEventListener('DOMContentLoaded',()=>document.documentElement.style.setProperty('--cds-fill-control','rgba(255,255,255,.12)'));
  });
  await setup(page,true);
  await expect(page.locator('#claude-ra-ready-toast')).toBeVisible();
  await expect(page.locator('#claude-ra-ready-toast')).toHaveCSS('background-color','rgb(25, 25, 25)');
  await page.screenshot({path:'build/download-ready-preview.png',animations:'disabled'});
  await page.evaluate(()=>window.postMessage({source:'claude-audio-controls-settings-bridge',type:'CLAUDE_RA_SETTINGS_UPDATE',settings:{notifyDownloadReady:false}},location.origin));
  await page.locator('.claude-ra-play').click();
  const prompt=page.locator('#claude-ra-support-prompt');
  await expect(prompt).toBeVisible({timeout:7000});
  await expect(prompt.locator('a,button')).toHaveCount(4);
  await expect(prompt.getByRole('button',{name:'Write a review'})).toBeDisabled();
  await expect(prompt.getByRole('link')).toHaveAttribute('href',/intent=suggestion/);
  expect(await prompt.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'build/support-prompt-preview.png',animations:'disabled'});
  await prompt.getByRole('button',{name:/later/i}).click();
  await expect(prompt).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('claude-ra-engagement-v1')).review.status)).toBe('later');
});

for (const standalone of [false, true]) test(`${standalone ? 'userscript' : 'extension'} player: docking, controls, typing and download`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, standalone);
  const slider = page.locator('#claude-ra-left input[type=range]');
  await expect(slider).toBeEnabled();
  const before = await slider.inputValue();
  await page.getByTestId('chat-input').click(); await page.keyboard.press('k');
  await expect(page.locator('[data-claude-ra-action]')).toHaveAttribute('data-state', 'playing');
  await page.locator('[data-claude-ra-action]').click();
  await expect(page.locator('[data-claude-ra-action]')).toHaveAttribute('data-state', 'paused');
  if (!standalone) {
    mkdirSync('assets/demo', { recursive: true });
    await page.screenshot({ path: 'assets/demo/composer-dock.png' });
    await page.evaluate(() => window.postMessage({ source: 'claude-audio-controls-settings-bridge', type: 'CLAUDE_RA_LAYOUT_UPDATE', layout: { version: 2, desktop: { preset: 'bottom-right', seekFirst: true }, narrow: { preset: 'composer', seekFirst: true } } }, location.origin));
    await expect(page.locator('#claude-ra-right')).toBeVisible();
    await page.screenshot({ path: 'assets/demo/corner-layout.png' });
  }
  const download = page.waitForEvent('download'); await page.locator('.claude-ra-download').click();
  expect((await download).suggestedFilename()).toMatch(/^claude-read-aloud-.*\.wav$/);
  expect(errors).toEqual([]);

});

test('all 67 languages, RTL, narrow viewport and theme replacement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  for (const language of locales) {
    await page.evaluate(language => window.postMessage({ source: 'claude-audio-controls-settings-bridge', type: 'CLAUDE_RA_SETTINGS_UPDATE', settings: { language } }, location.origin), language);
    await expect(page.locator('#claude-ra-left')).toHaveAttribute('lang', language);
    const box = await page.locator('#claude-ra-left').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
  }
  await page.evaluate(() => { document.documentElement.dataset.mode = 'light'; document.documentElement.style.setProperty('--cds-page-bg', '#faf9f5'); document.documentElement.style.setProperty('--cds-text-primary', '#252522'); });
  await expect.poll(() => page.locator('#claude-ra-left').evaluate(el => getComputedStyle(el).getPropertyValue("--claude-ra-bg").trim())).toBe('rgb(250, 249, 245)');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#claude-ra-right')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 420 });
  await expect(page.getByTestId('chat-input')).toBeVisible();
});

for (const standalone of [false, true]) test(`${standalone ? 'userscript' : 'extension'} seekbar avoids changing sidebars and artifact panels`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, standalone);
  await page.evaluate(() => {
    const sidebar = document.createElement('aside'); sidebar.dataset.testid = 'sidebar';
    sidebar.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:100vh;background:#202020';
    document.body.append(sidebar);
    const composer = document.querySelector('.composer');
    composer.style.left = 'calc(320px + (100% - 320px)/2)';
    composer.style.width = 'min(760px,calc(100% - 352px))';
  });
  const changePreset = preset => page.evaluate(preset => window.postMessage({ source: 'claude-audio-controls-settings-bridge', type: 'CLAUDE_RA_LAYOUT_UPDATE', layout: { version: 2, desktop: { preset, seekFirst: true }, narrow: { preset: 'composer', seekFirst: true } } }, location.origin), preset);
  const checkBounds = async (left, right) => {
    await expect(page.locator('#claude-ra-left')).toBeVisible();
    await expect.poll(async () => {
      const boxes = await Promise.all(['#claude-ra-left', '#claude-ra-right', '#claude-ra-floating-toggle'].map(id => page.locator(id).boundingBox()));
      return boxes.every(box => box && box.x >= left && box.x + box.width <= right);
    }).toBe(true);
  };
  for (const preset of ['composer', 'original', 'left', 'bottom-left', 'top-left', 'top-right']) {
    await changePreset(preset);
    await expect(page.locator('#claude-ra-floating-toggle')).toHaveAttribute('data-preset', preset);
    await checkBounds(328, 1268);
  }
  // Overlay width changes do not resize the composer. They must still trigger a layout update.
  await page.getByTestId('sidebar').evaluate(el => el.style.width = '400px');
  await checkBounds(408, 1268);
  await page.evaluate(() => {
    const panel = document.createElement('aside'); panel.dataset.testid = 'artifact-panel';
    panel.style.cssText = 'position:fixed;right:0;top:0;width:340px;height:100vh;background:#202020'; document.body.append(panel);
  });
  await changePreset('composer'); await checkBounds(408, 932);
  await page.getByTestId('sidebar').evaluate(el => el.hidden = true);
  await page.getByTestId('artifact-panel').evaluate(el => el.hidden = true);
  await page.locator('.composer').evaluate(el => { el.style.left = '50%'; el.style.width = 'min(760px,calc(100% - 32px))'; });
  await checkBounds(12, 1268);
  await expect.poll(async () => (await page.locator('#claude-ra-left').boundingBox()).x).toBeLessThan(408);
  // A collapsed sidebar keeps its layout width inside a clipped wrapper.
  await page.getByTestId('sidebar').evaluate(el => {
    el.hidden = false;
    const wrapper = document.createElement('div'); wrapper.dataset.testid = 'sidebar-clip';
    wrapper.style.cssText = 'position:fixed;inset:0 auto 0 0;width:48px;overflow:hidden';
    el.before(wrapper); wrapper.append(el); el.style.position = 'absolute';
  });
  await changePreset('bottom-left'); await checkBounds(56, 1268);
  await page.getByTestId('sidebar').evaluate(el => { document.body.append(el); el.style.position = 'fixed'; });
  await page.getByTestId('sidebar-clip').evaluate(el => el.remove());
  // The same bounds apply to a right-hand sidebar in an RTL conversation.
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    const sidebar = document.querySelector('[data-testid="sidebar"]'); sidebar.hidden = false; sidebar.style.left = 'auto'; sidebar.style.right = '0'; sidebar.style.width = '320px';
  });
  await changePreset('original'); await checkBounds(12, 952);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('sidebar').evaluate(el => el.style.width = '280px');
  await expect(page.locator('#claude-ra-left')).toBeHidden();
  await expect(page.locator('#claude-ra-floating-toggle')).toBeVisible();
  await expect.poll(async () => { const box = await page.locator('#claude-ra-floating-toggle').boundingBox(); return box.x + box.width; }).toBeLessThanOrEqual(102);
  await page.getByTestId('sidebar').evaluate(el => el.hidden = true);
  await expect(page.locator('#claude-ra-left')).toBeVisible();
  await page.getByTestId('sidebar').evaluate(el => el.hidden = false);
  await expect(page.locator('#claude-ra-left')).toBeHidden();
  await page.getByTestId('sidebar').evaluate(el => el.hidden = true);
  await expect(page.locator('#claude-ra-left')).toBeVisible();
});

for (const standalone of [false, true]) test(`${standalone ? 'userscript' : 'extension'} hover volume, chrome collisions and chat-only navigation`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page, standalone);
  await page.locator('.claude-ra-volume-btn').hover();
  await expect(page.locator('.claude-ra-volume-popover')).toBeVisible();
  await page.locator('.claude-ra-volume-slider').hover();
  await expect(page.locator('.claude-ra-volume-popover')).toBeVisible();
  await page.locator('.claude-ra-volume-slider').focus(); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('.claude-ra-volume-popover')).toBeHidden();
  await page.evaluate(() => {
    document.querySelector('header').remove();
    const toolbar = document.createElement('div'); toolbar.dataset.testid = 'chat-header';
    toolbar.setAttribute('role','toolbar'); toolbar.setAttribute('aria-label','Page tools');
    toolbar.style.cssText='position:fixed;top:0;left:0;width:100%;height:58px;background:#191919';
    toolbar.innerHTML='<button style="position:absolute;left:16px;top:6px">New chat</button><button style="position:absolute;right:16px;top:6px">Share</button>';
    document.body.append(toolbar);
  });
  for (const preset of ['top-left','top-right']) {
    await page.evaluate(preset => window.postMessage({source:'claude-audio-controls-settings-bridge',type:'CLAUDE_RA_LAYOUT_UPDATE',layout:{version:2,desktop:{preset,seekFirst:true},narrow:{preset:'composer',seekFirst:true}}},location.origin),preset);
    await expect(page.locator('#claude-ra-floating-toggle')).toHaveAttribute('data-preset',preset);
    for(const selector of ['#claude-ra-left','#claude-ra-right','#claude-ra-floating-toggle']) await expect.poll(async()=>(await page.locator(selector).boundingBox()).y).toBeGreaterThanOrEqual(66);
  }
  for (const path of ['/settings','/artifacts','/projects','/new#settings/general','/chat/fictional-tree#settings/general']) {
    await page.evaluate(path=>history.pushState({},'',path),path);
    await expect(page.locator('#claude-ra-floating-toggle')).toBeHidden();
    await expect(page.locator('#claude-ra-right')).toBeHidden();
  }
  await page.evaluate(()=>history.pushState({},'','/new'));
  await expect(page.locator('#claude-ra-floating-toggle')).toBeVisible();
});

test('one Download control offers valid WAV and native WebM for Opus', async ({page}) => {
  await page.setViewportSize({width:1280,height:800}); await setup(page,false,'opus_48000_32');
  expect(await page.locator('.claude-ra-download-wav').count()).toBe(0);
  await page.locator('.claude-ra-download').click();
  await expect(page.locator('.claude-ra-download-menu')).toBeVisible();
  const wav = page.waitForEvent('download'); await page.locator('[data-format="wav"]').click();
  expect((await wav).suggestedFilename()).toMatch(/\.wav$/);
  await expect(page.locator('.claude-ra-download')).toBeEnabled();
  await page.locator('.claude-ra-download').click();
  const webm=page.waitForEvent('download'); await page.locator('[data-format="native"]').click();
  expect((await webm).suggestedFilename()).toMatch(/\.webm$/);
});

test('loading on an artifact screen creates no player until navigation to chat', async ({page}) => {
  await page.route('https://claude.ai/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  await page.goto('https://claude.ai/artifacts'); await page.addStyleTag({content:css}); await page.addScriptTag({content});
  expect(await page.locator('#claude-ra-floating-toggle').count()).toBe(0);
  await page.evaluate(()=>history.pushState({},'','/new'));
  await expect(page.locator('#claude-ra-floating-toggle')).toBeVisible();
});

test('drag targets and handles use the same rounded rectangles as the player', async({page})=>{
  await page.setViewportSize({width:1280,height:900}); await page.emulateMedia({reducedMotion:'reduce'}); await setup(page);
  await expect(page.locator('#claude-ra-right .claude-ra-grip')).toHaveCSS('border-radius','16px');
  const launcher=await page.locator('#claude-ra-floating-toggle').boundingBox();
  await page.mouse.move(launcher.x+22,launcher.y+22); await page.mouse.down(); await page.mouse.move(launcher.x-60,launcher.y-60,{steps:4});
  await expect(page.locator('.claude-ra-drop-marker').first()).toHaveCSS('border-radius','16px');
  await expect(page.locator('.claude-ra-drop-shape[data-part="seek"]').first()).toHaveCSS('border-radius','16px');
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(page.locator('#claude-ra-drop-targets')).toHaveCount(0);
});
