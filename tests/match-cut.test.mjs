import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {MATCH_CUT_MODE, validateEditingMode, createComposedGrid, validateGrid, beatToSeconds, beatToFrame, compileMatchCut, checkEditingMode, matchCutReviewRequest} from '../scripts/editing-mode-lib.mjs';
import {validatePlan, checkPlan} from '../scripts/check-plan.mjs';
import {inspectMatchCut} from '../scripts/match-cut-plan.mjs';
import {planReview, createReviewPack} from '../scripts/review-pack.mjs';
import {snapshotSources, sha256File} from '../scripts/runtime-lib.mjs';

// These declarations are synthetic fixtures, not evidence of rendered or watched media.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clone = value => structuredClone(value);
const endpoint = (direction = 'none', speed = 0) => ({anchor: [0.5, 0.5], scale: 0.3, direction, speed});
const write = (root, file, value) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
  fs.writeFileSync(path.join(root, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
};
function fixtureData({fps = 24, bpm = 96, phase = 0.18} = {}) {
  const grid = createComposedGrid({bpm, beat0Seconds: phase, beatCount: 17});
  const cut1 = beatToFrame(grid, 4, fps), cut2 = beatToFrame(grid, 8, fps);
  const totalFrames = beatToFrame(grid, 12, fps) - 1;
  const contract = (from, to, subject) => ({subject, metaphor: 'Daily care links planting, light and a repeatable routine.', cause: 'An intentionally animated paper object moves.', grip: 'n/a: paper diagram; no hands depicted', startState: 'Object is identifiable', endState: 'Object reaches the next declared state', actionWindow: {from, to}, entry: endpoint(), exit: endpoint()});
  const shot = (id, from, to, subject) => ({id, from, to, component: 'src/Scene.tsx', group: 'G1', purpose: 'Explain a fictional daily routine without product claims', action: `Animate ${subject}`, facts: [], matchCut: contract(from, to, subject)});
  const shots = [shot('S1', 1, cut1 - 1, 'Seed'), shot('S2', cut1, cut2 - 1, 'Sun'), shot('S3', cut2, totalFrames, 'Care-time dial')];
  shots[0].matchCut.exit = endpoint('right', 0.2);
  shots[1].matchCut.entry = endpoint('right', 0.2);
  const relay = (fromShot, toShot, cut, beat) => ({fromShot, toShot, cut, beat, reason: 'Connect the daily-care metaphor at a stable focal anchor', soundBridge: 'Synthetic click continues; no extra foley is needed', tolerance: {anchor: 0.03, scale: 0.05, speed: 0.05}});
  const project = {schemaVersion: 1, status: 'draft', slug: 'match-cut-test', width: 1280, height: 720, fps, totalFrames, recipe: 'promo', editingMode: MATCH_CUT_MODE};
  const plan = {shots, claims: [], assets: [], matchCut: {schemaVersion: 1, meaning: 'Plant, see daylight, and choose a care time.', heroShotId: 'S3', music: {kind: 'composed', path: 'script/beat_grid.json', sha256: 'a'.repeat(64), outputOffsetSeconds: 0}, relays: [relay('S1', 'S2', 'movement', 4), relay('S2', 'S3', 'rest', 8)]}};
  return {project, plan, grid};
}
function fixture(t, options) {
  const data = fixtureData(options);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-match-cut-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'project.json', data.project);
  write(root, 'script/beat_grid.json', data.grid);
  data.plan.matchCut.music.sha256 = sha256File(path.join(root, 'script/beat_grid.json'));
  write(root, 'script/storyboard.json', data.plan);
  write(root, 'src/Scene.tsx', '// Synthetic fixture: not a rendered scene.\nexport const Scene = () => null;\n');
  return {root, ...data};
}

test('omitted and standard modes preserve existing story/style/recipe data without grid reads', () => {
  const {project, plan} = fixtureData();
  delete plan.matchCut;
  for (const shot of plan.shots) delete shot.matchCut;
  for (const mode of [undefined, 'standard']) {
    const cfg = {...project, editingMode: mode, style: 'paper-collage'};
    const before = clone({cfg, plan});
    assert.deepEqual(validatePlan(cfg, plan), []);
    assert.deepEqual(checkEditingMode('/missing/no-files-needed', cfg, plan), {mode: 'standard', status: 'not_selected', errors: [], cuts: []});
    assert.deepEqual(compileMatchCut(cfg, plan, null), {errors: [], cuts: []});
    assert.deepEqual({cfg, plan}, before);
  }
});

