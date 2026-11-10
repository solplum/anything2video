import {test} from 'node:test';import assert from 'node:assert/strict';
import {SCENARIOS,DUEL,renderDuel,duelState,duelTiming,duelEvents,resolveDuel,validateScenario,describeCard,outcomeCaption} from '../styles/card-conflict/scene.mjs';
const copy=s=>JSON.parse(JSON.stringify(s));
test('default choices produce causal, different objective and resource results',()=>{
 assert.deepEqual(resolveDuel({choice:'brace'}),{energy:0,guard:0,blocked:3,damage:0,integrity:3,reward:0});
 assert.deepEqual(resolveDuel({choice:'rush'}),{energy:1,guard:0,blocked:0,damage:3,integrity:0,reward:1});
 assert.deepEqual(resolveDuel({scenario:SCENARIOS.greenhouse,choice:'warm'}),{energy:1,guard:0,blocked:2,damage:0,integrity:2,reward:0});
 assert.deepEqual(resolveDuel({scenario:SCENARIOS.greenhouse,choice:'harvest'}),{energy:2,guard:0,blocked:0,damage:2,integrity:0,reward:1});
});
test('selection alone cannot pay for an action or affect the objective',()=>{
 for(const scenario of Object.values(SCENARIOS))for(const card of scenario.choices)for(let frame=0;frame<180;frame++){
  const s=duelState({frame,scenario,choice:card.id});assert.equal(s.energy,scenario.energy);assert.equal(s.guard,0);assert.equal(s.integrity,scenario.maxIntegrity);assert.equal(s.reward,0);assert.equal(s.impacted,false);
 }
});
test('payment and defense happen at card commitment, never earlier',()=>{
 const a=duelState({frame:179}),b=duelState({frame:180});assert.equal(a.energy,2);assert.equal(b.energy,0);assert.equal(b.guard,3);assert.equal(b.integrity,3);assert.equal(b.cardProgress,1);
});
test('damage and shield depletion wait until opposition contact',()=>{
 for(const choice of ['brace','rush']){assert.equal(duelState({frame:299,choice}).integrity,3);assert.equal(duelState({frame:299,choice}).damage,0);}
 assert.equal(duelState({frame:299}).guard,3);assert.equal(duelState({frame:300}).guard,0);assert.equal(duelState({frame:300,choice:'rush'}).integrity,0);
});
test('random access evaluation matches forward, reverse and repeated seeks',()=>{
 for(const scenario of Object.values(SCENARIOS))for(const card of scenario.choices){const values=Array.from({length:DUEL.frames},(_,frame)=>JSON.stringify(duelState({frame,scenario,choice:card.id})));for(let frame=479;frame>=0;frame--)assert.equal(JSON.stringify(duelState({frame,scenario,choice:card.id})),values[frame]);}
});
test('every outcome conserves resources and never causes negative state',()=>{
 for(const scenario of Object.values(SCENARIOS))for(const card of scenario.choices)for(let frame=0;frame<480;frame++){const s=duelState({frame,scenario,choice:card.id});assert.ok(s.energy>=0&&s.guard>=0&&s.integrity>=0);if(s.committed)assert.equal(s.energy+card.cost,scenario.energy);if(s.impacted){assert.equal(s.blocked+s.damage,scenario.threat.power);assert.equal(s.guard+s.blocked,card.guard);assert.equal(s.integrity,Math.max(0,scenario.maxIntegrity-s.damage));}}
});
test('counterfactual renders are identical until actual choice',()=>{
 for(const frame of [0,30,90,119])assert.equal(renderDuel({frame,choice:'brace'}),renderDuel({frame,choice:'rush'}));assert.notEqual(renderDuel({frame:120,choice:'brace'}),renderDuel({frame:120,choice:'rush'}));
});
test('labels-hidden render has no text and preserves objective geometry',()=>{
 for(const choice of ['brace','rush'])for(const frame of [0,180,299,300,479]){const a=renderDuel({frame,choice}),b=renderDuel({frame,choice,showCaptions:false});assert.doesNotMatch(b,/<text\b/);assert.equal(a.match(/<g aria-label="objective-art"[\s\S]*?<\/g>/)[0],b.match(/<g aria-label="objective-art"[\s\S]*?<\/g>/)[0]);}
 assert.notEqual(renderDuel({frame:479,choice:'brace',showCaptions:false}),renderDuel({frame:479,choice:'rush',showCaptions:false}));
});
test('physical objective artwork changes only at impact',()=>{
 const art=frame=>renderDuel({frame,choice:'rush'}).match(/<g aria-label="objective-art"[\s\S]*?<\/g>/)[0];assert.equal(art(180),art(299));assert.notEqual(art(299),art(300));assert.equal(art(300),art(479));
});
test('late selection shifts all downstream rule events without frame-rate coupling',()=>{
 for(const fps of [1,24,29.97,30,60,120]){const times=duelTiming({fps,selectSec:5});const options={fps,selectSec:5,choice:'rush'};assert.equal(duelState({frame:times.commit-1,...options}).energy,2);assert.equal(duelState({frame:times.commit,...options}).energy,1);assert.equal(duelState({frame:times.impact-1,...options}).integrity,3);assert.equal(duelState({frame:times.impact,...options}).integrity,0);assert.equal(duelState({frame:times.end,...options}).phase,'result');}
});
test('scenario inputs and outputs remain immutable',()=>{
 const scenario=copy(SCENARIOS.lighthouse),before=JSON.stringify(scenario);duelState({frame:479,scenario});duelEvents({scenario});assert.equal(JSON.stringify(scenario),before);assert.ok(Object.isFrozen(duelState({frame:3})));assert.ok(Object.isFrozen(duelTiming()));assert.ok(Object.isFrozen(SCENARIOS.lighthouse.choices[0]));
});
test('custom data changes rules, visible copy and result, not just styling',()=>{
 const scenario=copy(SCENARIOS.lighthouse);scenario.choices[0].guard=1;scenario.choices[0].cost=1;
 const state=duelState({frame:479,scenario});assert.equal(state.energy,1);assert.equal(state.integrity,1);assert.equal(state.damage,2);assert.match(describeCard(scenario.choices[0]),/抵挡 1/);assert.match(outcomeCaption(scenario,state),/承受 2 点损伤/);assert.match(renderDuel({frame:479,scenario}),/防护 \+1/);
 scenario.threat.power=5;const lost=duelState({frame:479,scenario});assert.equal(lost.integrity,0);assert.match(outcomeCaption(scenario,lost),/灯塔失守/);
});
test('event ledger is ordered, explicit, and frozen',()=>{
 const events=duelEvents();assert.deepEqual(events.map(e=>e.frame),[120,180,300]);assert.deepEqual(events.map(e=>e.kind),['decision','payment-and-effect','opposition-resolution']);assert.ok(Object.isFrozen(events));events.forEach(e=>assert.ok(Object.isFrozen(e)));
});
test('render dimensions reject unsupported portrait instead of squashing it',()=>{
 assert.throws(()=>renderDuel({frame:0,width:720,height:1280}));assert.throws(()=>renderDuel({frame:0,width:0,height:0}));assert.match(renderDuel({frame:0,width:640,height:360}),/width="640" height="360"/);
});
test('invalid frames, time, choices and incompatible data fail clearly',()=>{
 for(const args of [{frame:-1},{frame:.5},{frame:NaN},{frame:0,fps:0},{frame:0,fps:121},{frame:0,selectSec:2},{frame:0,selectSec:Infinity},{frame:0,choice:'x'}])assert.throws(()=>duelState(args));
 for(const mutate of [s=>s.energy=-1,s=>s.choices[0].cost=99,s=>s.threat.power=NaN,s=>s.choices[0].guard=-1,s=>s.choices[1].id=s.choices[0].id,s=>s.objectiveArt='unknown',s=>s.theme.gold='url(http://evil)',s=>s.choices=[]]){const s=copy(SCENARIOS.lighthouse);mutate(s);assert.throws(()=>validateScenario(s));}
});
test('user copy is XML escaped; no external assets or nondeterministic APIs',()=>{
 const s=copy(SCENARIOS.lighthouse);s.name='<script>x</script>';s.choices[0].tag='A & B';const svg=renderDuel({frame:150,scenario:s});assert.doesNotMatch(svg,/<script/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/A &amp; B/);assert.doesNotMatch(svg,/<image|href=/);
});

