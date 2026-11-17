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
const {
  EDITORIAL_THEMES,
  SWISS_SAFE,
  HeroMetricStage,
  EditorialSplitStage,
  ProcessFlowStage,
  ComparisonSplitStage,
  AnchoredCallout,
  ScrimSubtitle,
  computeCalloutGeometry,
} = load('template/src/common/layout/SwissStage.tsx');

test('editorial themes define distinct palettes and safe-zone geometry clears subtitle band', () => {
  assert.deepEqual(Object.keys(EDITORIAL_THEMES).sort(), ['jade-ink', 'obsidian', 'paper']);
  assert.notEqual(EDITORIAL_THEMES.obsidian.bg, EDITORIAL_THEMES.paper.bg);
  assert.ok(SWISS_SAFE.contentBottom < SWISS_SAFE.subtitleTop, 'content zone must clear subtitle band');
  assert.ok(SWISS_SAFE.subtitleTop + 56 < 687, 'subtitle band must stay above progress bar (BAR_TOP=687)');
});

test('computeCalloutGeometry connects anchor directly to badge border without floating gap', () => {
  const right = computeCalloutGeometry({x: 200, y: 180}, {x: 340, y: 140, width: 160, height: 48, label: '核心节点'});
  assert.deepEqual(right.anchor, {x: 200, y: 180});
  assert.deepEqual(right.badgeEdge, {x: 340, y: 140});
  assert.equal(right.badgeBox.x, 340);

  const left = computeCalloutGeometry({x: 420, y: 200}, {x: 280, y: 240, width: 140, height: 40, label: '左对齐'});
  assert.deepEqual(left.badgeEdge, {x: 280, y: 240});
  assert.equal(left.badgeBox.x + left.badgeBox.width, 280);
});

test('SwissStage archetypes render cleanly in SSR across themes without Remotion context errors', () => {
  const hero = renderToStaticMarkup(
    React.createElement(HeroMetricStage, {
      theme: 'paper',
      eyebrow: 'MOTION & AUDIO',
      sectionLabel: '01 / 04',
      category: 'EDITORIAL BENCHMARK',
      metric: '3.2x',
      unit: '流畅度提升',
      headline: '从规则驱动走向自然表达',
      subtitle: '用解析骨骼与瑞士网格替代手写坐标',
      benchmark: {baselineLabel: '旧版', targetLabel: '升级版', baselineRatio: 0.35, targetRatio: 0.92},
      frame: 24,
    }),
  );
  assert.match(hero, /data-editorial-stage="canvas"/);
  assert.match(hero, /data-theme="paper"/);
  assert.match(hero, /data-editorial-content="safe-zone"/);
  assert.match(hero, /3\.2x/);
  assert.doesNotMatch(hero, /NaN|undefined/);

  const split = renderToStaticMarkup(
    React.createElement(
      EditorialSplitStage,
      {
        theme: 'obsidian',
        title: '锚点精确指向目标',
        points: [
          {title: '解析 IK', detail: '保持定长不拉伸'},
          {title: '频段让位', detail: '850-3600Hz 留出人声空间'},
        ],
        frame: 20,
      },
      React.createElement(AnchoredCallout, {
        anchor: {x: 240, y: 220},
        badge: {x: 380, y: 180, label: 'IK 关节', detail: 'L1=49px'},
        frame: 20,
      }),
    ),
  );
  assert.match(split, /data-anchored-callout="true"/);
  assert.match(split, /M 240\.00 220\.00 L .* L 380\.00 180\.00/);

  const flow = renderToStaticMarkup(
    React.createElement(ProcessFlowStage, {
      theme: 'jade-ink',
      headline: '三步重塑成片质感',
      activeStep: 1,
      steps: [
        {tag: '01', title: '声音呼吸', detail: '语义停顿与拍点对齐', metric: '900ms'},
        {tag: '02', title: '骨骼动效', detail: 'IK 定长与弹簧跟随', metric: '0px 拉伸'},
        {tag: '03', title: '网格版式', detail: '安全区与高对比护栏', metric: '>=4.5:1'},
      ],
      frame: 28,
    }),
  );
  assert.match(flow, /三步重塑成片质感/);

  const cmp = renderToStaticMarkup(
    React.createElement(ComparisonSplitStage, {
      headline: '升级前后对照',
      left: {badge: 'BEFORE', title: '旧链路', rows: [{label: '停顿', value: '固定 10f'}]},
      right: {badge: 'AFTER', title: '新链路', accent: true, rows: [{label: '停顿', value: '语义 + 拍点'}]},
      frame: 22,
    }),
  );
  assert.match(cmp, /升级前后对照/);

  const sub = renderToStaticMarkup(
    React.createElement(ScrimSubtitle, {
      theme: 'paper',
      subs: [{from: 1, to: 60, text: '一句清晰可读的高对比字幕'}],
      frame: 10,
    }),
  );
  assert.match(sub, /data-scrim-subtitle="true"/);
  assert.match(sub, /一句清晰可读的高对比字幕/);
});