test('explicit selection, meaningful contracts and known mode/schema are required', () => {
  const {project, plan} = fixtureData();
  assert.deepEqual(validatePlan(project, plan), []);
  assert.match(validateEditingMode({...project, editingMode: 'match-cuts'}, plan).join('\n'), /Unknown editingMode/);
  assert.match(validateEditingMode({...project, editingMode: undefined}, plan).join('\n'), /require editingMode/);
  assert.match(validateEditingMode(project, {...plan, matchCut: null}).join('\n'), /requires storyboard.matchCut/);
  for (const mutate of [
    p => p.matchCut.schemaVersion = 2,
    p => p.matchCut.meaning = ' ',
    p => p.matchCut.heroShotId = 'missing',
    p => p.matchCut.relays = [],
    p => p.matchCut.music.kind = 'guessed',
    p => p.matchCut.music.sha256 = 'short',
    p => p.matchCut.music.outputOffsetSeconds = Infinity,
    p => p.shots[0].matchCut = undefined,
  ]) {
    const changed = clone(plan); mutate(changed);
    assert.ok(validateEditingMode(project, changed).length, mutate.toString());
  }
  for (const field of ['subject', 'metaphor', 'cause', 'grip', 'startState', 'endState']) {
    const changed = clone(plan); changed.shots[0].matchCut[field] = '';
    assert.match(validateEditingMode(project, changed).join('\n'), new RegExp(`\\.${field}`));
  }
});

test('movement relay rejects reversal, while rest on both cut endpoints permits the next action to reverse', () => {
  const {project, plan} = fixtureData();
  plan.shots[1].matchCut.entry.direction = 'left';
  assert.match(validateEditingMode(project, plan).join('\n'), /same non-rest direction/);
  plan.matchCut.relays[0].cut = 'rest';
  assert.match(validateEditingMode(project, plan).join('\n'), /both endpoints at rest/);
  plan.shots[0].matchCut.exit = endpoint();
  plan.shots[1].matchCut.entry = endpoint();
  plan.shots[1].action = 'Reverse leftward after the rest-matched entry, then settle';
  assert.deepEqual(validateEditingMode(project, plan), []);
  plan.matchCut.relays[0].cut = 'movement';
  assert.match(validateEditingMode(project, plan).join('\n'), /same non-rest direction/);
});

test('endpoint dimensions, speed semantics and explicitly selected tolerances reject known bad cases', () => {
  const {project, plan} = fixtureData();
  for (const change of [{anchor: [2, 0.5]}, {anchor: [0.5]}, {anchor: [NaN, 0.5]}, {scale: 0}, {scale: 1.1}, {direction: 'diagonal'}, {direction: 'none', speed: 0.2}, {direction: 'right', speed: 0}, {speed: -1}]) {
    const bad = clone(plan); Object.assign(bad.shots[0].matchCut.exit, change);
    assert.match(validateEditingMode(project, bad).join('\n'), /needs normalized anchor\/scale/);
  }
  for (const [field, value] of [['anchor', [0.6, 0.5]], ['scale', 0.4], ['speed', 0.4]]) {
    const bad = clone(plan); bad.shots[1].matchCut.entry[field] = value;
    assert.match(validateEditingMode(project, bad).join('\n'), new RegExp(`declared ${field} mismatch`));
  }
  for (const tolerance of [undefined, {}, {anchor: -0.01, scale: 0.05, speed: 0.05}, {anchor: 2, scale: 0.05, speed: 0.05}, {anchor: 0.03, scale: 2, speed: 0.05}, {anchor: 0.03, scale: 0.05, speed: Infinity}]) {
    const bad = clone(plan); bad.matchCut.relays[0].tolerance = tolerance;
    assert.match(validateEditingMode(project, bad).join('\n'), /tolerance needs explicit/);
  }
});

test('action windows stay complete within global inclusive shot bounds', () => {
  const {project, plan} = fixtureData();
  const shot = plan.shots[1];
  for (const window of [null, {from: 0, to: shot.to}, {from: shot.from - 1, to: shot.to}, {from: shot.from, to: shot.to + 1}, {from: shot.to, to: shot.from}, {from: shot.from + 0.5, to: shot.to}]) {
    const bad = clone(plan); bad.shots[1].matchCut.actionWindow = window;
    assert.match(validateEditingMode(project, bad).join('\n'), /actionWindow/);
  }
});

