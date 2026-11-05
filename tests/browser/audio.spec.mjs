import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('bun', ['build', 'tests/browser/fixture.ts', '--target=browser', '--outfile=build/audio-fixture.js']);
const bundle = readFileSync('build/audio-fixture.js', 'utf8');
test.beforeEach(async ({ page }) => {
  await page.route('https://claude.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body><button data-testid="action-bar-read-aloud" data-state="paused">Read aloud</button></body></html>' }));
  await page.goto('https://claude.ai/chat/fictional-test');
  await page.addScriptTag({ content: bundle });
});

for (const format of ['pcm_16000', 'opus_48000_32']) test(`${format}: streaming, early pause, seek, speed, complete download and independent decode`, async ({ page }) => {
  await page.evaluate(async format => {
    window.player = new StreamPlayer('fixture', format);
    const pcm = new Int16Array(16000 * 3);
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i * Math.PI * 2 * 440 / 16000) * 4000;
    window.frames = [];
    if (format === 'pcm_16000') {
      // Odd frame boundaries deliberately split a 16-bit sample.
      const bytes = new Uint8Array(pcm.buffer); for (let i = 0; i < bytes.length; i += 6401) frames.push(bytes.slice(i, i + 6401).buffer);
    } else {
      const encoder = new AudioEncoder({ output: chunk => { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); frames.push(bytes.buffer); }, error: e => { throw e; } });
      encoder.configure({ codec: 'opus', sampleRate: 16000, numberOfChannels: 1, bitrate: 32000 });
      const data = new AudioData({ format: 's16', sampleRate: 16000, numberOfChannels: 1, numberOfFrames: pcm.length, timestamp: 0, data: pcm });
      encoder.encode(data); data.close(); await encoder.flush(); encoder.close();
    }
    player.pause();
    const half = Math.floor(frames.length / 2);
    frames.slice(0, half).forEach(f => player.enqueue(f)); window.half = half;
  }, format);
  await expect.poll(() => page.evaluate(() => player.state.buffered.end)).toBeGreaterThan(.5);
  expect(await page.evaluate(() => player.state.duration)).toBeNull();
  expect(await page.evaluate(() => player.state.status)).toBe('paused');
  await page.evaluate(() => { player.changeRate(1.5); player.changeVolume(.4); player.seek(.4); void player.play(); });
  await expect.poll(() => page.evaluate(() => player.state.position)).toBeGreaterThan(.5);
  await page.evaluate(() => { player.pause(); player.play(); player.pause(); frames.slice(half).forEach(f => player.enqueue(f)); player.finish(); });
  await expect.poll(() => page.evaluate(() => player.state.capabilities.download)).toBe(true);
  const result = await page.evaluate(async () => {
    const state = player.state, blob = await player.download();
    const decoder = new AudioContext(); const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    const result = { state, type: blob.type, duration: decoded.duration, peak: Math.max(...decoded.getChannelData(0).subarray(0, 16000)) };
    await decoder.close(); player.dispose(); return result;
  });
  expect(result.type).toBe(format === 'pcm_16000' ? 'audio/wav' : 'audio/webm');
  expect(result.duration).toBeGreaterThanOrEqual(2.99); expect(result.duration).toBeLessThan(3.08);
  expect(result.peak).toBeGreaterThan(.05); expect(result.state.rate).toBe(1.5); expect(result.state.volume).toBe(.4);
});

test('malformed frames and memory limits stop ownership', async ({ page }) => {
  const errors = await page.evaluate(async () => {
    const a = new StreamPlayer('bad', 'opus_48000_32'); a.enqueue(new Uint8Array([0x9b, 0]).buffer);
    const b = new StreamPlayer('limit', 'pcm_16000', 100000); b.enqueue(new ArrayBuffer(20000));
    await new Promise(r => setTimeout(r, 300)); return [a.state, b.state];
  });
  expect(errors.every(state => state.status === 'error' && !state.capabilities.download)).toBe(true);
});

