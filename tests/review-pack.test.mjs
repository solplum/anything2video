import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {planReview, createReviewPack, reviewDocuments} from '../scripts/review-pack.mjs';
import {snapshotSources, sha256File} from '../scripts/runtime-lib.mjs';

const cfg = {width: 1080, height: 1920, fps: 24, totalFrames: 240, slug: 'film'};
const story = {shots: [
  {id: 'B', from: 121, to: 240, group: 'G1', component: './src/B.tsx', purpose: 'Allow reading', action: 'Hold the result still intentionally'},
  {id: 'A', from: 1, to: 120, group: 'G1', component: 'src/A.tsx', purpose: 'Explain transfer', action: 'Move request, contact target, release'},
]};
const req = {schemaVersion: 1, id: 'review-v1'};
const write = (base, file, value) => {fs.mkdirSync(path.dirname(path.join(base, file)), {recursive: true}); fs.writeFileSync(path.join(base, file), typeof value === 'string' ? value : JSON.stringify(value));};
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-review-pack-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'project.json', cfg); write(root, 'script/storyboard.json', story);
  write(root, 'src/A.tsx', 'export const A = () => null;'); write(root, 'src/B.tsx', 'export const B = () => null;');
  return root;
}

test('automatic coverage uses unchanged fps/dimensions, sorted shots and both cut sides', () => {
  const plan = planReview(cfg, story, req);
  assert.deepEqual(plan.dimensions, {width: 1080, height: 1920, fps: 24, totalFrames: 240});
  assert.deepEqual(plan.renderRequest.windows.map(({from, to}) => [from, to]), [[1, 72], [85, 156], [109, 132], [169, 240]]);
  assert.equal(plan.summary.totalPreviewSeconds, 10);
  assert.equal(plan.summary.overlappingWindows, true);
  assert.equal(plan.renderRequest.allowOverlap, true);
  const cut = plan.items.find(item => item.selections.some(reason => reason.cutAtFrame === 121));
  assert.deepEqual(cut.shotIds, ['A', 'B']);
  assert.equal(cut.frames.from, 109); assert.equal(cut.frames.to, 132);
  assert.ok(plan.items.some(item => item.selections.some(reason => reason.label?.includes('not inferred complexity'))));
});

test('explicit unsorted duplicates share media but preserve each named cue/choice, with endpoint dedupe', () => {
  const input = {...req, automatic: {opening: false, middle: false, ending: false, cuts: false}, reviewer: 'Director', focus: ['occlusion'], preserve: ['intentional static hold'], windows: [{id: 'late', from: 121, to: 144, shotId: 'B'}, {id: 'early', from: 1, to: 24}, {id: 'repeat', from: 121, to: 144, note: 'check again'}], cues: [{id: 'contact', frame: 132, beforeFrames: 11, afterFrames: 12, shotId: 'B'}], stills: [{id: 'first', frame: 121}]};
  const plan = planReview(cfg, story, input);
  assert.equal(plan.summary.windows, 2); assert.equal(plan.summary.stills, 4);
  const item = plan.items.find(item => item.id === 'w-121-144');
  assert.equal(item.selections.length, 3); assert.equal(item.time.previewLocalEndSeconds, 0.958333333);
  assert.equal(item.time.sourceStartSeconds, 5); assert.equal(item.time.encodedDurationSeconds, 1);
  assert.equal(plan.items.find(item => item.id === 's-121').selections.length, 2);
  assert.deepEqual(plan.reviewerChoices, {reviewer: 'Director', focus: ['occlusion'], preserve: ['intentional static hold']});
  assert.equal(plan.shots[1].action, story.shots[0].action);
  assert.deepEqual(input.windows[0], {id: 'late', from: 121, to: 144, shotId: 'B'});
});

test('short films merge coverage reasons; one-frame windows remain honest and cannot prove movement', () => {
  const singleCfg = {...cfg, totalFrames: 1};
  const singleStory = {shots: [{...story.shots[0], from: 1, to: 1}]};
  const plan = planReview(singleCfg, singleStory, req);
  assert.equal(plan.summary.windows, 1); assert.equal(plan.summary.stills, 1);
  assert.equal(plan.items[0].selections.length, 3); assert.equal(plan.items[0].time.previewLocalEndSeconds, 0);
  const packet = {...plan, mediaState: 'not_rendered', sourceSnapshotSha256: 'a'.repeat(64), shots: plan.shots.map(shot => ({...shot, componentSha256: 'b'.repeat(64)})), items: plan.items.map(item => ({...item, plannedMedia: `${item.id}.mp4`}))};
  assert.match(reviewDocuments(packet).checklist, /one frame cannot meet the two-distinct-frame minimum/);
  assert.match(reviewDocuments(packet).index, /PLAN ONLY/);
});

