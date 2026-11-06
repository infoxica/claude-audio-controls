// Render the production player over a repeatable, fictional Claude-style chat.
import { chromium, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
const store = process.argv.includes('--store');
const output = store ? 'assets/store/screenshots' : 'assets/demo/layouts';
const page = await browser.newPage({viewport:store ? {width:1280,height:800} : {width:1600,height:900}});
await page.emulateMedia({reducedMotion:'reduce'});
await page.route('https://claude.ai/**', route=>route.fulfill({contentType:'text/html',body:readFileSync('scripts/layout-demo.html','utf8')}));
await page.goto('https://claude.ai/chat/layout-preview');
await page.evaluate(()=>{
  window.WebSocket = class extends EventTarget { constructor(){super();window.demoSocket=this;} };
  document.querySelector('[data-testid="action-bar-read-aloud"]').onclick=event=>{
    const button=event.currentTarget;
    if(button.dataset.state==='playing'){button.dataset.state='paused';return;}
    button.dataset.state='playing';
    const socket=new WebSocket('wss://claude.ai/api/ws/text_to_speech/text_stream?output_format=pcm_16000');
    socket.dispatchEvent(new MessageEvent('message',{data:new ArrayBuffer(16000*2*30)}));
    socket.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'SpeechComplete'})}));
  };
});
await page.addStyleTag({content:readFileSync('dist/content/player.css','utf8')});
await page.addScriptTag({content:readFileSync('dist/content/content.js','utf8')});
await page.evaluate(()=>window.postMessage({source:'claude-audio-controls-settings-bridge',type:'CLAUDE_RA_SETTINGS_UPDATE',settings:{notifyDownloadReady:false}},location.origin));
await page.getByTestId('action-bar-read-aloud').click();
await expect(page.locator('.claude-ra-download')).toBeEnabled();
await page.locator('.claude-ra-play').click();
await page.locator('.claude-ra-seek-slider').fill('12');
mkdirSync(output,{recursive:true});
for(const preset of store ? ['composer','bottom-right','left'] : ['composer','original','bottom-left','bottom-right','top-left','top-right','left','right']) {
  for(const seekFirst of store ? [true] : [true,false]) {
    await page.evaluate(({preset,seekFirst})=>window.postMessage({source:'claude-audio-controls-settings-bridge',type:'CLAUDE_RA_LAYOUT_UPDATE',layout:{version:2,desktop:{preset,seekFirst},narrow:{preset:'composer',seekFirst}}},location.origin),{preset,seekFirst});
    await expect(page.locator('#claude-ra-floating-toggle')).toHaveAttribute('data-preset',preset);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:`${output}/${preset}-${seekFirst?'seek':'controls'}.png`,animations:'disabled'});
  }
}
if (!store) {
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${output}/mobile.png`,animations:'disabled'});
}
console.log(`Captured player screenshots in ${output}.`);
await browser.close();
