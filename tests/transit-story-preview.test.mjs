import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {spawnSync} from 'node:child_process';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
test('self-contained preview exactly regenerates from current core',()=>{const file=path.join(root,'examples/transit-story/preview.html'),before=fs.readFileSync(file,'utf8');const result=spawnSync('node',[path.join(root,'examples/transit-story/build-preview.mjs')]);assert.equal(result.status,0);assert.equal(fs.readFileSync(file,'utf8'),before);assert.doesNotMatch(before,/<script[^>]+src=|<link[^>]+href=/);});
test('preview control logic supports play, pause, seek, branch, ratio and replay (DOM stub, not browser QA)',()=>{
 const html=fs.readFileSync(path.join(root,'examples/transit-story/preview.html'),'utf8'),script=html.match(/<script type="module">([\s\S]*)<\/script>/)[1].replace(/^export /gm,'');
 const elements=Object.fromEntries(['screen','play','seek','variant','ratio','readout'].map(id=>[id,{value:id==='variant'?'normal':id==='ratio'?'landscape':'0',listeners:{},addEventListener(kind,fn){this.listeners[kind]=fn;}}]));let queued,now=0,portrait=false;
 const context=vm.createContext({document:{getElementById:id=>elements[id],body:{classList:{toggle:(_c,value)=>portrait=value}}},performance:{now:()=>now},requestAnimationFrame:fn=>queued=fn});
 vm.runInContext(script,context);assert.match(elements.screen.innerHTML,/viewBox="0 0 1280 720"/);
 elements.play.listeners.click();assert.equal(elements.play.textContent,'暂停');now=6000;queued(now);assert.equal(elements.seek.value,'180');assert.match(elements.screen.innerHTML,/1 \/ 2 到站/);
 elements.play.listeners.click();now=7000;queued(now);assert.equal(elements.seek.value,'180');
 elements.seek.value='400';elements.seek.listeners.input();assert.equal(elements.play.textContent,'播放');assert.match(elements.screen.innerHTML,/data-station="open"/);
 elements.variant.value='blocked';elements.variant.listeners.change();assert.doesNotMatch(elements.screen.innerHTML,/data-station="open"/);
 elements.ratio.value='portrait';elements.ratio.listeners.change();assert.equal(portrait,true);assert.match(elements.screen.innerHTML,/viewBox="0 0 720 1280"/);
 elements.seek.value='539';elements.seek.listeners.input();elements.play.listeners.click();assert.equal(elements.seek.value,'0');assert.equal(elements.play.textContent,'暂停');
});
