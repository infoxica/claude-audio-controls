import { chromium } from '@playwright/test';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const output = 'assets/store';
mkdirSync(output, {recursive:true});
const logo = readFileSync('public/icons/brand.svg','utf8');
writeFileSync(`${output}/logo-300.png`,new Resvg(logo,{fitTo:{mode:'width',value:300}}).render().asPng());
copyFileSync('assets/demo/settings.png',`${output}/screenshots/settings.png`);
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name,width,height] of [['small-tile',440,280],['marquee',1400,560]]) {
  await page.setViewportSize({width,height});
  await page.setContent(`<!doctype html><html><style>*{box-sizing:border-box}body{margin:0;background:#191919;color:#faf9f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}.brand{max-width:90%;display:flex;gap:${width>500?40:20}px;align-items:center}svg{width:${width>500?160:72}px;flex:none}h1{font-size:${width>500?66:29}px;line-height:1.15;font-weight:550;letter-spacing:-.035em;margin:0 0 18px}p{font-size:${width>500?26:14}px;color:#c4c1b9;margin:0}span{color:#d97757}</style><div class="brand">${logo}<div><h1>Claude<br>Audio Controls</h1><p>Pause <span>·</span> Seek <span>·</span> Speed <span>·</span> Download</p></div></div></html>`);
  await page.screenshot({path:`${output}/${name}.png`});
}
await browser.close();
console.log('Created original store logo, tiles and settings screenshot.');
