import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderQuest,questState,questTiming,evaluateChoiceEvents} from '../styles/choice-quest/scene.mjs';

test('random-access state is identical after forward and reverse evaluation',()=>{
 const frames=Array.from({length:540},(_,i)=>i),results=new Map(frames.map(frame=>[frame,JSON.stringify(questState({frame}))]));
 for(const frame of frames.reverse())assert.equal(JSON.stringify(questState({frame})),results.get(frame));
});
test('choice state changes at insertion, never at cursor highlight',()=>{
 for(let frame=0;frame<270;frame++){const s=questState({frame});assert.equal(s.inventory,1);assert.equal(s.cellOwner,'courier');assert.equal(s.terminalPowered,false);assert.equal(s.bridge,0);assert.equal(s.beacon,false);}
 const s=questState({frame:270});assert.equal(s.inventory,0);assert.equal(s.cellOwner,'terminal');assert.equal(s.terminalPowered,true);assert.equal(s.bridge,0);
});
test('hand and cell contact are equal at insertion and initial support',()=>{
 for(let frame=270;frame<280;frame++){const s=questState({frame});assert.equal(s.cellX,502);assert.equal(s.cellY,418);assert.equal(s.palmX,s.cellX);assert.equal(s.palmY,s.cellY);}
});
test('bridge finishes before character crosses; lamp waits until arrival',()=>{
 for(let frame=0;frame<540;frame++){const s=questState({frame});if(s.heroX>466)assert.equal(s.bridge,1);if(s.beacon)assert.equal(s.heroX,938);assert.ok(s.bridge>=0&&s.bridge<=1);}
 const s=questState({frame:539});assert.equal(s.bridge,1);assert.equal(s.inventory,0);assert.equal(s.beacon,true);assert.equal(s.heroX,938);
});
test('alternate branch preserves resource and never implies success',()=>{
 for(let frame=195;frame<540;frame++){const s=questState({frame,branch:'wait'});assert.equal(s.inventory,1);assert.equal(s.terminalPowered,false);assert.equal(s.bridge,0);assert.equal(s.heroX,466);assert.equal(s.beacon,false);assert.equal(s.cellOwner,'courier');assert.equal(s.phase,'wait');}
});
test('branches have identical visible frames until selection',()=>{
 for(const frame of [0,90,150,194])assert.equal(renderQuest({frame,branch:'repair'}),renderQuest({frame,branch:'wait'}));
 assert.notEqual(renderQuest({frame:539,branch:'repair'}),renderQuest({frame:539,branch:'wait'}));
});
test('late selection shifts only downstream causal timing by 15 frames',()=>{
 const a=questTiming(),b=questTiming(7);for(const k of Object.keys(a))assert.ok(Math.abs(b[k]-a[k]-.5)<1e-9);
 for(let frame=0;frame<195;frame++)assert.equal(renderQuest({frame}),renderQuest({frame,selectSec:7}));
 for(let frame=195;frame<525;frame++){const a=questState({frame}),b=questState({frame:frame+15,selectSec:7});for(const k of ['inventory','terminalPowered','bridge','heroX','beacon','cellOwner','cellX','cellY','palmX','palmY'])typeof a[k]==='number'?assert.ok(Math.abs(a[k]-b[k])<1e-9,k+' at '+frame):assert.equal(a[k],b[k],k+' at '+frame);}
});
test('typing reveals prefixes while the stable story meaning is preserved',()=>{
 for(const frame of [91,95,105,120,150]){const s=questState({frame});assert.ok(s.message.startsWith(s.caption));}
 assert.ok(questState({frame:95}).caption.length<questState({frame:120}).caption.length);
});
test('captions can be hidden without changing story state or geometry',()=>{
 const a=renderQuest({frame:300}),b=renderQuest({frame:300,showCaptions:false});assert.ok(a.includes(questState({frame:300}).caption));assert.ok(!b.includes('<text x="60" y="596"'));assert.equal(a.match(/aria-label="courier"[\s\S]*?<\/g>/)[0],b.match(/aria-label="courier"[\s\S]*?<\/g>/)[0]);
});
test('generic event ledger is immutable, seekable, and reusable',()=>{
 const initial={keys:2,door:false};const events=[{id:'unlock',atFrame:12,set:{keys:1,door:true}}];
 assert.deepEqual(evaluateChoiceEvents({frame:11,initial,events}),initial);assert.deepEqual(evaluateChoiceEvents({frame:12,initial,events}),{keys:1,door:true});assert.deepEqual(initial,{keys:2,door:false});assert.ok(Object.isFrozen(evaluateChoiceEvents({frame:15,initial,events})));
});
test('ledger rejects contradictory or unsafe event declarations',()=>{
 const initial={a:0};for(const events of [[{id:'x',atFrame:1,set:{b:2}}],[{id:'x',atFrame:2,set:{a:1}},{id:'x',atFrame:3,set:{a:2}}],[{id:'x',atFrame:3,set:{a:1}},{id:'y',atFrame:1,set:{a:2}}],[{id:'x',atFrame:2,set:{a:NaN}}]])assert.throws(()=>evaluateChoiceEvents({frame:3,initial,events}));
});
test('ledger rejects mutable nested initial values and incompatible state types',()=>{
 for(const initial of [{nested:{value:1}},{array:[1]},{a:NaN},{a:null}])assert.throws(()=>evaluateChoiceEvents({frame:0,initial,events:[]}));
 assert.throws(()=>evaluateChoiceEvents({frame:1,initial:{a:1},events:[{id:'x',atFrame:1,set:{a:'one'}}]}));
});
test('frame-rate limits and end-of-film state remain coherent',()=>{
 for(const fps of [.05,.1,.5])assert.throws(()=>questState({frame:10,fps}));
 for(const fps of [1,24,29.97,30,60]){const s=questState({frame:Math.ceil(18*fps)-1,fps});assert.ok(s.t>=0);assert.equal(s.inventory,0);assert.equal(s.terminalPowered,true);assert.equal(s.beacon,true);}
});
test('invalid frame, timing, choice, and fake portrait layout fail loudly',()=>{
 for(const args of [{frame:-1},{frame:1.5},{frame:NaN},{frame:0,fps:0},{frame:0,branch:'unknown'},{frame:0,selectSec:8}])assert.throws(()=>questState(args));
 assert.throws(()=>renderQuest({frame:0,width:720,height:1280}));assert.ok(renderQuest({frame:0,width:640,height:360}).includes('width="640" height="360"'));
});
