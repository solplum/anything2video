#!/usr/bin/env node
// Component-output regression, NOT browser rendering or visual/motion acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] ?? '.');
const requireProject = createRequire(path.join(root, 'package.json'));
const ts = requireProject('typescript');
const React = requireProject('react');
const remotion = requireProject('remotion');
assert.equal(requireProject('remotion/package.json').version, '4.0.507', 'Use the pinned template runtime');
const variant = JSON.parse(fs.readFileSync(path.join(root, 'script/study-provenance.json'))).variant;
assert.ok(['before', 'after'].includes(variant));
let frame = 0;
let config = {fps: 30, width: 1920, height: 1080, durationInFrames: 180};
const geometry = await import(pathToFileURL(path.join(root, 'src/demos/_fixtures/ReferenceGeometry.mjs')));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = {exports: {}};
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
  const localRequire = name => {
    if (name === 'remotion') return {...remotion, AbsoluteFill: 'AbsoluteFill', useCurrentFrame: () => frame, useVideoConfig: () => config};
    if (!name.startsWith('.')) return requireProject(name);
    if (name.endsWith('/ReferenceGeometry.mjs')) return geometry;
    const base = path.resolve(path.dirname(file), name);
    const resolved = [base, `${base}.tsx`, `${base}.ts`].find(candidate => fs.existsSync(candidate));
    assert.ok(resolved, `Missing local import ${name}`);
    return load(resolved);
  };
  vm.runInNewContext('(function(require,module,exports){' + js + '\n})', {}, {filename: file})(localRequire, module, module.exports);
  return module.exports;
}
function nodes(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
const Gradient = load(path.join(root, 'src/demos/transition/gradient-transition/GradientTransition.tsx')).GradientTransition;
const Gap = load(path.join(root, 'src/demos/interaction/autolayout-gap-dial/AutolayoutGapDial.tsx')).AutolayoutGapDial;
let invalidRadii = 0;
let lastRadius = 0;
for (frame = 0; frame < 180; frame++) {
  const layers = nodes(Gradient()).filter(node => /^(linear|radial|conic)-gradient\(/.test(node.props.style?.background ?? ''));
  assert.equal(layers.length, 3);
  assert.ok(Math.abs(layers.reduce((sum, node) => sum + node.props.style.opacity, 0) - 1) < 1e-12);
  const radial = layers[1].props.style.background;
  if (/radial-gradient\(circle [\d.]+% at/.test(radial)) invalidRadii++;
  if (variant === 'after') {
    const radius = Number(radial.match(/^radial-gradient\(circle ([\d.]+)px at/)[1]);
    assert.ok(radius >= 216 && radius <= 408 && radius >= lastRadius, `Invalid radius at frame ${frame}`);
    lastRadius = radius;
  }
}
assert.equal(invalidRadii, variant === 'before' ? 180 : 0);
if (variant === 'after') assert.equal(lastRadius, 408);

const trajectories = [];
for (const fps of [24, 30, 60]) {
  config = {...config, fps, durationInFrames: 120};
  let minGap = Infinity;
  let negativeWidths = 0;
  const trajectory = [];
  // Include the whole original action, plus enough elapsed spring time at 60 fps.
  for (frame = 0; frame < 66 + fps * 4; frame++) {
    const output = nodes(Gap());
    const blocks = output.filter(node => node.props.style?.height === 100 && [230, 190, 265, 210, 245].includes(node.props.style.width));
    const spans = output.filter(node => node.props.style?.height === 3 && node.props.style?.top === 644.5);
    const badges = output.filter(node => node.props.style?.top === 664 && node.props.style?.fontSize === 24);
    assert.equal(blocks.length, 5); assert.equal(spans.length, 4); assert.equal(badges.length, 4);
    const gap = blocks[1].props.style.left - blocks[0].props.style.left - blocks[0].props.style.width;
    trajectory.push(gap);
    minGap = Math.min(minGap, gap);
    const left = blocks[0].props.style.left;
    const right = blocks.at(-1).props.style.left + blocks.at(-1).props.style.width;
    assert.ok(Math.abs((left + right) / 2 - 960) < 1e-9);
    for (let i = 0; i < 4; i++) {
      const edge = blocks[i].props.style.left + blocks[i].props.style.width;
      const distance = blocks[i + 1].props.style.left - edge;
      const span = spans[i].props.style;
      if (span.width < 0) negativeWidths++;
      assert.ok(Math.abs(distance - gap) < 1e-9);
      assert.ok(Math.abs(span.width - distance) < 1e-9);
      assert.ok(Math.abs(span.left - edge) < 1e-9);
      assert.ok(Math.abs(badges[i].props.style.left - (edge + distance / 2)) < 1e-9);
      assert.ok(Math.abs(badges[i].props.children - gap) <= 1 + 1e-9);
      if (variant === 'after') assert.ok(span.width > 0 && span.width <= 110);
    }
  }
  assert.equal(trajectory[0], 12); assert.equal(trajectory[52], 110); assert.equal(trajectory[66], 110);
  assert.ok(Math.abs(trajectory.at(-1) - 12) < 0.01);
  if (variant === 'after') {assert.ok(minGap > 4 && minGap < 5); assert.equal(negativeWidths, 0);}
  else {assert.ok(minGap < -5); assert.ok(negativeWidths > 0);}
  trajectories.push({fps, minGap, negativeWidths});
}
// Out-of-order frame evaluation remains deterministic (as a renderer requires).
frame = 79; const one = JSON.stringify(Gap()); frame = 14; Gap(); frame = 79;
assert.equal(JSON.stringify(Gap()), one);
console.log(JSON.stringify({variant, componentChecks: 'passed', expectedKnownDefects: variant === 'before', invalidRadii, trajectories, browserCssValidation: 'not_performed', motionReview: 'not_performed', visualReview: 'not_performed'}, null, 2));
