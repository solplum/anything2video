import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tsLoader} from './helpers/load-ts.mjs';
const {createRisoStory,STORY_SECONDS,beetlePose}=tsLoader()('template/src/shots/riso-story/timing.ts');
test('riso story has a complete 36-second cause and effect arc, independent of fps',()=>{
  assert.equal(STORY_SECONDS,36);
  for(const fps of [24,30,60]){
    const s=createRisoStory(fps);
    assert.equal(s.stateAt(8*fps).firstX,390);
    assert.equal(s.stateAt(13*fps).unfold,0);
    assert.equal(s.stateAt(18*fps).unfold,1);
    assert.equal(s.stateAt(22*fps).crossing,0);
    assert.equal(s.stateAt(28*fps).firstX,1000);
    assert.equal(s.stateAt(34*fps).resolved,true);
    assert.equal(s.stateAt(35*fps).secondX,900);
    const forward=Array.from({length:36*fps},(_,f)=>s.stateAt(f));
    for(let f=forward.length-1;f>=0;f--) {
      const {bridgeY,...got}=s.stateAt(f),{bridgeY:unused,...expected}=forward[f];
      assert.deepEqual(got,expected);
      assert.ok(got.firstY<=490 && got.secondY<=490);
    }
    assert.throws(()=>s.stateAt(NaN));
  }
});

test('six foot endpoints follow the bridge surface through both crossing directions',()=>{
  const story=createRisoStory(24);
  for(let f=552;f<864;f++){
    const s=story.stateAt(f);
    for(const [x,y,scale,back] of [[s.firstX,s.firstY,1,s.t>=29],[s.secondX,s.secondY,.72,false]]){
      const p=beetlePose(x,y,scale,back,s.bridgeY);
      for(const q of [-54,-28,-5,24,37,58]){
        const v=p.footY(q),gx=x+p.sx*q*p.cos-scale*v*p.sin,gy=y+p.sx*q*p.sin+scale*v*p.cos;
        assert.ok(Math.abs(gy-s.bridgeY(gx))<.15,`foot error at ${f}: ${gy-s.bridgeY(gx)}`);
      }
    }
  }
});