test('only adjacent selected cuts participate; ordinary payoff/reading shots remain unmodified', () => {
  const {project, plan} = fixtureData();
  plan.matchCut.relays.pop();
  delete plan.shots[2].matchCut;
  plan.shots[2].action = 'Hold the payoff for reading without a beat-synced transition';
  const before = clone(plan);
  assert.deepEqual(validateEditingMode(project, plan), []);
  assert.deepEqual(plan, before);
  for (const relay of [
    {...plan.matchCut.relays[0], fromShot: 'S1', toShot: 'S3'},
    {...plan.matchCut.relays[0], fromShot: 'S2', toShot: 'S1'},
    {...plan.matchCut.relays[0], fromShot: 'missing'},
    {...plan.matchCut.relays[0], fromShot: 'S3', toShot: undefined},
    null,
  ]) {
    const bad = clone(plan); bad.matchCut.relays = [relay];
    assert.ok(validateEditingMode(project, bad).length, 'malformed relay returns errors, never crashes');
  }
  plan.matchCut.relays.push(clone(plan.matchCut.relays[0]));
  assert.match(validateEditingMode(project, plan).join('\n'), /duplicates/);
});

test('absolute beat times use native fps/BPM and one final quantization, without accumulated frame drift', () => {
  for (const [fps, bpm] of [[24, 96], [60, 137], [25, 150], [30000 / 1001, 137.5]]) {
    const grid = createComposedGrid({bpm, beat0Seconds: 0.18, beatCount: 1001});
    for (const beat of [0, 0.5, 4, 8.25, 137, 999.5, 1000]) {
      const seconds = 0.18 + beat * 60 / bpm;
      const actual = beatToFrame(grid, beat, fps);
      assert.equal(actual, Math.round(seconds * fps) + 1);
      assert.ok(Math.abs((actual - 1) / fps - seconds) <= 0.5 / fps + 1e-12);
    }
    assert.deepEqual(grid, createComposedGrid({bpm, beat0Seconds: 0.18, beatCount: 1001}));
  }
  for (const [fps, bpm] of [[24, 96], [60, 137]]) {
    const {project, plan, grid} = fixtureData({fps, bpm});
    const before = clone({project, plan, grid});
    const compiled = compileMatchCut(project, plan, grid);
    assert.deepEqual(compiled.errors, []);
    assert.deepEqual(compiled.cuts.map(cut => cut.frame), plan.shots.slice(1).map(shot => shot.from));
    for (const cut of compiled.cuts) {
      assert.equal(cut.sequenceFrom, cut.frame - 1);
      assert.ok(Math.abs(cut.quantizationMs) <= 500 / fps + 1e-9);
    }
    assert.deepEqual({project, plan, grid}, before);
  }
  const data = fixtureData({fps: 30000 / 1001});
  assert.match(validatePlan(data.project, data.plan).join('\n'), /positive integers/, 'existing project fps contract is unchanged');
});

test('nonuniform measured beat seconds, fractional indices and output offset remain authoritative', () => {
  const grid = {bpm: 137, beats_s: [0.18, 0.61, 1.09, 1.58], reliable: true};
  const nested = {grid, envelopes: {}};
  assert.equal(validateGrid(nested), grid);
  assert.ok(Math.abs(beatToSeconds(grid, 1.5) - 0.85) < 1e-12);
  assert.equal(beatToFrame(nested, 1.5, 60, 0.0427), Math.round((0.85 + 0.0427) * 60) + 1);
  assert.equal(beatToFrame(nested, 0, 24, -0.18), 1);
  assert.throws(() => beatToFrame(nested, 0, 24, -0.181), /before the film start/);
  const {project, plan, grid: source} = fixtureData();
  plan.matchCut.music.outputOffsetSeconds = 0.25;
  assert.match(compileMatchCut(project, plan, source).errors.join('\n'), /incoming shot starts/);
  plan.matchCut.music.outputOffsetSeconds = 0;
  plan.matchCut.relays[0].beat = 4.1;
  assert.match(compileMatchCut(project, plan, source).errors.join('\n'), /incoming shot starts/);
});

