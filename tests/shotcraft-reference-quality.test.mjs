import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {circleRadiusPx, boundedSpringGap} from '../gallery/demos-ref/_fixtures/ReferenceGeometry.mjs';
import {checkPlan} from '../scripts/check-plan.mjs';
import {planReview} from '../scripts/review-pack.mjs';
import {sha256File} from '../scripts/runtime-lib.mjs';
import {collectCoreFiles} from '../scripts/build-editions.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');

test('circle percentages resolve in design space, not against output width or an ellipse', () => {
  assert.equal(circleRadiusPx(45, 480), 216); assert.equal(circleRadiusPx(85, 480), 408);
  for (let percent = 45; percent <= 85; percent += 0.25) {
    const design = circleRadiusPx(percent, 480);
    assert.ok(design >= 216 && design <= 408);
    for (const output of [960, 1280, 1920]) assert.ok(Math.abs(design * output / 480 - percent * output / 100) < 1e-9);
  }
  const source = read('gallery/demos-ref/transition/gradient-transition/GradientTransition.tsx');
  assert.match(source, /circleRadiusPx\(rr, DESIGN_WIDTH\)/);
  assert.match(source, /radial-gradient\(circle \$\{rpx\}px at/);
  assert.match(source, /<DesignStage w=\{DESIGN_WIDTH\}/);
  assert.doesNotMatch(source, /radial-gradient\(circle \$\{rr\}%/);
});

test('only below-rest spring excursion is compressed; rebound is not removed by clamping to rest', () => {
  for (let n = 0; n <= 100; n++) {
    const progress = n / 100;
    assert.equal(boundedSpringGap(progress, 12, 110), 110 - 98 * progress);
  }
  const progress = 1.1783625740373199; // pinned Remotion 4.0.507 at return frame 13, 30 fps
  const old = 110 - 98 * progress;
  assert.ok(old < -5, 'known-bad control actually overlaps');
  assert.ok(Math.abs(boundedSpringGap(progress, 12, 110) - 4.134210484954195) < 1e-10);
  assert.ok(boundedSpringGap(1.01, 12, 110) < 12);
  assert.ok(Math.abs(boundedSpringGap(1 - 1e-9, 12, 110) - boundedSpringGap(1 + 1e-9, 12, 110)) < 1e-6, 'position-continuous crossing');
  for (let progress = -2; progress <= 4; progress += 0.001) {
    const gap = boundedSpringGap(progress, 12, 110);
    assert.ok(gap >= 0 && gap <= 110);
    assert.ok(Math.abs(Math.round(gap / 2) * 2 - gap) <= 1 + 1e-12);
  }
});

test('the mounted demo uses the bounded physical gap for blocks, spans, centres and readout', () => {
  const source = read('gallery/demos-ref/interaction/autolayout-gap-dial/AutolayoutGapDial.tsx');
  for (const expression of ['gap = boundedSpringGap(s, G_MIN, G_MAX)', 'Math.round(gap / 2) * 2', 'acc += w + gap', 'width: gap', 'left: gx + gap / 2']) assert.ok(source.includes(expression), expression);
  assert.match(source, /damping: 9, stiffness: 80, mass: 1\.1/);
  assert.match(source, /const GROW_START = 14/); assert.match(source, /const GROW_END = 52/); assert.match(source, /const HOLD_END = 66/);
});

test('portable before/after projects use real references and identical native action windows', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-shotcraft-'));
  t.after(() => fs.rmSync(parent, {recursive: true, force: true}));
  for (const variant of ['before', 'after']) {
    const root = path.join(parent, variant);
    const args = [path.join(repo, 'examples/shotcraft-reference-quality/prepare.mjs'), root, variant];
    const result = spawnSync(process.execPath, args, {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const project = JSON.parse(fs.readFileSync(path.join(root, 'project.json')));
    assert.deepEqual([project.width, project.height, project.fps, project.totalFrames], [1920, 1080, 30, 300]);
    assert.equal(project.status, 'draft'); assert.equal(project.audio.mode, 'silent');
    assert.equal(checkPlan(root).pass, true);
    const storyboard = JSON.parse(fs.readFileSync(path.join(root, 'script/storyboard.json')));
    const request = JSON.parse(fs.readFileSync(path.join(root, 'qc/reference-request.json')));
    const review = planReview(project, storyboard, request);
    assert.equal(review.status, 'needs_review');
    assert.deepEqual(review.items.filter(item => item.mode === 'preview').map(item => [item.frames.from, item.frames.to]), [[1, 180], [181, 300]]);
    assert.equal(review.summary.totalPreviewSeconds, 10);
    const provenance = JSON.parse(fs.readFileSync(path.join(root, 'script/study-provenance.json')));
    assert.equal(provenance.motionReview, 'not_performed');
    for (const item of provenance.copied) assert.equal(sha256File(path.join(root, item.path)), item.sha256);
    for (const control of provenance.controls) assert.equal(sha256File(path.join(root, `src/demos/${control.relative}`)), variant === 'before' ? control.sha256 : sha256File(path.join(repo, `gallery/demos-ref/${control.relative}`)));
    const scene = fs.readFileSync(path.join(root, 'src/Root.tsx'), 'utf8');
    assert.match(scene, /from=\{shot.from - 1\}/); assert.match(scene, /durationInFrames=\{shot.to - shot.from \+ 1\}/);
    assert.equal(fs.existsSync(path.join(root, 'renders')), false);
    assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
    assert.equal(spawnSync(process.execPath, args, {encoding: 'utf8'}).status, 1, 'never overwrite a prior study');
  }
});

test('preparation rejects unknown variants and destinations overlapping the source tree', () => {
  const script = path.join(repo, 'examples/shotcraft-reference-quality/prepare.mjs');
  for (const args of [[repo, 'after'], [path.dirname(repo), 'after'], [path.join(repo, 'bad-study'), 'before'], ['/tmp/not-created-by-shotcraft-test', 'latest'], ['/tmp/not-created-by-shotcraft-test', 'after', 'extra']]) assert.equal(spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'}).status, 1);
});

test('the distributed core retains both controls, preparation, checker and Apache notices', () => {
  const files = collectCoreFiles(repo);
  for (const file of ['examples/shotcraft-reference-quality/prepare.mjs', 'examples/shotcraft-reference-quality/check-components.mjs', 'examples/shotcraft-reference-quality/Root.tsx', 'examples/shotcraft-reference-quality/README.md', 'examples/shotcraft-reference-quality/baseline/GradientTransition.tsx.txt', 'examples/shotcraft-reference-quality/baseline/AutolayoutGapDial.tsx.txt', 'gallery/demos-ref/MODIFICATIONS.md', 'gallery/demos-ref/_fixtures/ReferenceGeometry.mjs', 'gallery/demos-ref/_fixtures/ReferenceGeometry.d.mts', 'LICENSE-THIRDPARTY/APACHE-2.0-video-shotcraft.txt']) assert.ok(files.includes(file), `Core missing ${file}`);
});
