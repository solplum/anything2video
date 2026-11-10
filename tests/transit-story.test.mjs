import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {makeOpeningStory,compileTransit,transitState,renderTransit,layoutFor,pointOnRoute,routePoints} from '../styles/transit-story/scene.mjs';
const graph=()=>makeOpeningStory();
test('all prerequisites gate release; first arrival reveals interchange but never onward route',()=>{
 const g=graph(),schedule=compileTransit(g);assert.equal(schedule.nodes.join.firstAt,5.7);assert.equal(schedule.nodes.join.readyAt,9.2);assert.equal(schedule.edges['join-open'].startAt,10.3);
 const s=transitState(g,180);assert.equal(s.nodes.join.visible,true);assert.equal(s.nodes.join.ready,false);assert.equal(s.nodes.join.arrivedCount,1);assert.equal(s.nodes.join.waiting,true);assert.equal(s.edges['join-open'].started,false);
 assert.equal(transitState(g,275).nodes.join.ready,false);assert.equal(transitState(g,276).nodes.join.ready,true);assert.equal(transitState(g,308).edges['join-open'].started,false);assert.equal(transitState(g,309).edges['join-open'].started,true);
});
test('delaying a source propagates across dependent stations, transfer and finale, not unrelated route',()=>{
 const base=compileTransit(graph()),late=compileTransit(makeOpeningStory({delay:2.3}));
 assert.equal(late.nodes.guests.readyAt,base.nodes.guests.readyAt);assert.equal(late.nodes.join.firstAt,base.nodes.join.firstAt);assert.equal(late.nodes.join.readyAt,11.5);assert.equal(late.nodes.open.readyAt,14.6);
 assert.equal(transitState(makeOpeningStory({delay:2.3}),370).complete,false);assert.equal(transitState(makeOpeningStory({delay:2.3}),438).complete,true);
});
test('blocked inbound line never satisfies the transfer, never reveals destination or a success glyph',()=>{
 const g=makeOpeningStory({blocked:true}),s=transitState(g,10000);
 assert.equal(s.edges['lights-join'].progress,.55);assert.equal(s.edges['lights-join'].arrived,false);assert.equal(s.edges['lights-join'].blocked,true);assert.equal(s.nodes.join.waiting,true);assert.equal(s.nodes.open.visible,false);assert.equal(s.complete,false);
 assert.doesNotMatch(renderTransit({frame:539,blocked:true}),/data-station="open"|data-edge="join-open"/);
});
test('graph timing is data-driven rather than tied to the demonstration node IDs',()=>{
 const g={nodes:[{id:'brief',label:'Brief',startAt:1},{id:'approval',label:'Approval',startAt:4},{id:'release',label:'Release',dwell:.5},{id:'done',label:'Done'}],edges:[{id:'one',from:'brief',to:'release',line:'people',duration:2},{id:'two',from:'approval',to:'release',line:'venue',duration:1},{id:'three',from:'release',to:'done',line:'joined',duration:3}]};
 const s=compileTransit(g);assert.equal(s.nodes.release.firstAt,3);assert.equal(s.nodes.release.readyAt,5);assert.equal(s.nodes.done.readyAt,8.5);
 const l={w:1280,h:720,portrait:false,positions:{brief:[100,250],approval:[100,450],release:[700,350],done:[1100,350]},via:{}};
 const output=renderTransit({graph:g,layout:l,frame:300});assert.match(output,/data-station="done"/);assert.doesNotMatch(output,/观众线|场务线|人到了/);
});
test('random-access state and SVG bytes are deterministic; input remains unchanged',()=>{
 const g=graph(),copy=structuredClone(g),frames=[539,0,276,180,60,309,180];
 const outputs=frames.map(frame=>renderTransit({graph:g,frame}));assert.equal(outputs[3],outputs[6]);assert.deepEqual(g,copy);assert.deepEqual(transitState(g,180,30),transitState(g,360,60));
});
test('all 540 frames obey parent readiness, monotonic progress and event-gated station visibility',()=>{
 const g=graph();let previous={};
 for(let f=0;f<540;f++){
  const s=transitState(g,f);for(const [id,e] of Object.entries(s.edges)){assert.ok(e.progress>=(previous[id]??0));if(e.started)assert.equal(s.nodes[e.from].released,true);if(e.arrived)assert.equal(s.nodes[e.to].visible,true);previous[id]=e.progress;}
  if(s.nodes.open.visible)assert.equal(s.nodes.join.ready,true);
 }
});
test('caption-free causal test removes narrative labels while preserving event geometry and wait gate',()=>{
 const withText=renderTransit({frame:210}),noText=renderTransit({frame:210,showCaptions:false});assert.match(withText,/人到了/);assert.doesNotMatch(noText,/>人到了|>观众到齐|>双线会合/);
 for(const id of ['invite-guests','guests-join','venue-sound','sound-lights','lights-join'])assert.equal(withText.includes(`data-edge="${id}"`),noText.includes(`data-edge="${id}"`));
 assert.match(noText,/data-station="join"/);assert.doesNotMatch(noText,/data-station="open"/);
});
test('portrait has independent geometry, finite frames and no premature final station',()=>{
 const l=layoutFor(720,1280);assert.equal(l.portrait,true);assert.notDeepEqual(l.positions,layoutFor(1280,720).positions);
 for(const f of [0,120,180,276,309,370,539]){const svg=renderTransit({frame:f,width:720,height:1280});assert.match(svg,/viewBox="0 0 720 1280"/);assert.doesNotMatch(svg,/NaN|Infinity/);}
 assert.doesNotMatch(renderTransit({frame:120,width:720,height:1280}),/data-station="join"|data-station="open"/);
});
test('polyline interpolation uses distance, including bends; endpoints match stations',()=>{
 assert.deepEqual(pointOnRoute([[0,0],[3,0],[3,4]],.5),{x:3,y:.5,length:7});
 for(const layout of [layoutFor(1280,720),layoutFor(720,1280)])for(const edge of graph().edges){const points=routePoints(edge,layout);const start=pointOnRoute(points,0),end=pointOnRoute(points,1);assert.deepEqual([start.x,start.y],layout.positions[edge.from]);assert.deepEqual([end.x,end.y],layout.positions[edge.to]);}
});
test('cyclic, dangling, duplicate and invalid timing inputs fail explicitly',()=>{
 let g=graph();g.edges.push({id:'loop',from:'open',to:'invite',duration:1,line:'joined'});delete g.nodes[0].startAt;assert.throws(()=>compileTransit(g),/acyclic/);
 g=graph();g.edges[0].to='missing';assert.throws(()=>compileTransit(g),/endpoint/);
 g=graph();g.nodes.push(g.nodes[0]);assert.throws(()=>compileTransit(g),/unique/);
 g=graph();g.edges[0].duration=0;assert.throws(()=>compileTransit(g),/finite/);
 g=graph();g.edges[0].blockedAt=1;assert.throws(()=>compileTransit(g),/between/);
 assert.throws(()=>renderTransit({fps:0}),/fps/);assert.throws(()=>renderTransit({frame:-1}),/frame/);assert.throws(()=>renderTransit({width:500,height:500}),/aspect/);assert.throws(()=>renderTransit({idPrefix:'" injected'}),/Unsafe/);
});
test('safe-looking prototype property IDs do not bypass schedule computation',()=>{
 const g={nodes:[{id:'constructor',label:'A',startAt:0},{id:'toString',label:'B'}],edges:[{id:'valueOf',from:'constructor',to:'toString',line:'people',duration:2}]};
 assert.equal(compileTransit(g).nodes.toString.readyAt,2);
});
test('labels and titles are XML escaped, not inserted as markup',()=>{
 const g=graph();g.title='<script>unsafe()</script>';g.nodes[0].label='<image href="x"/>';
 const svg=renderTransit({graph:g,frame:60});assert.doesNotMatch(svg,/<script>|<image href/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/&lt;image href=&quot;x&quot;\/&gt;/);
});
test('prepare creates portable entrypoint and refuses overwrite or repository output',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'transit-prepare-test-')),dest=path.join(parent,'project'),script=path.resolve(import.meta.dirname,'../examples/transit-story/prepare.mjs');
 try{let r=spawnSync('node',[script,dest],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.ok(fs.existsSync(path.join(dest,'src/style/scene.mjs')));assert.match(fs.readFileSync(path.join(dest,'src/index.tsx'),'utf8'),/\.\/style\/kit/);r=spawnSync('node',[script,dest]);assert.notEqual(r.status,0);r=spawnSync('node',[script,path.resolve(import.meta.dirname,'../bad-output')]);assert.notEqual(r.status,0);}finally{fs.rmSync(parent,{recursive:true,force:true});}
});
test('editable example graph/layout data agree with actual sample renderer',()=>{
 const folder=path.resolve(import.meta.dirname,'../examples/transit-story');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder,'story.json'))),graph());
 for(const [name,w,h] of [['landscape',1280,720],['portrait',720,1280]])assert.deepEqual(JSON.parse(fs.readFileSync(path.join(folder,`layout.${name}.json`))),layoutFor(w,h));
});
test('demonstration tracks use only horizontal, vertical or 45-degree segments',()=>{
 for(const l of [layoutFor(1280,720),layoutFor(720,1280)])for(const edge of graph().edges){const p=routePoints(edge,l);for(let i=1;i<p.length;i++){const dx=Math.abs(p[i][0]-p[i-1][0]),dy=Math.abs(p[i][1]-p[i-1][1]);assert.ok(dx===0||dy===0||dx===dy,edge.id);}}
});
test('zero-progress strokes never leak round caps at a future endpoint',()=>{
 assert.doesNotMatch(renderTransit({frame:309}),/data-edge="join-open"/);assert.match(renderTransit({frame:310}),/data-edge="join-open"/);
 assert.doesNotMatch(renderTransit({frame:24}),/data-edge="invite-guests"/);assert.match(renderTransit({frame:25}),/data-edge="invite-guests"/);
});