test('missing, malformed or unreliable grids never synthesize fallback BPM or extrapolate beats', () => {
  for (const grid of [undefined, null, {}, {bpm: 120, beats_s: []}, {bpm: 120, beats_s: [0]}, {bpm: 0, beats_s: [0, 1]}, {bpm: Infinity, beats_s: [0, 1]}, {bpm: 120, beats_s: [-1, 1]}, {bpm: 120, beats_s: [0, 0]}, {bpm: 120, beats_s: [0, NaN]}, {bpm: 120, beats_s: [1, 0]}, {bpm: 120, beats_s: [0, 1], reliable: false}]) {
    assert.throws(() => beatToFrame(grid, 0, 24), /grid|unreliable/);
    const {project, plan} = fixtureData();
    assert.ok(compileMatchCut(project, plan, grid).errors.length);
  }
  const grid = createComposedGrid({bpm: 96, beat0Seconds: 0.18, beatCount: 5});
  for (const beat of [-1, 4.1, 5, Infinity, NaN, '2']) assert.throws(() => beatToSeconds(grid, beat), /outside/);
  for (const fps of [0, -1, NaN, Infinity, '24']) assert.throws(() => beatToFrame(grid, 0, fps), /fps/);
  for (const change of [{bpm: 0}, {bpm: NaN}, {beat0Seconds: -1}, {beat0Seconds: Infinity}, {beatCount: 1}, {beatCount: 3.5}, {beatCount: 1000001}]) assert.throws(() => createComposedGrid({bpm: 96, beat0Seconds: 0.18, beatCount: 5, ...change}), /Composed grid/);
});

test('composed timing study is explicit, while a silent project cannot claim measured music sync', () => {
  const {project, plan, grid} = fixtureData();
  project.audio = {mode: 'silent'};
  assert.deepEqual(compileMatchCut(project, plan, grid).errors, []);
  plan.matchCut.music.kind = 'measured';
  assert.match(validateEditingMode(project, plan).join('\n'), /silent project cannot claim/);
  delete project.audio;
  grid.reliable = true;
  assert.deepEqual(compileMatchCut(project, plan, grid).errors, []);
});

test('measured grids require reliability evidence, including native nested audio_features confidence', () => {
  const {project, plan, grid} = fixtureData();
  plan.matchCut.music.kind = 'measured';
  for (const metadata of [{}, {bpm_confidence: 0}, {bpm_confidence: 2.99}, {bpm_confidence: '9'}, {bpm_confidence: null}, {bpm_confidence: Infinity}, {reliable: true, bpm_confidence: 0}, {reliable: 'true'}]) {
    for (const data of [{...grid, ...metadata}, {grid: {...grid, ...metadata}}]) {
      assert.ok(compileMatchCut(project, plan, data).errors.length, JSON.stringify(metadata));
    }
  }
  for (const metadata of [{reliable: true}, {bpm_confidence: 3}, {bpm_confidence: 8.6}, {reliable: true, bpm_confidence: 5}]) {
    assert.deepEqual(compileMatchCut(project, plan, {grid: {...grid, ...metadata}}).errors, []);
  }
  assert.ok(compileMatchCut(project, plan, {grid: {...grid, reliable: false, bpm_confidence: 8}}).errors.length);
  plan.matchCut.music.kind = 'composed';
  assert.deepEqual(compileMatchCut(project, plan, grid).errors, []);
  assert.match(fs.readFileSync(path.join(repo, 'template/scripts/beat_grid.py'), 'utf8'), /CONF_MIN\s*=\s*3\.0\b/, 'review adapter threshold when native analyzer convention changes');
});

test('filesystem gate binds the current grid and does not mutate project inputs', t => {
  const {root, project, plan} = fixture(t);
  const before = snapshotSources(root);
  const result = checkPlan(root);
  assert.equal(result.pass, true, result.errors.join('\n'));
  assert.equal(result.editingMode.status, 'needs_review');
  assert.equal(result.editingMode.cuts.length, 2);
  const report = inspectMatchCut(root);
  assert.equal(report.pass, true); assert.equal(report.status, 'needs_review');
  assert.equal(report.musicKind, 'composed');
  assert.match(report.note, /no media rendered, watched or heard/);
  assert.deepEqual(snapshotSources(root), before);
  assert.equal(fs.existsSync(path.join(root, 'renders')), false);
  write(root, 'script/beat_grid.json', {bpm: 96, beats_s: [0, 1, 2]});
  assert.match(checkEditingMode(root, project, plan).errors.join('\n'), /Stale.*hash/);
  assert.equal(checkPlan(root).pass, false);
  assert.throws(() => inspectMatchCut(root), /Storyboard gate failed/);
});