test('input validation rejects unknown fields, malformed ranges, duplicate ids and wrong shot association', () => {
  for (const change of [
    {schemaVersion: 2}, {id: '../escape'}, {windows: null}, {cues: null}, {stills: null}, {unknown: true}, {automatic: {scale: 0.5}}, {automatic: {opening: 1}}, {automatic: {windowSeconds: '3'}},
    {automatic: false}, {windows: [{id: 'bad', from: 0, to: 10}]}, {windows: [{id: 'bad', from: 4, to: 3}]}, {windows: [{id: 'bad', from: 1, to: 999}]},
    {cues: [{id: 'bad', frame: 1, beforeFrames: -1}]}, {cues: [{id: 'bad', frame: 2.4}]}, {stills: [{id: 'same', frame: 1}, {id: 'SAME', frame: 2}]},
    {windows: [{id: 'bad', from: 1, to: 2, shotId: 'B'}]}, {windows: [{id: 'bad', from: 1, to: 2, shotId: 'missing'}]}, {focus: 'invalid'},
  ]) assert.throws(() => planReview(cfg, story, {...req, ...change}), undefined, JSON.stringify(change));
  assert.throws(() => planReview(cfg, story, {...req, windows: [{id: 'same', from: 1, to: 2}], cues: [{id: 'SAME', frame: 1}]}), /unique/);
});

test('plan output is portable, immutable and not rendered; explicit request hash invalidates ignored request locations', async t => {
  const root = fixture(t);
  const sources = snapshotSources(root);
  const request = {...req, preserve: ['static hold'], reviewer: '[Name](javascript:alert(1))'};
  write(root, 'qc/request.json', request);
  const summaries = [];
  const result = await createReviewPack(root, request, {mode: 'plan', onPlan: value => summaries.push(value)});
  assert.equal(result.directory, 'qc/review-plans/review-v1'); assert.equal(result.mediaState, 'not_rendered'); assert.equal(summaries.length, 1);
  assert.deepEqual(snapshotSources(root), sources);
  const directory = path.join(root, result.directory);
  const packet = JSON.parse(fs.readFileSync(path.join(directory, 'review.json')));
  assert.equal(packet.status, 'needs_review'); assert.equal(packet.visualReview, 'not_performed');
  assert.equal(packet.shots[1].componentSha256, sha256File(path.join(root, 'src/B.tsx')));
  for (const item of packet.items) {assert.equal(item.media, undefined); assert.equal(item.mediaSha256, undefined); assert.equal(item.mediaState, 'not_rendered');}
  assert.deepEqual(fs.readdirSync(directory).sort(), ['checklist.md', 'index.md', 'request.json', 'review.json']);
  for (const file of fs.readdirSync(directory)) assert.ok(!fs.readFileSync(path.join(directory, file), 'utf8').includes(root));
  assert.ok(!fs.existsSync(path.join(root, 'renders')));
  assert.notEqual(planReview(cfg, story, {...request, preserve: ['different hold']}).requestSha256, packet.requestSha256);
  await assert.rejects(createReviewPack(root, request), /already exists/);
});

test('plan output refuses existing/symlink paths, external roots and lock conflicts without cleanup of user data', async t => {
  const root = fixture(t);
  write(root, 'qc/review-plans/review-v1', 'do not touch');
  await assert.rejects(createReviewPack(root, req), /already exists/);
  assert.equal(fs.readFileSync(path.join(root, 'qc/review-plans/review-v1'), 'utf8'), 'do not touch');
  fs.unlinkSync(path.join(root, 'qc/review-plans/review-v1'));
  fs.symlinkSync(path.join(root, 'absent'), path.join(root, 'qc/review-plans/review-v1'));
  await assert.rejects(createReviewPack(root, req));
  fs.unlinkSync(path.join(root, 'qc/review-plans/review-v1'));
  write(root, 'qc/review-plans/review-v1.review.lock', 'keep this lock');
  await assert.rejects(createReviewPack(root, req), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(root, 'qc/review-plans/review-v1.review.lock'), 'utf8'), 'keep this lock');
});

