import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {tsLoader} from './helpers/load-ts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'template/package.json'));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

const load = tsLoader();
const {solveTwoBoneIK, walkPelvisState, followSpring, arcPoint} = load('template/src/common/motion/kinematics.ts');
const {CharacterActionFrame} = load('template/src/shots/character-action/Demo.tsx');

test('solveTwoBoneIK preserves exact rigid segment lengths L1 and L2 across reachable and clamped targets', () => {
  const L1 = 49;
  const L2 = 49;
  const origin = {x: 265, y: 470};
  const targets = [
    {x: 250, y: 558},
    {x: 310, y: 540},
    {x: 265, y: 470.001}, // collapsed near root
    {x: 500, y: 650},     // far beyond max reach
  ];
  for (const bendDir of [1, -1]) {
    for (const target of targets) {
      const res = solveTwoBoneIK(origin, target, L1, L2, bendDir);
      const d1 = Math.hypot(res.joint.x - origin.x, res.joint.y - origin.y);
      const d2 = Math.hypot(res.end.x - res.joint.x, res.end.y - res.joint.y);
      assert.ok(Math.abs(d1 - L1) < 1e-6, `L1 drifted: ${d1}`);
      assert.ok(Math.abs(d2 - L2) < 1e-6, `L2 drifted: ${d2}`);
    }
  }
  const bendRight = solveTwoBoneIK({x: 100, y: 100}, {x: 100, y: 180}, 50, 50, 1);
  const bendLeft = solveTwoBoneIK({x: 100, y: 100}, {x: 100, y: 180}, 50, 50, -1);
  assert.ok(bendRight.joint.x > 100);
  assert.ok(bendLeft.joint.x < 100);
  assert.throws(() => solveTwoBoneIK(origin, {x: 0, y: 0}, 0, 50, 1));
  assert.throws(() => solveTwoBoneIK(origin, {x: NaN, y: 0}, 50, 50, 1));
});

test('walkPelvisState produces vertical weight shift between double-support and mid-swing', () => {
  const idle = walkPelvisState(0, 0, false, 0);
  assert.equal(idle.bobY, 0);
  const contactDrop = walkPelvisState(0, 0, true, 0);
  const midStrideLift = walkPelvisState(0.5, 0, true, 0);
  assert.ok(contactDrop.bobY > 0, 'pelvis absorbs weight on contact');
  assert.ok(midStrideLift.bobY < contactDrop.bobY, 'pelvis rises at mid-swing');
  assert.ok(walkPelvisState(0.5, 0, true, 0.8).tiltDeg !== 0);
});

test('followSpring is frame-pure, order-independent, lags then settles smoothly', () => {
  const stepAt = f => (f >= 10 ? 100 : 0);
  const lateFirst = followSpring(stepAt, 18, {stiffness: 0.18, damping: 0.72});
  const earlyFirst = followSpring(stepAt, 12, {stiffness: 0.18, damping: 0.72});
  const lateAgain = followSpring(stepAt, 18, {stiffness: 0.18, damping: 0.72});
  assert.deepEqual(lateFirst, lateAgain, 'must be independent of evaluation order');
  assert.ok(earlyFirst.value > 0 && earlyFirst.value < 100, 'lags smoothly behind step');
  const settled = followSpring(stepAt, 60, {stiffness: 0.18, damping: 0.72, historyFrames: 60});
  assert.ok(Math.abs(settled.value - 100) < 0.1, `expected settle near 100, got ${settled.value}`);
  assert.throws(() => followSpring(stepAt, 10, {damping: 1.0}));
});

test('arcPoint interpolates endpoints and lifts midpoint smoothly', () => {
  const p0 = arcPoint({x: 0, y: 100}, {x: 100, y: 100}, 0, 25);
  const pMid = arcPoint({x: 0, y: 100}, {x: 100, y: 100}, 0.5, 25);
  const p1 = arcPoint({x: 0, y: 100}, {x: 100, y: 100}, 1, 25);
  assert.deepEqual(p0, {x: 0, y: 100});
  assert.deepEqual(pMid, {x: 50, y: 75});
  assert.deepEqual(p1, {x: 100, y: 100});
});

test('upgraded CharacterActionFrame renders valid deterministic SVG across motion phases', () => {
  const svgStart = renderToStaticMarkup(React.createElement(CharacterActionFrame, {frame: 0, fps: 30, contactSec: 3}));
  const svgMidWalk = renderToStaticMarkup(React.createElement(CharacterActionFrame, {frame: 45, fps: 30, contactSec: 3}));
  const svgContact = renderToStaticMarkup(React.createElement(CharacterActionFrame, {frame: 95, fps: 30, contactSec: 3}));
  const svgEnd = renderToStaticMarkup(React.createElement(CharacterActionFrame, {frame: 239, fps: 30, contactSec: 3}));
  for (const markup of [svgStart, svgMidWalk, svgContact, svgEnd]) {
    assert.match(markup, /^<svg[^>]*viewBox="0 0 1280 720"/);
    assert.doesNotMatch(markup, /NaN|undefined/);
  }
  assert.equal(
    renderToStaticMarkup(React.createElement(CharacterActionFrame, {frame: 45, fps: 30, contactSec: 3})),
    svgMidWalk,
  );
  // Extract head ellipse cy to verify pelvis/head vertical motion is active during walk
  const cy0 = Number(svgStart.match(/<ellipse cx="[0-9.]+" cy="([0-9.]+)" rx="29" ry="34"/)?.[1]);
  const cy45 = Number(svgMidWalk.match(/<ellipse cx="[0-9.]+" cy="([0-9.]+)" rx="29" ry="34"/)?.[1]);
  assert.ok(Number.isFinite(cy0) && Number.isFinite(cy45));
  assert.notEqual(cy0, cy45, 'head vertical position should move with gait bob/overlap');
});
