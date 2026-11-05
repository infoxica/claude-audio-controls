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

async function setup(page, standalone = false) {
  await page.route('https://claude.ai/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://claude.ai/chat/fictional-tree');
  await page.evaluate(() => {
    window.WebSocket = class extends EventTarget { constructor() { super(); window.nativeSocket = this; } };
    document.querySelector('[data-testid="action-bar-read-aloud"]').addEventListener('click', event => {
      const button = event.currentTarget;
      if (button.dataset.state === 'playing') { button.dataset.state = 'paused'; return; }
      button.dataset.state = 'playing'; new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000');
      for (let i = 0; i < 30; i++) nativeSocket.dispatchEvent(new MessageEvent('message', { data: new ArrayBuffer(32000) }));
      nativeSocket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'SpeechComplete', audio_sent_ms: 30000 }) }));
    });
  });
  if (!standalone) await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: standalone ? userScript : content });
  await expect(page.locator('#claude-ra-floating-toggle')).toBeVisible();
  await page.getByTestId('action-bar-read-aloud').click();
  await expect(page.locator('[data-claude-ra-action]')).toBeVisible();
  await expect(page.locator('.claude-ra-download')).toBeEnabled();
}

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
