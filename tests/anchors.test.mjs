import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {tsLoader} from './helpers/load-ts.mjs';
import {checkPlan} from '../scripts/check-plan.mjs';

const load = tsLoader();
const {createAnchorLookup} = load('template/src/common/anchor.ts');

test('createAnchorLookup resolves at, span, local and secOf accurately', () => {
  const {at, span, local, secOf} = createAnchorLookup({
    C1: 86,
    S01: 86,
    'S01.end': 140,
    hit: 112,
    S02: 151,
    'S02.end': 210,
  });
  assert.equal(at('hit'), 112);
  assert.equal(at('hit', -3), 109);
  assert.deepEqual(span('S01', 'S02'), {from: 86, to: 210});
  assert.deepEqual(span('S01', 'hit'), {from: 86, to: 112});
  assert.equal(local('hit', 86), 26);
  assert.equal(local('S01', 86), 0);
  assert.equal(secOf('S01', 30), 85 / 30);
  assert.equal(secOf('hit', 30) - secOf('S01', 30), 26 / 30);
});

test('anchor lookup throws on missing, prototype or inverted spans', () => {
  const {at, span, local, secOf} = createAnchorLookup({S01: 100, 'S01.end': 120, S02: 130, 'S02.end': 150});
  for (const bad of ['missing', 'toString', 'constructor']) {
    assert.throws(() => at(bad), /Unknown anchor id/);
    assert.throws(() => local(bad, 100), /Unknown anchor id/);
    assert.throws(() => secOf(bad, 30), /Unknown anchor id/);
  }
  assert.throws(() => span('S02', 'S01'), /Invalid anchor span/);
});

test('checkPlan warns on literal shot frame numbers without blocking pass', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-plan-warn-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.mkdirSync(path.join(dir, 'script'), {recursive: true});
  fs.mkdirSync(path.join(dir, 'src/shots/G1'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({width: 1280, height: 720, fps: 30, totalFrames: 60, slug: 'demo'}));
  fs.writeFileSync(path.join(dir, 'script/storyboard.json'), JSON.stringify({shots: [{id: 'SC01', from: 1, to: 60, group: 'G1', component: 'src/shots/G1/index.ts', action: 'show', purpose: 'demo'}]}));
  fs.writeFileSync(path.join(dir, 'src/shots/G1/index.ts'), "export const SHOTS_G1 = [{id: 'SC01', from: 1, to: 60}];\n");
  const res = checkPlan(dir);
  assert.equal(res.pass, true);
  assert.ok(res.warnings.some(w => w.includes('src/shots/G1/index.ts:1')));
});
