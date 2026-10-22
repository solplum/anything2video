import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {tsLoader} from './helpers/load-ts.mjs';

const load = tsLoader();
const {revealProgress, revealRect, registrationOffset} = load('template/src/common/riso/timing.ts');
const {RisoPaper, InkPlate} = load('template/src/common/riso/index.ts');
const require = createRequire(new URL('../template/package.json', import.meta.url));
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const h = React.createElement;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

// These helpers consume frame units only: no hidden 30fps or integer rounding.
test('riso reveal is a linear, clamped sweep at arbitrary FPS and fractional frames', () => {
  for (const fps of [12, 24, 25, 30, 60, 24000 / 1001, 30000 / 1001]) {
    const event = {startFrame: 1.25 * fps, endFrame: 2.75 * fps};
    assert.equal(revealProgress(0, event), 0);
    assert.equal(revealProgress(event.startFrame, event), 0);
    near(revealProgress(2 * fps, event), 0.5);
    assert.equal(revealProgress(event.endFrame, event), 1);
    assert.equal(revealProgress(50 * fps, event), 1);
    for (let i = 0; i <= 100; i++) {
      near(revealProgress(event.startFrame + (event.endFrame - event.startFrame) * i / 100, event), i / 100);
    }
  }
  assert.equal(revealProgress(-12), 1);
  assert.equal(revealProgress(1.249, {startFrame: 1.25, endFrame: 1.25}), 0);
  assert.equal(revealProgress(1.25, {startFrame: 1.25, endFrame: 1.25}), 1);
});

test('sweep rectangles remain inside the paper for all four directions', () => {
  const event = {startFrame: 10, endFrame: 30};
  const cases = {
    'left-to-right': {x: 0, y: 0, width: 50, height: 80},
    'right-to-left': {x: 150, y: 0, width: 50, height: 80},
    'top-to-bottom': {x: 0, y: 0, width: 200, height: 20},
    'bottom-to-top': {x: 0, y: 60, width: 200, height: 20},
  };
  for (const [direction, expected] of Object.entries(cases)) {
    assert.deepEqual(revealRect(15, {...event, direction}, 200, 80), expected);
    assert.deepEqual(revealRect(30, {...event, direction}, 200, 80), {x: 0, y: 0, width: 200, height: 80});
    for (const frame of [-500, 10, 12.3, 29.9999, 30, 500]) {
      const rect = revealRect(frame, {...event, direction}, 200, 80);
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.width >= 0 && rect.height >= 0);
      assert.ok(rect.x + rect.width <= 200 + 1e-10 && rect.y + rect.height <= 80 + 1e-10);
    }
  }
});

test('bounded reveals spend the whole event sweeping the artwork region', () => {
  const bounds = {x: 440, y: 350, width: 400, height: 180};
  for (const fps of [24, 30, 60, 30000 / 1001]) {
    const event = {startFrame: 10 * fps, endFrame: 12 * fps, bounds};
    assert.deepEqual(revealRect(event.startFrame, event, 1280, 720), {...bounds, width: 0});
    near(revealRect(11 * fps, event, 1280, 720).width, 200);
    assert.deepEqual(revealRect(event.endFrame, event, 1280, 720), bounds);
    assert.deepEqual(revealRect(99 * fps, event, 1280, 720), bounds);
  }
  const event = {startFrame: 0, endFrame: 20, bounds};
  assert.deepEqual(revealRect(10, {...event, direction: 'right-to-left'}, 1280, 720), {...bounds, x: 640, width: 200});
  assert.deepEqual(revealRect(10, {...event, direction: 'top-to-bottom'}, 1280, 720), {...bounds, height: 90});
  assert.deepEqual(revealRect(10, {...event, direction: 'bottom-to-top'}, 1280, 720), {...bounds, y: 440, height: 90});
  for (const invalid of [
    {...bounds, x: -1}, {...bounds, y: -1}, {...bounds, width: 0}, {...bounds, height: -1},
    {...bounds, x: 900}, {...bounds, y: 600}, {...bounds, width: 900}, {...bounds, height: 500},
    ...['x', 'y', 'width', 'height'].flatMap(key => [NaN, Infinity, -Infinity].map(value => ({...bounds, [key]: value}))),
  ]) assert.throws(() => revealRect(10, {...event, bounds: invalid}, 1280, 720), RangeError);
});

