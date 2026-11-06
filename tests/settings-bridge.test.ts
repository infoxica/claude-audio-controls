import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const code = readFileSync(process.env.BRIDGE_UNDER_TEST || 'dist/content/settings-bridge.js','utf8');
function setup() {
  const listeners: Record<string, Function> = {}, messages: any[] = [];
  let invalid=false, apiCalls=0;
  const event={addListener:()=>{}};
  const access=()=>{apiCalls++; if(invalid) throw new Error('Extension context invalidated.');};
  const runtime:any={sendMessage:()=>{access();return Promise.resolve({});},onMessage:event};
  Object.defineProperty(runtime,'id',{get:()=>invalid?undefined:'test-extension'});
  const storage={sync:{get:()=>{access();return Promise.resolve({});}},local:{get:()=>{access();return Promise.resolve({});},set:()=>{access();return Promise.resolve();}},onChanged:event};
  const window:any={addEventListener:(type:string,callback:Function)=>listeners[type]=callback,postMessage:(message:any)=>messages.push(message)};
  runInNewContext(code,{window,chrome:{runtime,storage},location:{origin:'https://claude.ai'},document:{visibilityState:'visible'},console});
  return {messages,invalidate:()=>invalid=true,calls:()=>apiCalls,focus:()=>listeners.focus(),send:(data:any)=>listeners.message({origin:'https://claude.ai',source:window,data})};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('invalidated bridge ignores theme, settings, layout and engagement events without throwing or resetting settings',async()=>{
  const bridge=setup();await settle();
  expect(bridge.messages.some(m=>m.type==='CLAUDE_RA_SETTINGS_UPDATE')).toBe(true);
  bridge.invalidate();const calls=bridge.calls(),count=bridge.messages.length;
  for(const message of [
    {type:'CLAUDE_RA_THEME_UPDATE',theme:{chatTheme:'blue',isDark:true,updatedAt:1}},
    {type:'CLAUDE_RA_OPEN_SETTINGS'}, {type:'CLAUDE_RA_SETTINGS_REQUEST'}, {type:'CLAUDE_RA_LAYOUT_REQUEST'},
  ]) expect(()=>bridge.send({source:'claude-audio-controls-settings-bridge',...message})).not.toThrow();
  expect(()=>bridge.send({source:'claude-audio-controls-engagement',type:'request',id:'test',action:{type:'get'}})).not.toThrow();
  bridge.focus(); await settle();
  expect(bridge.calls()).toBe(calls);expect(bridge.messages.length).toBe(count);
});
