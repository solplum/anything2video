import {test} from 'node:test';
import assert from 'node:assert/strict';
import {B, engraveShape} from '../styles/engraving/engine/index.js';
// Geometry and ordered line-store tests do not pretend to validate raster output.
// Actual Chrome/Remotion frames are checked separately in examples/engraving.
class PathProbe {
  constructor(){this.calls=[];}
  moveTo(...v){this.calls.push(['M',...v]);}
  lineTo(...v){this.calls.push(['L',...v]);}
  closePath(){this.calls.push(['Z']);}
}
globalThis.Path2D=PathProbe;
const shape='M0 50 C0 -20 100 -20 100 50 C100 120 0 120 0 50 Z';
const snapshot=ink=>JSON.stringify(ink.S.map(s=>({g:s.g,xy:[...s.xy],w:[...s.ws],s0:s.s0,s1:s.s1})));

test('engraveShape produces clipped, swelling contours and multiple shadow passes deterministically', () => {
  const a=engraveShape(shape,{style:'contour',seed:41,spacing:4});
  const b=engraveShape(shape,{style:'contour',seed:41,spacing:4});
  assert.equal(snapshot(a.ink),snapshot(b.ink));
  for(const group of ['ol','h1','h2','h3']) assert.ok(a.ink.count(group)>0,group);
  const hatch=a.ink.S.filter(s=>s.g==='h1');
  assert.ok(hatch.some(s=>Math.max(...s.ws)>Math.min(...s.ws)*3),'cut width must swell and taper');
  assert.ok(hatch.some(s=>new Set([...s.xy].filter((_,i)=>i%2===0).map(x=>Math.round(x))).size>4),'contours must bend');
  for(const s of a.ink.S.filter(s=>s.g!=='ol')) for(let i=0;i<s.n;i++) {
    if(s.ws[i]>0.16) assert.ok(B.inPoly(a.shape.polys,s.xy[2*i],s.xy[2*i+1]),'ink stays inside silhouette');
  }
  const reversed=B.formTone(a.shape.polys,{light:[0.6,0.7]});
  assert.ok(a.tone(15,50)<a.tone(85,50),'left side is lit');
  assert.ok(reversed(15,50)>reversed(85,50),'light direction changes the form, not just colour');
});

test('ordered cuts use absolute seconds and out-of-order drawing leaves the line store unchanged', () => {
  const {ink}=engraveShape(shape,{seed:41});
  ink.schedule('ol',0,1);ink.schedule('h1',1,3);ink.schedule('h2',3,4.5);ink.schedule('h3',4.5,5.5);ink.build();
  assert.deepEqual(ink.span('h3'),[4.5,5.5]);
  const before=snapshot(ink);
  const context=()=>{
    const trace=[];return {trace,canvas:{width:200,height:200},getTransform:()=>({inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),save(){},restore(){},stroke(p){trace.push(p.calls);}};
  };
  const a=context();ink.draw(a,3.6);const b=context();ink.draw(b,0.7);const c=context();ink.draw(c,3.6);
  assert.deepEqual(a.trace,c.trace);
  assert.notDeepEqual(a.trace,b.trace);
  assert.equal(snapshot(ink),before);
});
