import test from 'node:test';import assert from 'node:assert/strict';
import {renderPorcelain,materialState,bloomRadius,bloomPath,originalArtwork,PORCELAIN} from '../styles/porcelain-reveal/scene.mjs';
test('14 seconds at 30fps is an explicit silent study',()=>assert.equal(PORCELAIN.frames,PORCELAIN.seconds*PORCELAIN.fps));
test('random-access order never changes frame output',()=>{const first=renderPorcelain({frame:170,seed:93});for(const f of [419,0,250,4])renderPorcelain({frame:f});assert.equal(renderPorcelain({frame:170,seed:93}),first)});
test('seed changes the material, not only metadata',()=>assert.notEqual(bloomPath(10,20,100,3),bloomPath(10,20,100,13)));
test('all diffusion radii are monotonic and bounded',()=>{for(const start of [.7,2.9,4.5]){let prev=0;for(let f=0;f<500;f++){const r=bloomRadius(f/30,start,530,6.4);assert.ok(r>=prev&&r<=530);prev=r;}assert.equal(prev,530)}});
test('wet, settle and title occupy separate phases',()=>{assert.equal(materialState(0).wet,0);assert.ok(materialState(90).wet>.99);assert.equal(materialState(90).title,0);assert.ok(materialState(330).settled>.99);assert.equal(materialState(419).wet,0);assert.equal(materialState(419).title,1);assert.ok(materialState(419).complete)});
test('negative frames clamp, fps and speed are explicit',()=>{assert.equal(renderPorcelain({frame:-1}),renderPorcelain({frame:0}));assert.deepEqual(materialState(60,60),materialState(30,30));assert.deepEqual(materialState(30,30,{speed:2}),materialState(60,30))});
test('invalid numbers and identifiers reject rather than emitting broken SVG',()=>{for(const options of [{fps:0},{fps:NaN},{width:-1},{height:Infinity},{seed:1.5},{speed:0},{idPrefix:'x\" onload=\"a'},{bloomSources:[]}])assert.throws(()=>renderPorcelain(options))});
test('text is escaped; text-hidden output preserves artwork',()=>{const s=renderPorcelain({frame:419,title:'<script>&"'});assert.ok(s.includes('&lt;script&gt;&amp;&quot;'));assert.ok(!s.includes('<script>'));const hidden=renderPorcelain({frame:419,showText:false});assert.ok(!hidden.includes('<text '));assert.ok(hidden.includes('id="porcelain-art"'))});
test('unique IDs make two instances collision-free',()=>{const a=renderPorcelain({idPrefix:'sceneA'}),b=renderPorcelain({idPrefix:'sceneB'});const ids=s=>[...s.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set([...ids(a),...ids(b)]).size,ids(a).length+ids(b).length)});
test('portrait uses portrait scene rather than letterboxed landscape',()=>{const s=renderPorcelain({width:720,height:1280});assert.ok(s.includes('viewBox="0 0 720 1280"'));assert.ok(s.includes('data-layout="portrait-native"'));assert.ok(s.includes('x="74" y="169"'))});
test('custom original artwork and reveal sources can replace demo',()=>{const s=renderPorcelain({frame:60,artworkSvg:'<circle id="custom-art" cx="200" cy="200" r="50"/>',bloomSources:[[200,200,0,100,1]]});assert.ok(s.includes('id="custom-art"'));assert.ok(!s.includes('M740 650'))});
test('only local fragment references, no linked assets or fonts',()=>{const s=renderPorcelain({frame:419});for(const match of s.matchAll(/(?:href|xlink:href)="([^"]+)"/g))assert.ok(match[1].startsWith('#'));assert.ok(!s.includes('@import'));assert.ok(originalArtwork().length>1000)});

test('small emerging blooms use absolute filter space with stroke plus blur padding',()=>{
 for(const [width,height] of [[1280,720],[720,1280]])for(const frame of [22,24,87,90,93,136,138]){
  const s=renderPorcelain({frame,width,height}),vw=width,vh=height;
  for(const name of ['feather','wet'])assert.ok(s.includes(`<filter id="porcelain-${name}" filterUnits="userSpaceOnUse" x="-32" y="-32" width="${vw+64}" height="${vh+64}">`));
  // 20px stroke contributes 10px outside its path; 3σ at 4.5px adds 13.5px. Padding 32 > 23.5.
  assert.ok(32>20/2+3*4.5);assert.ok(32>3*8);
 }
});
