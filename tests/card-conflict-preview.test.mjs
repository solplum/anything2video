import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {spawnSync} from 'node:child_process';
import {renderDuel,SCENARIOS} from '../styles/card-conflict/scene.mjs';
function preview(){
 const html=fs.readFileSync(new URL('../examples/card-conflict/preview.html',import.meta.url),'utf8');
 const node=()=>({value:'',checked:true,innerHTML:'',textContent:'',dataset:{},children:[],attributes:{},append(b){this.children.push(b)},replaceChildren(){this.children=[]},querySelectorAll(){return this.children},setAttribute(k,v){this.attributes[k]=v}});
 const elements=Object.fromEntries(['stage','variant','captions','choices','status','play','scrub','time','ledger','reset','back','next'].map(id=>[id,node()]));elements.variant.value='lighthouse';const events={};let tick;
 const document={hidden:false,getElementById:id=>elements[id],createElement:node,addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],{document,requestAnimationFrame:fn=>tick=fn});
 return {elements,document,events,tick:ms=>tick(ms),choose:i=>elements.choices.children[i].onclick()};
}
test('generated standalone preview is current and source-free',()=>{
 const file=new URL('../examples/card-conflict/preview.html',import.meta.url);const old=fs.readFileSync(file,'utf8');const r=spawnSync(process.execPath,[new URL('../examples/card-conflict/build-preview.mjs',import.meta.url).pathname]);assert.equal(r.status,0,r.stderr?.toString());assert.equal(fs.readFileSync(file,'utf8'),old);assert.doesNotMatch(old,/<script[^>]+src=|<link[^>]+href=|fetch\(/);const p=preview();assert.equal(p.elements.stage.innerHTML,renderDuel({frame:0}));
});
test('uncommitted playback pauses before decision and cannot skip to a result',()=>{
 const p=preview();p.elements.play.onclick();p.tick(1000);p.tick(11000);assert.equal(p.elements.scrub.value,119);assert.equal(p.elements.play.textContent,'播放');p.elements.scrub.value='479';p.elements.scrub.oninput();assert.equal(p.elements.scrub.value,119);assert.match(p.elements.ledger.textContent,/"energy": 2/);
});
test('choosing locks the card, repeated clicks cannot change or pay twice',()=>{
 const p=preview();p.choose(1);assert.equal(p.elements.scrub.value,120);p.choose(0);p.elements.scrub.value='300';p.elements.scrub.oninput();assert.equal(p.elements.stage.innerHTML,renderDuel({frame:300,choice:'rush'}));assert.ok(p.elements.choices.children.every(b=>b.disabled));assert.match(p.elements.ledger.textContent,/"energy": 1/);
});
test('seeking backwards preserves locked choice and recomputes resource state',()=>{
 const p=preview();p.choose(0);p.elements.scrub.value='479';p.elements.scrub.oninput();assert.match(p.elements.ledger.textContent,/"energy": 0/);p.elements.scrub.value='179';p.elements.scrub.oninput();assert.match(p.elements.ledger.textContent,/"energy": 2/);p.elements.next.onclick();assert.equal(p.elements.scrub.value,180);assert.match(p.elements.ledger.textContent,/"energy": 0/);p.elements.back.onclick();assert.equal(p.elements.scrub.value,179);
});
test('restart and switching stories clears decision and stale rewards',()=>{
 const p=preview();p.choose(1);p.elements.scrub.value='479';p.elements.scrub.oninput();p.elements.reset.onclick();assert.equal(p.elements.scrub.value,0);assert.ok(p.elements.choices.children.every(b=>!b.disabled));p.elements.variant.value='greenhouse';p.elements.variant.onchange();assert.equal(p.elements.stage.innerHTML,renderDuel({frame:0,scenario:SCENARIOS.greenhouse,choice:'warm'}));p.choose(0);p.elements.scrub.value='479';p.elements.scrub.oninput();assert.match(p.elements.ledger.textContent,/"energy": 1/);assert.match(p.elements.ledger.textContent,/"integrity": 2/);
});
test('labels-hidden mode has no words and preserves current frame',()=>{
 const p=preview();p.choose(0);p.elements.scrub.value='285';p.elements.scrub.oninput();p.elements.captions.checked=false;p.elements.captions.onchange();assert.equal(p.elements.scrub.value,285);assert.equal(p.elements.stage.innerHTML,renderDuel({frame:285,showCaptions:false}));assert.doesNotMatch(p.elements.stage.innerHTML,/<text\b/);
});
test('replay retains choice, backgrounding pauses, and resuming does not jump',()=>{
 const p=preview();p.choose(0);p.elements.scrub.value='479';p.elements.scrub.oninput();p.elements.play.onclick();assert.equal(p.elements.scrub.value,0);p.tick(1000);p.tick(2000);assert.equal(p.elements.scrub.value,30);p.document.hidden=true;p.events.visibilitychange();assert.equal(p.elements.play.textContent,'播放');p.tick(99000);assert.equal(p.elements.scrub.value,30);p.document.hidden=false;p.elements.play.onclick();p.tick(100000);p.tick(101000);assert.equal(p.elements.scrub.value,60);
});
test('prepare helper creates isolated adapters and refuses to overwrite',()=>{
 const os=process.env.TMPDIR||'/tmp',base=fs.mkdtempSync(os+'/card-conflict-test-'),out=base+'/project';const prepare=new URL('../examples/card-conflict/prepare.mjs',import.meta.url).pathname;
 const good=spawnSync(process.execPath,[prepare,out]);assert.equal(good.status,0,good.stderr?.toString());for(const f of ['styles/card-conflict/scene.mjs','styles/card-conflict/engine.mjs','styles/card-conflict/scenarios.mjs','examples/card-conflict/Root.tsx','package.json','tsconfig.json'])assert.ok(fs.existsSync(out+'/'+f),f);const before=fs.readFileSync(out+'/package.json','utf8');const repeat=spawnSync(process.execPath,[prepare,out]);assert.notEqual(repeat.status,0);assert.equal(fs.readFileSync(out+'/package.json','utf8'),before);
 const inside=spawnSync(process.execPath,[prepare,new URL('../examples/card-conflict/forbidden',import.meta.url).pathname]);assert.notEqual(inside.status,0);
});