test('capture pauses native before owned playback and restores it on disconnect', async ({ page }) => {
  await page.evaluate(async () => {
    window.sockets = []; window.nativeFrames = 0; window.doubleAudio = false;
    window.WebSocket = class extends EventTarget { constructor() { super(); sockets.push(this); } };
    window.capture = new ClaudePlayback(media => { window.owned = media; }, message => { window.failure = message; }); capture.install();
    const button = document.querySelector('button');
    button.addEventListener('click', () => {
      if (button.dataset.state === 'playing') { button.dataset.state = 'paused'; return; }
      button.dataset.state = 'playing';
      window.socket = new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000');
      socket.addEventListener('message', () => { if (button.dataset.state === 'playing') nativeFrames++; if (owned && !owned.paused && button.dataset.state === 'playing') doubleAudio = true; });
    });
    await new Promise(r => setTimeout(r, 100));
  });
  await page.locator('button').click();
  await page.evaluate(() => { for (let i = 0; i < 10; i++) socket.dispatchEvent(new MessageEvent('message', { data: new ArrayBuffer(6400) })); });
  await expect(page.locator('[data-claude-ra-action]')).toHaveCount(1);
  expect(await page.evaluate(() => doubleAudio)).toBe(false);
  expect(await page.locator('[data-testid="action-bar-read-aloud"]').getAttribute('data-state')).toBe('paused');
  await page.evaluate(() => socket.dispatchEvent(new Event('close')));
  await expect(page.locator('[data-testid="action-bar-read-aloud"]')).toBeVisible();
  expect(await page.evaluate(() => owned)).toBeNull();
  expect(await page.evaluate(() => failure)).toContain('native Read aloud');
});

test('replacement rejects old frames and navigation restores native controls', async ({page}) => {
  await page.evaluate(async () => {
    window.sockets = []; window.WebSocket = class extends EventTarget { constructor() { super(); sockets.push(this); } };
    window.capture = new ClaudePlayback(media => { window.owned = media; }, message => { window.failure = message; }); capture.install();
    const first = document.querySelector('button'); const second = first.cloneNode(true); document.body.append(second);
    for (const button of [first,second]) button.addEventListener('click', () => {
      if (button.dataset.state === 'playing') {button.dataset.state='paused'; return;}
      button.dataset.state='playing'; new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000');
    });
    await new Promise(r=>setTimeout(r,100));
  });
  await page.getByTestId('action-bar-read-aloud').nth(0).click();
  await page.evaluate(() => sockets[0].dispatchEvent(new MessageEvent('message',{data:new ArrayBuffer(32000)})));
  await expect(page.locator('[data-claude-ra-action]')).toHaveCount(1);
  await page.evaluate(()=>{window.oldMedia=owned;});
  await page.getByTestId('action-bar-read-aloud').nth(1).click();
  await page.evaluate(() => {
    sockets[0].dispatchEvent(new MessageEvent('message',{data:new ArrayBuffer(320000)}));
    sockets[0].dispatchEvent(new MessageEvent('message',{data:'{"type":"SpeechComplete"}'}));
    sockets[1].dispatchEvent(new MessageEvent('message',{data:new ArrayBuffer(64000)}));
    sockets[1].dispatchEvent(new MessageEvent('message',{data:'{"type":"SpeechComplete"}'}));
  });
  await expect.poll(()=>page.evaluate(()=>capture.state.capabilities.download)).toBe(true);
  expect(await page.evaluate(()=>capture.state.duration)).toBeCloseTo(2,1);
  expect(await page.evaluate(()=>oldMedia.paused)).toBe(true);
  await expect(page.getByTestId('action-bar-read-aloud').nth(0)).toBeVisible();
  await page.evaluate(()=>history.pushState(null,'','/chat/fictional-replacement'));
  await expect(page.locator('[data-claude-ra-action]')).toHaveCount(0);
  expect(await page.evaluate(()=>owned)).toBeNull();
  await expect(page.getByTestId('action-bar-read-aloud').nth(1)).toBeVisible();
});

test('unknown native format leaves the original action usable with a compatibility message', async ({page})=>{
  await page.evaluate(()=>{
    window.WebSocket=class extends EventTarget {};
    window.capture=new ClaudePlayback(media=>{window.owned=media;}, message=>{window.failure=message;}); capture.install();
    document.querySelector('button').addEventListener('click',()=>new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=unknown'));
  });
  await page.getByTestId('action-bar-read-aloud').click();
  await expect(page.getByTestId('action-bar-read-aloud')).toBeVisible();
  expect(await page.evaluate(()=>failure)).toContain('native Read aloud');
  expect(await page.locator('[data-claude-ra-action]').count()).toBe(0);
});
