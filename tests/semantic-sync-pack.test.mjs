import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSemanticSyncPlan, generateSemanticSyncPack, parseAnchorsTs} from '../scripts/semantic-sync-pack.mjs';

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0;

test('parseAnchorsTs and buildSemanticSyncPlan extract sentence midpoints and {#id} anchors cleanly', () => {
  const anchors = parseAnchorsTs(`
// comment
export const ANCHOR_FRAMES: Record<string, number> = {
  "C1": 86,
  "S01": 86,
  "S01.end": 140,
  "hit": 113,
  "dup_mid": 113,
};
`);
  assert.deepEqual(anchors, {C1: 86, S01: 86, 'S01.end': 140, hit: 113, dup_mid: 113});

  const timeline = {
    fps: 30,
    total_frames: 240,
    sentences: [
      {id: 'S01', chapter: 1, from: 86, to: 140, text: '向量检索先找三段'},
      {id: 'S02', chapter: 1, from: 151, to: 210, text: '模型再写出回答'},
    ],
  };
  const plan = buildSemanticSyncPlan(timeline, anchors, {totalFrames: 240}, {id: 'sync-test'});
  assert.equal(plan.entries.length, 4);
  assert.deepEqual(plan.entries.map(e => e.frame), [113, 180, 113, 113]);
  // Unique stills: f113 (deduped across S01 mid + hit + dup_mid) and f180
  assert.equal(plan.batchRequest.stills.length, 2);
  assert.deepEqual(plan.batchRequest.stills.map(s => s.frame), [113, 180]);
});

test('generateSemanticSyncPack renders batch stills and writes qc/semantic-sync/index.md', {skip: !hasFfmpeg}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-semsync-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const write = (rel, val) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, typeof val === 'string' ? val : JSON.stringify(val));
  };
  const cfg = {width: 160, height: 90, fps: 30, totalFrames: 90, slug: 'syncdemo'};
  write('project.json', cfg);
  write('package.json', {name: 'sync-fixture'});
  write('script/storyboard.json', {shots: [{id: 'S1', from: 1, to: 90, group: 'G', component: 'src/A.tsx', action: 'hit', purpose: 'sync'}]});
  write('script/timeline.json', {fps: 30, total_frames: 90, engine: 'minimax', anchor_source: 'measured', sentences: [{id: 'S01', chapter: 1, from: 10, to: 50, text: '语义命中时刻'}]});
  write('src/A.tsx', 'export const A = () => null;');
  write('src/common/anchors.ts', 'export const ANCHOR_FRAMES: Record<string, number> = {\n  "S01": 10,\n  "S01.end": 50,\n  "boom": 22,\n};\n');
  write('src/index.ts', 'export {};');
  write('node_modules/typescript/bin/tsc', 'process.exit(0);');
  write('node_modules/@remotion/bundler/package.json', {name: '@remotion/bundler', main: 'index.cjs'});
  write('node_modules/@remotion/bundler/index.cjs', 'exports.bundle = async ({outDir, enableCaching}) => {if (enableCaching !== false) throw Error("no cache"); return outDir;};');
  write('node_modules/@remotion/renderer/package.json', {name: '@remotion/renderer', main: 'index.cjs'});
  write('node_modules/@remotion/renderer/index.cjs', `
    const fs = require('node:fs');
    exports.openBrowser = async () => ({close: async () => {}});
    exports.selectComposition = async () => (${JSON.stringify({...cfg, durationInFrames: 90})});
    exports.renderStill = async ({output, frame}) => fs.writeFileSync(output, 'PNG_F_' + frame);
  `);

  const res = await generateSemanticSyncPack(root, {id: 'ss-1'});
  assert.equal(res.entries.length, 2);
  assert.equal(res.stillsCount, 2);
  const md = fs.readFileSync(res.markdownPath, 'utf8');
  assert.match(md, /needs_review/);
  assert.match(md, /`S01`/);
  assert.match(md, /`\{#boom\}`/);
  assert.match(md, /renders\/reviews\/ss-1/);
});