test('registration is fixed except during explicit decaying kicks or one-time drift', () => {
  assert.deepEqual(registrationOffset(-1), {x: 0, y: 0});
  for (const frame of [-100, 0, 1, 1.25, 200, 100000]) {
    assert.deepEqual(registrationOffset(frame, {x: -2, y: 3}), {x: -2, y: 3});
  }
  for (const fps of [24, 30, 60, 30000 / 1001]) {
    const registration = {x: -2, y: 3, kicks: [{atFrame: 2 * fps, durationFrames: 0.5 * fps, x: 8, y: -4}]};
    assert.deepEqual(registrationOffset(2 * fps - 0.001, registration), {x: -2, y: 3});
    assert.deepEqual(registrationOffset(2 * fps, registration), {x: 6, y: -1});
    const mid = registrationOffset(2.25 * fps, registration);
    near(mid.x, 0); near(mid.y, 2);
    assert.deepEqual(registrationOffset(2.5 * fps, registration), {x: -2, y: 3});
    assert.deepEqual(registrationOffset(99999, registration), {x: -2, y: 3});
  }
  const drift = {x: 2, y: -1, drift: {startFrame: 10, endFrame: 20, x: 4, y: -2}};
  assert.deepEqual(registrationOffset(0, drift), {x: 2, y: -1});
  assert.deepEqual(registrationOffset(15, drift), {x: 4, y: -2});
  assert.deepEqual(registrationOffset(20, drift), {x: 6, y: -3});
  assert.deepEqual(registrationOffset(999, drift), {x: 6, y: -3});
});

test('overlapping events compose and out-of-order seeking is exactly deterministic', () => {
  const reveal = Object.freeze({startFrame: 8.75, endFrame: 22.5});
  const registration = Object.freeze({x: 1, y: 2,
    drift: Object.freeze({startFrame: 40.5, endFrame: 47.25, x: -3, y: 2}),
    kicks: Object.freeze([
      Object.freeze({atFrame: 10, durationFrames: 8, x: 4, y: -2}),
      Object.freeze({atFrame: 12, durationFrames: 4, x: -4, y: 2}),
    ]),
  });
  assert.deepEqual(registrationOffset(12, registration), {x: -0.75, y: 2.875});
  const evaluate = frame => ({offset: registrationOffset(frame, registration), reveal: revealProgress(frame, reveal)});
  const samples = Array.from({length: 100}, (_, i) => i * 0.75);
  const expected = new Map(samples.map(frame => [frame, evaluate(frame)]));
  for (const index of [90, 3, 70, 2, 0, 36, 99, 12, 0, 3, ...samples.keys()].reverse()) {
    assert.deepEqual(evaluate(samples[index]), expected.get(samples[index]));
  }
});

test('timing rejects invalid, nonfinite, reversed and overflowing values', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => revealProgress(bad), RangeError);
    assert.throws(() => registrationOffset(bad), RangeError);
    for (const key of ['startFrame', 'endFrame']) {
      assert.throws(() => revealProgress(0, {startFrame: 1, endFrame: 2, [key]: bad}), RangeError);
    }
    for (const key of ['x', 'y']) {
      assert.throws(() => registrationOffset(0, {[key]: bad}), RangeError);
    }
    for (const key of ['atFrame', 'durationFrames', 'x', 'y']) {
      assert.throws(() => registrationOffset(0, {kicks: [{atFrame: 10, durationFrames: 3, x: 1, y: 2, [key]: bad}]}), RangeError);
    }
    for (const key of ['startFrame', 'endFrame', 'x', 'y']) {
      assert.throws(() => registrationOffset(0, {drift: {startFrame: 10, endFrame: 20, x: 1, y: 2, [key]: bad}}), RangeError);
    }
  }
  assert.throws(() => revealProgress(0, {startFrame: 2, endFrame: 1}), RangeError);
  assert.throws(() => revealProgress(0, {startFrame: -1e308, endFrame: 1e308}), RangeError);
  assert.throws(() => revealProgress(0, {startFrame: 0, endFrame: 1, direction: 'diagonal'}), RangeError);
  for (const value of [0, -1, NaN, Infinity]) {
    assert.throws(() => revealRect(0, undefined, value, 100), RangeError);
    assert.throws(() => revealRect(0, undefined, 100, value), RangeError);
    assert.throws(() => registrationOffset(0, {kicks: [{atFrame: 1, durationFrames: value, x: 1, y: 1}]}), RangeError);
  }
  assert.throws(() => registrationOffset(1, {drift: {startFrame: 2, endFrame: 1, x: 1, y: 1}}), RangeError);
  assert.throws(() => registrationOffset(1e308, {x: 1e308, kicks: [{atFrame: 1e308, durationFrames: 1e308, x: 1, y: 1}]}), RangeError);
  assert.throws(() => registrationOffset(0, {x: 1e308, kicks: [{atFrame: 0, durationFrames: 1, x: 1e308, y: 0}]}), RangeError);
  assert.throws(() => registrationOffset(0, {kicks: [{atFrame: 1e308, durationFrames: 1, x: 1, y: 1}]}), RangeError);
});