test('CLI plan prints cost before work and does not need browser or TypeScript', t => {
  const root = fixture(t); write(root, 'qc/request.json', req);
  const result = spawnSync(process.execPath, ['scripts/review-pack.mjs', root, 'plan', 'qc/request.json'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.match(result.stderr, /4 windows \+ 8 stills; 10s/); assert.match(result.stderr, /No rendering requested/);
  assert.equal(JSON.parse(result.stdout).mediaState, 'not_rendered');
  const bad = spawnSync(process.execPath, ['scripts/review-pack.mjs', root, 'plan', '../secret.json'], {encoding: 'utf8'});
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /Outside project/);
});

test('request file under ignored qc is bound independently and edits abort before publishing', async t => {
  const root = fixture(t); write(root, 'qc/request.json', req);
  await assert.rejects(createReviewPack(root, req, {requestFile: 'qc/request.json', onPlan: () => write(root, 'qc/request.json', {...req, preserve: ['changed']})}), /Request file changed/);
  assert.ok(!fs.existsSync(path.join(root, 'qc/review-plans/review-v1')));
  await assert.rejects(createReviewPack(root, req, {requestFile: 'qc/request.json'}), /differs/);
  write(root, 'qc/request.json', req);
  const result = await createReviewPack(root, req, {requestFile: 'qc/request.json'});
  const packet = JSON.parse(fs.readFileSync(path.join(root, result.directory, 'review.json')));
  assert.equal(packet.requestFileSha256, sha256File(path.join(root, 'qc/request.json')));
});

test('documented request is accepted by the real parser and preserves optional choices', () => {
  const document = fs.readFileSync('reference/action-review.md', 'utf8');
  const example = JSON.parse(document.match(/```json\n([\s\S]+?)\n```/)[1]);
  const exampleStory = {shots: [{...story.shots[1], id: 'S1', from: 1, to: 96}, {...story.shots[0], id: 'S2', from: 97, to: 240}]};
  const plan = planReview(cfg, exampleStory, example);
  assert.equal(plan.actionReview.samples, 8); assert.deepEqual(plan.actionReview.roi, [0.2, 0.1, 0.6, 0.8]);
  assert.ok(plan.items.some(item => item.selections.some(selection => selection.id === 'cue:request-arrive')));
  for (const actionReview of [{samples: 1}, {samples: 8, interval: 0.2}, {roi: [0, 0, 2, 1]}, {roi: [0, 0, 0, 1]}, {enabled: 1}]) assert.throws(() => planReview(cfg, story, {...req, actionReview}));
  assert.throws(() => planReview(cfg, story, {...req, id: 123}), /safe id/);
  assert.throws(() => planReview(cfg, story, {...req, stills: [{id: 123, frame: 1}]}), /unique/);
});

test('actual existing-media strips preserve hashes, decoded PTS and full-film source frame mapping (not a browser-render test)', async t => {
  const {postprocessReviewActions} = await import('../scripts/review-pack.mjs');
  const root = fixture(t);
  const media = path.join(root, 'w-25-72.mp4');
  const encode = spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=64x64:rate=24', '-frames:v', '48', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', media], {encoding: 'utf8'});
  assert.equal(encode.status, 0, encode.stderr);
  const plan = planReview(cfg, story, {...req, automatic: false, windows: [{id: 'transfer', from: 25, to: 72}], actionReview: {samples: 8, roi: [0, 0, 0.5, 1]}});
  const packet = {...plan, sourceSnapshotSha256: 'a'.repeat(64), items: plan.items.map(item => ({...item, media: path.basename(media), mediaSha256: sha256File(media)}))};
  const before = sha256File(media);
  postprocessReviewActions(root, packet);
  assert.equal(sha256File(media), before);
  const action = packet.items[0].actionReview;
  assert.equal(action.generation, 'generated'); assert.equal(action.status, 'needs_review');
  const report = JSON.parse(fs.readFileSync(path.join(root, action.report)));
  assert.equal(report.video, '../../w-25-72.mp4'); assert.equal(report.videoSha256, before); assert.equal(report.decodedFrameCount, 48);
  assert.equal(report.windows[0].frames[0].sourceFrame1Based, 25); assert.equal(report.windows[0].frames.at(-1).sourceFrame1Based, 72);
  assert.equal(report.windows[0].frames.at(-1).timeSec, 1.958333);
  for (const window of report.windows) for (const frame of window.frames) assert.equal(frame.sourceFrame1Based, frame.index + 25);
  for (const strip of action.strips) assert.equal(sha256File(path.join(root, strip.path)), strip.sha256);
  assert.equal(sha256File(path.join(root, action.report)), action.reportSha256);
  assert.ok(!JSON.stringify(report).includes(root));
  assert.throws(() => postprocessReviewActions(root, packet), /already exists/);
  const unsafe = structuredClone(packet); unsafe.items[0].id = '../outside';
  assert.throws(() => postprocessReviewActions(root, unsafe), /Unsafe action item/);
});

test('disabled/single-frame action selections stay explicitly not_performed and missing dependencies fail before rendering', async t => {
  const {postprocessReviewActions} = await import('../scripts/review-pack.mjs');
  const root = fixture(t);
  for (const request of [
    {...req, automatic: false, windows: [{id: 'one', from: 1, to: 1}]},
    {...req, automatic: false, windows: [{id: 'two', from: 1, to: 2}], actionReview: {enabled: false}},
  ]) {
    const plan = planReview(cfg, story, request);
    const packet = {...plan, items: plan.items.map(item => ({...item, media: 'absent.mp4'}))};
    postprocessReviewActions(root, packet);
    assert.equal(packet.items[0].actionReview.generation, 'not_performed');
  }
  await assert.rejects(createReviewPack(root, {...req, windows: [{id: 'action', from: 1, to: 24}]}, {mode: 'render'}, {...process.env, A2V_PYTHON: '/nonexistent/python'}), /No render started/);
  assert.ok(!fs.existsSync(path.join(root, 'renders')));
});

test('plan directories reject even in-project symlink aliases like the batch renderer', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'existing-data'));
  fs.symlinkSync(path.join(root, 'existing-data'), path.join(root, 'qc'));
  await assert.rejects(createReviewPack(root, req), /symlink/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'existing-data')), []);
});
