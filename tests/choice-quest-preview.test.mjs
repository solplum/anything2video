import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {renderQuest} from '../styles/choice-quest/scene.mjs';
function preview(){
 const html=fs.readFileSync(new URL('../examples/choice-quest/preview.html',import.meta.url),'utf8');
 const elements=Object.fromEntries(['stage','play','restart','branch','captions','late','seek','time'].map(id=>[id,{value:'',checked:false,innerHTML:'',textContent:''}]));
 elements.branch.value='repair';elements.captions.checked=true;elements.seek.value='0';
 const events={},document={hidden:false,getElementById:id=>elements[id],addEventListener:(event,fn)=>events[event]=fn};let tick,now=0;
 vm.runInNewContext(html.match(/<script type="module">([\s\S]*)<\/script>/)[1],{document,performance:{now:()=>now},requestAnimationFrame:fn=>tick=fn});
 return {elements,events,document,runAt(n){now=n;tick(n)}};
}
test('standalone generated preview uses the exact current frame core',()=>{
 const p=preview();assert.equal(p.elements.stage.innerHTML,renderQuest({frame:0}));
 p.elements.play.onclick();p.runAt(10000);assert.equal(p.elements.stage.innerHTML,renderQuest({frame:300}));
 p.elements.play.onclick();const image=p.elements.stage.innerHTML;p.runAt(12000);assert.equal(p.elements.stage.innerHTML,image);
});
test('repeated play/restart, seek, branch change, and background pause stay coherent',()=>{
 const p=preview();p.elements.restart.onclick();p.runAt(5000);assert.equal(p.elements.seek.value,150);
 p.elements.seek.value='539';p.elements.seek.oninput();assert.equal(p.elements.play.textContent,'播放');
 p.elements.branch.value='wait';p.elements.branch.onchange();assert.equal(p.elements.stage.innerHTML,renderQuest({frame:539,branch:'wait'}));
 p.elements.play.onclick();assert.equal(p.elements.seek.value,0);p.runAt(8000);assert.equal(p.elements.seek.value,90);
 p.document.hidden=true;p.events.visibilitychange();assert.equal(p.elements.play.textContent,'播放');
 const saved=p.elements.stage.innerHTML;p.runAt(16000);assert.equal(p.elements.stage.innerHTML,saved);
 p.elements.restart.onclick();assert.equal(p.elements.seek.value,0);
});
test('caption and timing controls recompute selected frame without playback side effects',()=>{
 const p=preview();p.elements.seek.value='300';p.elements.seek.oninput();p.elements.captions.checked=false;p.elements.captions.onchange();p.elements.late.checked=true;p.elements.late.onchange();
 assert.equal(p.elements.stage.innerHTML,renderQuest({frame:300,selectSec:7,showCaptions:false}));assert.equal(p.elements.play.textContent,'播放');
});
