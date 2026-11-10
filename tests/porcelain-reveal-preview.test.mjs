import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('preview exactly regenerates from current scene and is self-contained',()=>{const f=path.join(root,'examples/porcelain-reveal/preview.html'),old=fs.readFileSync(f,'utf8');assert.equal(spawnSync(process.execPath,[path.join(root,'examples/porcelain-reveal/build-preview.mjs')]).status,0);assert.equal(fs.readFileSync(f,'utf8'),old);assert.doesNotMatch(old,/<script[^>]+src=|<link[^>]+href=/)});
test('play, pause, seek, text toggle, ratio, reset and replay controls (DOM stub, not browser)',()=>{
 const html=fs.readFileSync(path.join(root,'examples/porcelain-reveal/preview.html'),'utf8'),source=html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
 const els=Object.fromEntries(['view','play','reset','layout','text','frame','time'].map(k=>[k,{value:k==='layout'?'landscape':0,checked:true}]));let next,now=0;
 vm.runInNewContext(source,{document:{getElementById:k=>els[k]},requestAnimationFrame:fn=>next=fn,performance:{now:()=>now}});
 assert.match(els.view.innerHTML,/viewBox="0 0 1280 720"/);els.play.onclick();assert.equal(els.play.textContent,'暂停');now=2000;next(now);assert.equal(els.frame.value,60);els.play.onclick();now=3000;next(now);assert.equal(els.frame.value,60);
 els.frame.value=300;els.frame.oninput();assert.equal(els.play.textContent,'播放');assert.equal(els.time.textContent,'10.00s');els.text.checked=false;els.text.onchange();assert.doesNotMatch(els.view.innerHTML,/<text /);els.layout.value='portrait';els.layout.onchange();assert.match(els.view.innerHTML,/data-layout="portrait-native"/);
 els.reset.onclick();assert.equal(els.frame.value,0);els.frame.value=419;els.frame.oninput();els.play.onclick();now=3033.34;next(now);assert.equal(els.frame.value,1);assert.equal(els.play.textContent,'暂停');
});
test('prepare copies final source, refuses existing targets and repository/symlink targets',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'porcelain-prepare-')),target=path.join(parent,'new'),script=path.join(root,'examples/porcelain-reveal/prepare.mjs');const run=t=>spawnSync(process.execPath,[script,t]);
 assert.equal(run(target).status,0);assert.deepEqual(fs.readFileSync(path.join(target,'src/style/scene.mjs')),fs.readFileSync(path.join(root,'styles/porcelain-reveal/scene.mjs')));assert.notEqual(run(target).status,0);assert.notEqual(run(path.join(root,'internal')).status,0);const link=path.join(parent,'link');fs.symlinkSync(root,link);assert.notEqual(run(path.join(link,'inside')).status,0);fs.rmSync(parent,{recursive:true,force:true});
});