test('music source path rejects traversal, absolute paths, external symlinks and absent files', t => {
  const {root, project, plan} = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-match-cut-outside-'));
  t.after(() => fs.rmSync(outside, {recursive: true, force: true}));
  write(outside, 'grid.json', {bpm: 96, beats_s: [0, 1, 2]});
  fs.symlinkSync(path.join(outside, 'grid.json'), path.join(root, 'script/escape.json'));
  for (const file of ['../outside.json', path.join(outside, 'grid.json'), 'script/escape.json', 'script/missing.json']) {
    const changed = clone(plan); changed.matchCut.music.path = file;
    assert.ok(checkEditingMode(root, project, changed).errors.length, file);
  }
  write(root, 'script/bad.json', '{not-json');
  plan.matchCut.music.path = 'script/bad.json';
  plan.matchCut.music.sha256 = sha256File(path.join(root, 'script/bad.json'));
  assert.ok(checkEditingMode(root, project, plan).errors.length);
});

test('grid inputs cannot hide in excluded output/cache locations, including internal symlink aliases', t => {
  const {root, project, plan, grid} = fixture(t);
  for (const file of ['qc/grid.json', 'renders/grid.json', 'script/__pycache__/grid.json', 'script/grid.log']) {
    write(root, file, grid);
    const changed = clone(plan);
    changed.matchCut.music.path = file;
    changed.matchCut.music.sha256 = sha256File(path.join(root, file));
    assert.match(checkEditingMode(root, project, changed).errors.join('\n'), /source JSON/);
  }
  fs.symlinkSync(path.join(root, 'qc/grid.json'), path.join(root, 'script/alias.json'));
  const changed = clone(plan); changed.matchCut.music.path = 'script/alias.json';
  assert.match(checkEditingMode(root, project, changed).errors.join('\n'), /source JSON/);
  for (const file of ['analysis/music_features.json', 'research/grid.json']) {
    write(root, file, {grid});
    changed.matchCut.music.path = file; changed.matchCut.music.sha256 = sha256File(path.join(root, file));
    assert.deepEqual(checkEditingMode(root, project, changed).errors, []);
  }
});

test('original example prepares two native timing studies consumed by the mounted Sequence timeline', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-relay-examples-'));
  t.after(() => fs.rmSync(parent, {recursive: true, force: true}));
  for (const [fps, bpm] of [[24, 96], [60, 137]]) {
    const root = path.join(parent, `study-${fps}`);
    const args = [path.join(repo, 'examples/match-cut-beat-relay/prepare.mjs'), root, '--fps', String(fps), '--bpm', String(bpm), '--phase', '0.18'];
    const result = spawnSync(process.execPath, args, {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const project = JSON.parse(fs.readFileSync(path.join(root, 'project.json')));
    assert.equal(project.fps, fps); assert.equal(project.status, 'draft');
    assert.equal(project.recipe, 'promo');
    const checked = checkPlan(root);
    assert.equal(checked.pass, true, checked.errors.join('\n'));
    assert.equal(checked.editingMode.status, 'needs_review');
    assert.equal(checked.editingMode.cuts.length, 2);
    const scene = fs.readFileSync(path.join(root, 'src/Scene.tsx'), 'utf8');
    assert.match(scene, /import storyboard from '\.\.\/script\/storyboard.json'/);
    assert.match(scene, /<Sequence[^>]+from=\{shot.from - 1\}/);
    assert.match(scene, /durationInFrames=\{shot.to - shot.from \+ 1\}/);
    assert.ok(fs.existsSync(path.join(root, 'research/prepare-source.mjs')));
    assert.ok(fs.statSync(path.join(root, 'public/click-study.wav')).size > 44);
    assert.equal(spawnSync(process.execPath, args, {encoding: 'utf8'}).status, 1, 'existing projects are not overwritten');
  }
});

test('example low-fps boundaries adapt the real trajectory without widening match tolerances', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-relay-low-fps-'));
  t.after(() => fs.rmSync(parent, {recursive: true, force: true}));
  for (const [fps, bpm, phase] of [[1, 30, 0], [1, 240, 2], [2, 96, 0.18], [3, 137, 0], [120, 30, 2]]) {
    const root = path.join(parent, `study-${fps}-${bpm}`);
    const result = spawnSync(process.execPath, [path.join(repo, 'examples/match-cut-beat-relay/prepare.mjs'), root, '--fps', String(fps), '--bpm', String(bpm), '--phase', String(phase)], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const checked = checkPlan(root);
    assert.equal(checked.pass, true, `fps=${fps}, bpm=${bpm}, phase=${phase}: ${checked.errors.join('; ')}`);
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'script/storyboard.json')));
    const motion = JSON.parse(fs.readFileSync(path.join(root, 'script/study-motion.json')));
    const outgoing = plan.shots[0].matchCut.exit;
    const incoming = plan.shots[1].matchCut.entry;
    const tolerance = plan.matchCut.relays[0].tolerance.anchor;
    assert.equal(tolerance, 0.02, 'the original match budget must not be relaxed');
    // Scene.tsx uses this same speed for the seed and the incoming sun.
    const actualLastX = 0.5 - motion.scale * motion.speed / fps;
    assert.equal(outgoing.anchor[0], actualLastX);
    assert.equal(incoming.anchor[0], 0.5);
    assert.equal(outgoing.speed, motion.speed);
    assert.equal(incoming.speed, motion.speed);
    assert.ok(motion.speed > 0 && motion.speed <= 0.25);
    assert.ok(Math.abs(incoming.anchor[0] - actualLastX) <= tolerance + 1e-12);
    assert.equal(checked.editingMode.status, 'needs_review', 'a valid low-fps plan does not prove smooth playback');
  }
});

