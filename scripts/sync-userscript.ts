import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pkg from '../package.json';
declare const Bun: any;
const css = readFileSync('src/content/player.css', 'utf8');
const result = await Bun.build({ entrypoints: ['src/content/content.ts'], target: 'browser', format: 'iife', minify: true,
  define: { __USERSCRIPT__: 'true', __PLAYER_CSS__: JSON.stringify(css) } });
if (!result.success) throw new Error(String(result.logs));
const header = `// ==UserScript==
// @name         Claude Audio Controls
// @namespace    https://github.com/infoxica/claude-audio-controls
// @version      ${pkg.version}
// @description  Native Claude read-aloud playback controls. Development preview.
// @author       Infoxica
// @license      MIT; bundled Mediabunny MPL-2.0 (see THIRD_PARTY_NOTICES.md)
// @match        https://claude.ai/*
// @run-at       document-start
// @noframes
// @grant        none
// @sandbox      raw
// @downloadURL  https://github.com/infoxica/claude-audio-controls/releases/latest/download/claude-audio-controls.user.js
// @updateURL    https://github.com/infoxica/claude-audio-controls/releases/latest/download/claude-audio-controls.user.js
// @supportURL   https://github.com/infoxica/claude-audio-controls/issues
// ==/UserScript==
`;
const mount = `\n(()=>{if(window.top!==window)return;const mount=()=>{if(!document.getElementById('claude-ra-css')){const s=document.createElement('style');s.id='claude-ra-css';s.textContent=${JSON.stringify(css)};document.documentElement.append(s);}};if(document.documentElement)mount();else new MutationObserver((_,o)=>{if(document.documentElement){o.disconnect();mount();}}).observe(document,{childList:true,subtree:true});})();\n`;
mkdirSync('userscript', { recursive: true });
writeFileSync('userscript/claude-audio-controls.user.js', header + await result.outputs[0].text() + mount);
console.log('Generated userscript from the extension player and CSS.');
