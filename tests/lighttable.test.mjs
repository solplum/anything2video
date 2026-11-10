import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderLighttable,stateAt,layoutFor} from '../styles/lighttable/scene.mjs';
import {catalog,selectionGroups,generate} from '../scripts/style-catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('new manual kit is independent while every original recipe/source association remains intact',()=>{
 const legacy=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/style-compat.json'),'utf8'));
 assert.deepEqual(catalog.styles.filter(s=>!['engraving','lighttable','choice-quest','transit-story','porcelain-reveal','card-conflict'].includes(s.id)).map(({id,recipe,source})=>({id,recipe,source})),legacy.styles);
 const style=catalog.styles.find(s=>s.id==='lighttable');
 assert.equal(style.runtimeSkin,false);assert.equal(style.family,'lighttable');
 assert.equal(catalog.styles.length,68);assert.equal(selectionGroups().length,64);
 assert.equal(catalog.styles.filter(s=>s.runtimeSkin).length,12);
 generate({check:true});
});

test('rendering and repeated seeks are deterministic, including fractional frames',()=>{
 for(const [w,h] of [[1280,720],[720,1280]]) for(const frame of [0,30,60,105,147.5,165,240,315,359]) {
  const before=renderLighttable({frame,width:w,height:h});
  renderLighttable({frame:359-frame,width:w,height:h});
  assert.equal(renderLighttable({frame,width:w,height:h}),before);
  assert.doesNotMatch(before,/NaN|Infinity|undefined/);
 }
});
test('timing uses absolute seconds and clamps only beyond the study bounds',()=>{
 assert.deepEqual(stateAt(240,30),stateAt(480,60));
 assert.equal(stateAt(-1,30).t,0);assert.equal(stateAt(99999,30).t,12);
 assert.equal(stateAt(90,30).markA,0);assert.equal(stateAt(120,30).markA,1);
 assert.equal(stateAt(180,30).markB,0);assert.equal(stateAt(240,30).markB,1);
 assert.equal(stateAt(315,30).conclusion,1);assert.equal(stateAt(315,30).lensOpacity,0);
});
test('lens lands on the actual two document IDs before annotating each',()=>{
 for(const [w,h] of [[1280,720],[720,1280]]) {
  const a=stateAt(90,30,w,h),b=stateAt(195,30,w,h);
  assert.deepEqual(a.lens,a.layout.lensA);assert.deepEqual(b.lens,b.layout.lensB);
  assert.equal(a.markA,0);assert.equal(b.markB,0);
  const svg=renderLighttable({frame:195,width:w,height:h,idPrefix:'test'});
  assert.equal((svg.match(/id="test-original"/g)||[]).length,1);
  assert.match(svg, /id="test-evidence"><g id="test-original"/);
  assert.match(svg, /stroke-dasharray="[23]\d{2}\.\d+ [23]\d{2}\.\d+"/);
  assert.match(svg,/<use href="#test-evidence" xlink:href="#test-evidence"\/>/);
  assert.match(svg,new RegExp(`translate\\(${b.lens.x} ${b.lens.y}\\) scale\\(1.8\\) translate\\(-${b.lens.x} -${b.lens.y}\\)`));
  assert.equal((svg.match(/>A–042</g)||[]).length,1);assert.equal((svg.match(/>A–047</g)||[]).length,1);
 }
});
test('portrait is independently laid out and all source papers fit the lit work area',()=>{
 const landscape=layoutFor(1280,720),portrait=layoutFor(720,1280);
 assert.notEqual(portrait.tag.y,landscape.tag.y);assert.ok(portrait.tag.y>portrait.page.y+portrait.page.h);
 for(const l of [landscape,portrait])for(const b of [l.page,l.tag]) {
  assert.ok(b.x>=31&&b.y>=31);assert.ok(b.x+b.w<=l.w-31&&b.y+b.h<=l.h-31);
 }
});
test('invalid geometry, clocks and SVG IDs fail before producing markup',()=>{
 for(const options of [{fps:0},{fps:NaN},{frame:Infinity},{width:0},{height:-1},{idPrefix:'bad" onload="alert(1)'}])assert.throws(()=>renderLighttable(options));
});
test('prepared Remotion project includes the exact shared renderer and guards existing paths',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'lighttable-prepare-test-')),target=path.join(parent,'project');
 const run=()=>spawnSync(process.execPath,['examples/lighttable/prepare.mjs',target],{cwd:root,encoding:'utf8'});
 assert.equal(run().status,0);
 assert.deepEqual(fs.readFileSync(path.join(target,'src/style/scene.mjs')),fs.readFileSync(path.join(root,'styles/lighttable/scene.mjs')));
 assert.ok(fs.existsSync(path.join(target,'package-lock.json')));assert.notEqual(run().status,0);
 assert.notEqual(spawnSync(process.execPath,['examples/lighttable/prepare.mjs',path.join(root,'internal')],{cwd:root}).status,0);
 fs.rmSync(parent,{recursive:true,force:true});
});