test('excess protection is retained and outcome copy does not claim it is exhausted',()=>{const scenario=copy(SCENARIOS.lighthouse);scenario.choices[0].guard=4;const state=duelState({frame:479,scenario});assert.equal(state.guard,1);assert.match(outcomeCaption(scenario,state),/余下 1 点防护/);});

test('the reward-only branch never captions itself as building protection',()=>{const svg=renderDuel({frame:240,choice:'rush'});assert.match(svg,/付出补给，物资已经收回/);assert.doesNotMatch(svg,/先付出资源，再建立防护/);assert.doesNotMatch(svg,/aria-label="shield"/);assert.match(svg,/aria-label="reward-art"/);});

test('projectile tip reaches the real shield or target boundary before impact, without a spatial jump',()=>{
 for(const scenario of Object.values(SCENARIOS))for(const choice of scenario.choices){
  const expected=choice.guard?747:scenario.objectiveArt==='lighthouse'?677:705;
  let previous=Infinity;
  for(let frame=270;frame<300;frame++){const svg=renderDuel({frame,scenario,choice:choice.id}),m=svg.match(/aria-label="incoming-threat" data-tip-x="([\d.]+)" data-contact-x="([\d.]+)"/);assert.ok(m);const tip=+m[1];assert.equal(+m[2],expected);assert.ok(tip>expected);assert.ok(tip<=previous);previous=tip;assert.doesNotMatch(svg,/aria-label="impact"/);}
  assert.ok(previous-expected<1);const hit=renderDuel({frame:300,scenario,choice:choice.id});assert.match(hit,new RegExp('aria-label="impact" data-contact-x="'+expected+'"'));assert.doesNotMatch(hit,/aria-label="incoming-threat"/);
 }
});
