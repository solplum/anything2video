import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tsLoader} from './helpers/load-ts.mjs';
const load = tsLoader();
const {createCueSheet, alignMotion, motionProgress, toStoryboardFrame, fromStoryboardFrame} = load('template/src/common/motion/cues.ts');
const {createCueDemo} = load('template/src/shots/cue-demo/timing.ts');

test('named cues resolve forward dependencies and quantize once at arbitrary fps', () => {
  for (const fps of [24, 25, 30, 60, 30000/1001]) {
    const sheet = createCueSheet(fps, [{id:'b', after:'a', offsetSec:0.015}, {id:'a', atSec:0.015}]);
    assert.equal(sheet.get('b').frame, Math.round(0.03 * fps));
    assert.equal(sheet.get('b').seconds, 0.03);
    assert.equal(toStoryboardFrame(sheet.get('b').frame), Math.round(0.03 * fps) + 1);
    assert.equal(fromStoryboardFrame(toStoryboardFrame(sheet.get('b').frame)), sheet.get('b').frame);
  }
});

test('retiming a hold propagates only to dependent events without mutating inputs', () => {
  const before = createCueDemo(30, 1.2), after = createCueDemo(30, 2);
  for (const id of ['arrive','confirm']) assert.deepEqual(after.sheet.get(id), before.sheet.get(id));
  for (const id of ['depart','finish']) assert.equal(after.sheet.get(id).frame - before.sheet.get(id).frame, 24);
  const defs = [{id:'a', atSec:1}];
  const sheet = createCueSheet(30, defs);
  defs[0].atSec = 2;
  assert.equal(sheet.get('a').frame, 30);
  assert.throws(() => { sheet.get('a').frame = 99; }, TypeError);
  assert.throws(() => sheet.cues.push({}), TypeError);
});

test('a reveal or arrival lands on the cue, with fractional window boundaries retained', () => {
  for (const reveal of [0, .35, .5, 1]) {
    const window = alignMotion(60, 23, reveal);
    assert.ok(Math.abs(motionProgress(60, window) - reveal) < 1e-12);
    assert.equal(window.start, 60 - 23 * reveal);
    assert.equal(window.end - window.start, 23);
    assert.equal(motionProgress(-3, window), 0);
    assert.equal(motionProgress(200, window), 1);
  }
  assert.equal(motionProgress(60.25, alignMotion(60, 20, .5)), .5125);
});

test('cue demo holds a readable result and is identical under reverse/random seeking', () => {
  for (const fps of [24, 30, 60, 30000/1001]) {
    const demo = createCueDemo(fps);
    const expected = Array.from({length:Math.ceil(6*fps)}, (_, frame) => demo.stateAt(frame));
    const order = [...expected.keys()].reverse().concat([0, 57, 2, 70, 0, 12]);
    for (const frame of order) assert.deepEqual(demo.stateAt(frame), expected[frame]);
    const arrive = demo.sheet.get('arrive').frame;
    const confirm = demo.sheet.get('confirm').frame;
    const depart = demo.sheet.get('depart').frame;
    const finish = demo.sheet.get('finish').frame;
    assert.equal(demo.departure.end, finish);
    assert.equal(demo.stateAt(finish - 1).phase, 'HANDOFF');
    assert.equal(demo.stateAt(finish).phase, 'COMPLETE');
    assert.equal(demo.stateAt(finish).x, 1330);
    assert.equal(demo.stateAt(arrive).x, 760);
    assert.equal(demo.stateAt(confirm-1).confirmed, false);
    assert.equal(demo.stateAt(confirm).confirmed, true);
    assert.deepEqual(demo.stateAt(confirm), demo.stateAt(depart-1));
    for (let f=1; f<expected.length; f++) assert.ok(expected[f].x >= expected[f-1].x);
  }
});

test('invalid graph, nonfinite time, ambiguous definitions and pre-roll fail loudly', () => {
  for (const fps of [0, -1, NaN, Infinity]) assert.throws(() => createCueSheet(fps, []));
  for (const defs of [
    [{id:'', atSec:0}], [{id:'a', atSec:0},{id:'a',atSec:1}], [{id:'a',after:'missing'}],
    [{id:'a',after:'b'},{id:'b',after:'a'}], [{id:'a',atSec:0,after:'a'}],
    [{id:'a',atSec:0,offsetSec:1}], [{id:'a',atSec:NaN}], [{id:'a',atSec:-.1}],
    [{id:'a',atSec:1e300}], [{id:'a',after:'b',offsetSec:-2},{id:'b',atSec:1}],
    [{id:'a',after:'b',offsetSec:Infinity},{id:'b',atSec:1}],
  ]) assert.throws(() => createCueSheet(30, defs));
  assert.throws(() => createCueSheet(30, []).get('missing'));
  assert.equal(createCueSheet(30, [{id:'a',atSec:2},{id:'b',after:'a',offsetSec:-1}]).get('b').frame,30);
  for (const args of [[0,1,1],[10,0,1],[10,-1,1],[10,1,1.1],[10,1,-.1],[NaN,1,1],[10,Infinity,1]]) assert.throws(() => alignMotion(...args));
  for (const n of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER]) assert.throws(() => toStoryboardFrame(n));
  for (const n of [0,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => fromStoryboardFrame(n));
  assert.throws(() => motionProgress(NaN, alignMotion(10, 2)));
});

// Remotion Studio selects the first composition when no selection is in the URL.
test('adding the timing study preserves the default Video composition', () => {
  const root = fs.readFileSync(new URL('../template/src/Root.tsx', import.meta.url), 'utf8');
  assert.equal(root.match(/<Composition id="([^"]+)"/)[1], 'Video');
  assert.match(root, /<Composition id="CueDemo"/);
});