test('review request carries whole-action windows and both cut frames into existing hash-bound review planner', async t => {
  const {root, project, plan} = fixture(t);
  const checked = checkEditingMode(root, project, plan);
  const request = matchCutReviewRequest(project, plan, checked.cuts);
  assert.deepEqual(request.windows.map(({from, to}) => [from, to]), plan.shots.map(shot => [shot.from, shot.to]));
  assert.deepEqual(request.stills.map(still => still.frame), checked.cuts.flatMap(cut => [cut.frame - 1, cut.frame]));
  assert.ok(request.focus.some(note => /normal speed with sound/.test(note)));
  assert.ok(request.preserve.some(note => /approved narration, reading holds/.test(note)));
  const planned = planReview(project, plan, request);
  assert.equal(planned.dimensions.fps, project.fps);
  for (const cut of checked.cuts) assert.ok(planned.items.some(item => item.mode === 'preview' && item.frames.from < cut.frame && item.frames.to >= cut.frame));
  write(root, 'qc/request.json', request);
  const sourceHashes = snapshotSources(root);
  const result = await createReviewPack(root, request, {mode: 'plan', requestFile: 'qc/request.json'});
  assert.equal(result.status, 'needs_review'); assert.equal(result.mediaState, 'not_rendered');
  const packet = JSON.parse(fs.readFileSync(path.join(root, result.directory, 'review.json')));
  assert.equal(packet.visualReview, 'not_performed');
  assert.equal(packet.requestFileSha256, sha256File(path.join(root, 'qc/request.json')));
  assert.deepEqual(snapshotSources(root), sourceHashes);
  assert.throws(() => matchCutReviewRequest({...project, editingMode: 'standard'}, plan, checked.cuts), /Select and validate/);
  assert.throws(() => matchCutReviewRequest(project, plan, []), /Select and validate/);
});

test('CLI inspection and request generation are read-only, fail nonzero for invalid or inactive plans', t => {
  const {root, project, plan} = fixture(t);
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'scripts/match-cut-plan.mjs'), ...args], {encoding: 'utf8'});
  const before = snapshotSources(root);
  const report = run(root);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).status, 'needs_review');
  const requested = run(root, '--review-request');
  assert.equal(requested.status, 0, requested.stderr);
  assert.doesNotThrow(() => planReview(project, plan, JSON.parse(requested.stdout)));
  assert.deepEqual(snapshotSources(root), before);
  assert.equal(run(root, '--unknown').status, 1);
  assert.equal(run().status, 1);
  delete project.editingMode; delete plan.matchCut;
  for (const shot of plan.shots) delete shot.matchCut;
  write(root, 'project.json', project); write(root, 'script/storyboard.json', plan);
  const inactive = run(root);
  assert.equal(inactive.status, 1); assert.match(inactive.stderr, /not selected/);
  project.editingMode = MATCH_CUT_MODE; write(root, 'project.json', project);
  const invalid = run(root, '--review-request');
  assert.equal(invalid.status, 1); assert.equal(invalid.stdout, ''); assert.match(invalid.stderr, /Storyboard gate failed/);
});