const artwork = h('g', null,
  h('circle', {cx: 30, cy: 30, r: 20, fill: 'white'}),
  h('circle', {cx: 30, cy: 30, r: 5, fill: 'black'}));
const plate = (props = {}) => h(InkPlate, {id: 'same label', width: 100, height: 80, ink: '#0078BF', frame: 12, ...props}, artwork);
const paper = (...children) => h(RisoPaper, {id: 'paper', width: 100, height: 80}, ...children);

test('two ink plates use scoped luminance masks and multiply in an isolated paper SVG', () => {
  const tree = paper(plate({maskMode: 'luminance'}), plate({ink: '#FF48B0', maskMode: 'luminance'}));
  const markup = renderToStaticMarkup(tree);
  assert.equal(markup, renderToStaticMarkup(tree));
  assert.match(markup, /isolation:isolate;overflow:hidden/);
  assert.equal((markup.match(/mix-blend-mode:multiply/g) ?? []).length, 2);
  assert.equal((markup.match(/mask-type:luminance/g) ?? []).length, 2);
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate caller labels must not collide');
  for (const [, target] of markup.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.includes(target));
  assert.match(markup, /fill="white" color="white"/);
  assert.match(markup, /r="5" fill="black"/);
  assert.match(renderToStaticMarkup(paper(plate())), /mask-type:alpha/);
});

test('registration transforms only artwork, leaving reveal and halftone paper-fixed', () => {
  const markup = renderToStaticMarkup(paper(plate({
    registration: {x: -3, y: 2}, reveal: {startFrame: 10, endFrame: 20},
    halftone: {spacing: 8, radius: 2, baseOpacity: 0},
  })));
  assert.match(markup, /<clipPath[^>]+><rect x="0" y="0" width="20" height="80"><\/rect><\/clipPath>/);
  assert.equal((markup.match(/\btransform=/g) ?? []).length, 1);
  assert.match(markup, /transform="translate\(-3 2\)"/);
  assert.match(markup, /<pattern[^>]+x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">/);
  assert.match(markup, /width="8" height="8" fill="#0078BF" opacity="0"/);
  const solid = renderToStaticMarkup(paper(plate({halftone: false})));
  assert.doesNotMatch(solid, /-screen/);
});

test('component inputs fail before emitting invalid SVG', () => {
  for (const props of [
    {id: ''}, {ink: ' '}, {maskMode: 'invalid'}, {width: NaN}, {height: 0}, {frame: Infinity},
    {opacity: -0.1}, {opacity: 1.1}, {opacity: NaN},
    {halftone: {spacing: 0}}, {halftone: {radius: -1}}, {halftone: {radius: Infinity}},
    {halftone: {spacing: 4, radius: 3}}, {halftone: {baseOpacity: 1.1}},
  ]) assert.throws(() => renderToStaticMarkup(paper(plate(props))), RangeError);
  for (const props of [{id: ''}, {width: 0}, {height: Infinity}, {color: ''}, {grainOpacity: NaN}, {grainOpacity: 2}]) {
    assert.throws(() => renderToStaticMarkup(h(RisoPaper, {id: 'paper', width: 100, height: 80, ...props}, artwork)), RangeError);
  }
});

test('the reusable engine does not import poster/story artwork or mutable clocks', () => {
  for (const file of ['timing.ts', 'Plates.tsx', 'index.ts']) {
    const source = fs.readFileSync(new URL(`../template/src/common/riso/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Math\.random|Date\.now|new Date|world\.ts|riso-story|setInterval|requestAnimationFrame/);
  }
});
