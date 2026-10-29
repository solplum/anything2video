import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {TEACHING, teachingOpacity} from '../styles/line-art/teaching-timing.mjs';
import {auditReadability} from '../scripts/probe_readability.mjs';

test('teaching cues become fully readable before hold time is counted', () => {
  assert.equal(teachingOpacity(0, 1, 239), 0);
  assert.equal(teachingOpacity(1, 1, 239), 0);
  assert.equal(teachingOpacity(4, 1, 239), 0.5);
  for (let f = 7; f <= 239; f++) assert.equal(teachingOpacity(f, 1, 239), 1);
  assert.equal(teachingOpacity(242, 1, 239), 0.5);
  assert.equal(teachingOpacity(245, 1, 239), 0);
});

test('teaching cues support intentional hard cuts and indefinite stillness', () => {
  assert.equal(teachingOpacity(19, 20, 30, 0), 0);
  assert.equal(teachingOpacity(20, 20, 30, 0), 1);
  assert.equal(teachingOpacity(29, 20, 30, 0), 1);
  assert.equal(teachingOpacity(30, 20, 30, 0), 0);
  assert.equal(teachingOpacity(100000, 337), 1);
  for (let f = 343; f <= 411; f++) assert.equal(teachingOpacity(f, 337), 1);
});

test('invalid cue values fail rather than producing NaN or premature overlap', () => {
  for (const args of [[NaN, 1], [1, Infinity], [1, 1, NaN], [1, 1, -Infinity], [1, 1, 3], [1, 1, 9, -1], [1, 1, 9, Infinity]]) {
    assert.throws(() => teachingOpacity(...args), RangeError);
  }
});

test('declared teaching sizes and reference layout fit the mobile/readability budget', () => {
  const result = auditReadability({width: 1280, height: 720, mobileWidth: 480, safeBottom: 72, elements: [
    {id: 'prompt', type: 'text', text: '桥上的重量，由谁承担？', x: 150, y: 64, width: 980, height: 65, fontSize: TEACHING.promptSize},
    {id: 'load', type: 'text', text: '荷载', x: 520, y: 245, width: 80, height: 56, fontSize: TEACHING.labelSize},
    {id: 'cable', type: 'text', text: '拉索', x: 470, y: 173, width: 80, height: 56, fontSize: TEACHING.labelSize},
    {id: 'note', type: 'text', text: '受力示意 · 非精确比例', x: 150, y: 564, width: 600, height: 54, fontSize: TEACHING.noteSize},
  ]});
  assert.equal(result.status, 'passed');
  assert.equal(result.fullBoundsElementsAudited, 4);
  // Arithmetic only: actual font metrics, motion and collisions still require rendered review.
});

test('opt-in addition preserves the original line-art kit byte-for-byte', () => {
  const bytes = fs.readFileSync(new URL('../styles/line-art/kit.tsx', import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '9b5537ddd4cd753ecdc7b7d5ee402e730bd2bcfc50e4e8b9c418c348063e543d');
});


test('core example reproduction explains the full-source prerequisite before writing outputs', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-line-art-core-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  const source = path.join(temp, 'core');
  const script = path.join(source, 'examples/line-art-teaching/prepare.mjs');
  fs.mkdirSync(path.dirname(script), {recursive: true});
  fs.copyFileSync(new URL('../examples/line-art-teaching/prepare.mjs', import.meta.url), script);
  const out = path.join(temp, 'projects');
  const run = spawnSync(process.execPath, [script, out], {encoding: 'utf8'});
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /samples\/line-art-sample\.mp4 is not installed/);
  assert.match(run.stderr, /--profile full/);
  assert.match(run.stderr, /No output was created/);
  assert.equal(fs.existsSync(out), false);
});
