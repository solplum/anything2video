import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const card = relative => `gallery/cards/${relative}.md`;
const approx = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
// Execute the actual documentation examples, not a duplicated formula in the test.
const example = (file, marker, exports) => {
  const text = read(file);
  const match = text.match(new RegExp(`<!-- audit-example:${marker} -->\\s*\x60\x60\x60js\\n([\\s\\S]*?)\\n\x60\x60\x60`));
  assert.ok(match, `${file}: missing ${marker} example`);
  return vm.runInNewContext(`${match[1]}\n({${exports.join(',')}})`, Object.create(null), {timeout: 1000});
};
const cineticCards = [
  'camera/detail-first-pullback', 'camera/exploded-layer-stack', 'camera/fit-bounds-follow', 'camera/pull-lands-event',
  'data/area-ratio-compare', 'data/delta-chip-compare', 'data/unit-grid-tally', 'effects/accent-on-newest',
  'interaction/anticipation-dip-unlock', 'opening/result-first-rewind', 'transition/anchor-overlay-cut',
  'transition/scale-through-cut', 'typography/line-rebreak-glide', 'typography/reading-order-exit', 'ui-entrance/clutter-pileup-strip',
];
const {staggerStart} = example(card('camera/exploded-layer-stack'), 'stagger', ['staggerStart']);
const {followAlpha, followStep} = example(card('camera/fit-bounds-follow'), 'follow', ['followAlpha', 'followStep']);
const {ratioAtFps, macroScale} = example(card('transition/scale-through-cut'), 'scale', ['ratioAtFps', 'macroScale']);
const {exampleDistribution, exampleTopK} = example(card('typography/token-probability-bars'), 'probabilities', ['exampleDistribution', 'exampleTopK']);
const {burnDistanceAt, exampleBurnKnots} = example(card('transition/fuse-burn-reveal'), 'fuse', ['burnDistanceAt', 'exampleBurnKnots']);
const {dialStateFromDisplacement} = example('styles/isometric-anatomy/SPEC.md', 'dial', ['dialStateFromDisplacement']);

test('all 15 cinetic cards remain attributed drafts, not newly implemented components', () => {
  assert.equal(cineticCards.length, 15);
  for (const file of cineticCards) {
    const text = read(card(file));
    assert.match(text, /手法研究自 cinetic \(MIT, Leonxlnx\)；配方说明独立整理，尚无本仓实现\/演示/);
    assert.match(text, /暂无（草稿卡）/);
    assert.doesNotMatch(text, /, 实现重写/);
  }
  const attribution = read('gallery/cards/ATTRIBUTION.md');
  assert.match(attribution, /15 张手法研究草稿/);
  assert.match(attribution, /MIT-cinetic\.txt/);
  assert.doesNotMatch(attribution, /手法参考，重写实现；各卡头部/);
  assert.match(read('gallery/README.md'), /并非每张卡都有本地实现/);
});

test('stagger spans six total frames regardless of layer count', () => {
  for (const count of [2, 3, 4, 5, 8, 13]) {
    const offsets = Array.from({length: count}, (_, i) => staggerStart(i, count));
    approx(offsets[0], 0); approx(offsets.at(-1), 6);
    for (let i = 1; i < count; i++) approx(offsets[i] - offsets[i - 1], 6 / (count - 1));
  }
  assert.deepEqual(Array.from({length: 5}, (_, i) => staggerStart(i, 5)), [0, 1.5, 3, 4.5, 6]);
  assert.equal(staggerStart(0, 1), 0);
});

test('stagger conversion preserves seconds, rather than per-layer delay', () => {
  for (let i = 0; i < 5; i++) approx(staggerStart(i, 5, 12) / 60, staggerStart(i, 5, 6) / 30);
  const text = read(card('camera/exploded-layer-stack'));
  assert.doesNotMatch(text, /层间 stagger 6f|\| 拆开 stagger \| 6f\/层/);
  assert.match(text, /总 span 6f @30fps/);
});

test('stagger rejects invalid layer indices, counts and spans', () => {
  for (const args of [[-1, 5], [5, 5], [0, 0], [0.5, 2], [0, 1.5], [0, 2, -1], [0, 2, NaN]]) assert.throws(() => staggerStart(...args), /invalid stagger/);
});

test('low-pass alpha preserves fixed-target decay across frame rates', () => {
  approx(followAlpha(0.07, 60, 30), 0.1351);
  approx(followAlpha(0.06, 60, 30), 0.1164);
  approx(followAlpha(0.08, 60, 30), 0.1536);
  const settle = (fps, alpha) => {let v = 0; for (let f = 0; f < fps; f++) v = followStep(v, 10, alpha); return v;};
  for (const fps of [24, 30, 60, 120]) approx(settle(fps, followAlpha(0.07, 60, fps)), settle(60, 0.07));
});

test('larger alpha follows faster, smaller alpha leaves more lag', () => {
  assert.ok(followStep(0, 10, 0.2) > followStep(0, 10, 0.1));
  assert.equal(followStep(0, 10, 1), 10);
  assert.equal(followStep(0, 10, 0), 0);
  approx(followAlpha(0, 60, 30), 0); approx(followAlpha(1, 60, 30), 1);
  const text = read(card('camera/fit-bounds-follow'));
  assert.match(text, /0\.1351\/帧/);
  assert.match(text, /大了跟随更快、平滑更少；小了更平滑但滞后更多/);
  assert.doesNotMatch(text, /大了镜头发飘追不上/);
});

test('low-pass conversion rejects invalid alpha and fps', () => {
  for (const args of [[-0.1, 60, 30], [1.1, 60, 30], [NaN, 60, 30], [0.07, 0, 30], [0.07, 60, Infinity]]) assert.throws(() => followAlpha(...args), /invalid follow/);
});

test('scale ratios preserve constant log speed rather than copied per-frame percentages', () => {
  approx(ratioAtFps(0.93, 60, 30), 0.8649);
  approx(ratioAtFps(0.91, 60, 30), 0.8281);
  approx(ratioAtFps(0.84, 60, 30), 0.7056);
  for (const r of [0.91, 0.93, 1, 1.07]) for (const fps of [24, 30, 60, 120]) {
    approx(Math.log(ratioAtFps(r, 60, fps)) * fps, Math.log(r) * 60);
    approx(ratioAtFps(ratioAtFps(r, 60, fps), fps, 60), r);
  }
});

test('macro decay acts on scale excess and reaches the documented threshold at frames 19–20', () => {
  const firstSettled = (start, fps) => {let f = 0; while (Math.abs(macroScale(f, fps, start) - 1) >= 0.01) f++; return f;};
  assert.equal(firstSettled(8, 30), 19); assert.equal(firstSettled(9, 30), 20);
  assert.equal(firstSettled(8, 60), 38); assert.equal(firstSettled(9, 60), 39);
  for (const start of [8, 9]) {
    assert.equal(macroScale(0, 30, start), start);
    assert.ok(macroScale(15, 30, start) - 1 > 0.01);
    for (let f = 0; f <= 30; f++) approx(macroScale(f, 30, start), macroScale(f * 2, 60, start));
    assert.ok(macroScale(30, 30, start) > 1);
  }
  assert.match(read(card('transition/scale-through-cut')), /19–20f/);
  assert.doesNotMatch(read(card('transition/scale-through-cut')), /约 15f 收定|首帧单帧 −8%~−9% 是缝消失的硬指标/);
});

test('scale conversion rejects nonpositive and nonfinite ratios or fps', () => {
  for (const args of [[0, 60, 30], [-1, 60, 30], [NaN, 60, 30], [Infinity, 60, 30], [0.9, -60, 30], [0.9, 60, 0]]) assert.throws(() => ratioAtFps(...args), /invalid scale ratio/);
});

test('probability example is explicitly illustrative and normalized, with non-argmax sampling', () => {
  assert.equal(exampleDistribution.evidence, 'illustrative');
  assert.equal(exampleDistribution.tokenization, 'placeholder_ids');
  assert.equal(exampleDistribution.strategy, 'sampling');
  const {candidates, selected} = exampleDistribution;
  approx(candidates.reduce((sum, c) => sum + c.p, 0), 1);
  assert.ok(candidates.every(c => c.p >= 0 && c.p <= 1));
  assert.ok(candidates.find(c => c.token === selected).p < Math.max(...candidates.map(c => c.p)));
});

test('probability prose permits binary distributions, coincident word tokens and sampled maxima', () => {
  const text = read(card('typography/token-probability-bars'));
  assert.match(text, /不必与字或词一一对应/);
  assert.match(text, /采样可能选中最高项，也允许选中其他项/);
  assert.match(text, /二元分布同样成立/);
  assert.doesNotMatch(text, /真实 token 不等于字或词|只有贪心策略才选择 argmax|<3 不成.*分布/);
});

test('top-k example includes other mass on the full distribution scale', () => {
  assert.equal(exampleTopK.evidence, 'illustrative');
  assert.equal(exampleTopK.basis, 'full_distribution');
  assert.ok(exampleTopK.other > 0);
  approx(exampleTopK.candidates.reduce((sum, c) => sum + c.p, exampleTopK.other), 1);
  const text = read(card('typography/token-probability-bars'));
  assert.match(text, /字体不决定分词/);
  assert.match(text, /统一|相同 0–1 比例尺/);
  assert.doesNotMatch(text, /概率加和不必=1|主 token 必须居首|候选词必须写/);
  assert.match(text, /本仓无 demo/);
});

test('event-driven fuse reaches every knot exactly and clamps outside the timeline', () => {
  for (const k of exampleBurnKnots) approx(burnDistanceAt(k.time, exampleBurnKnots), k.distance);
  approx(burnDistanceAt(-10, exampleBurnKnots), 0);
  approx(burnDistanceAt(10, exampleBurnKnots), 1);
});

test('fuse is monotonic with intentional nonuniform speed', () => {
  let previous = -1;
  for (let f = 0; f <= 180; f++) {
    const value = burnDistanceAt(f / 60, exampleBurnKnots);
    assert.ok(value >= previous && value >= 0 && value <= 1); previous = value;
  }
  const firstSpeed = (burnDistanceAt(0.6, exampleBurnKnots) - burnDistanceAt(0.4, exampleBurnKnots)) / 0.2;
  const secondSpeed = (burnDistanceAt(1.6, exampleBurnKnots) - burnDistanceAt(1.4, exampleBurnKnots)) / 0.2;
  assert.ok(Math.abs(firstSpeed - secondSpeed) > 0.05);
  assert.doesNotMatch(read(card('transition/fuse-burn-reveal')), /变速烧=播放器拖动进度条|烧速\*\*恒定\*\*跨全段/);
});

test('fuse is stateless under reverse and shuffled frame access', () => {
  const before = JSON.stringify(exampleBurnKnots);
  const expected = Array.from({length: 91}, (_, i) => burnDistanceAt(i / 30, exampleBurnKnots));
  for (let i = 90; i >= 0; i--) approx(burnDistanceAt(i / 30, exampleBurnKnots), expected[i]);
  for (let i = 0; i < 91; i++) {const frame = i * 37 % 91; approx(burnDistanceAt(frame / 30, exampleBurnKnots), expected[frame]);}
  assert.equal(JSON.stringify(exampleBurnKnots), before);
});

test('fuse rejects invalid knots while allowing an explicit hold', () => {
  for (const knots of [[], [{time: 0, distance: 0}], [{time: 0, distance: 0}, {time: 0, distance: 1}], [{time: 0, distance: 0.8}, {time: 1, distance: 0.2}], [{time: 0, distance: 0}, {time: 1, distance: 1.1}], [{time: 0, distance: 0}, {time: NaN, distance: 1}]]) assert.throws(() => burnDistanceAt(0.5, knots), /invalid burn/);
  assert.throws(() => burnDistanceAt(NaN, exampleBurnKnots), /invalid burn/);
  approx(burnDistanceAt(0.5, [{time: 0, distance: 0.2}, {time: 1, distance: 0.2}]), 0.2);
});

test('dial example derives angle and displayed value from a single physical input', () => {
  for (const value of [0, 0.25, 2.5, 5, 7.5, 10]) {
    const state = dialStateFromDisplacement(value);
    assert.equal(state.displacementMm, value);
    approx((state.angleDeg + 120) / 240 * 10, value);
    assert.equal(state.valueText, `${value.toFixed(2)} mm`);
    assert.equal(JSON.stringify(dialStateFromDisplacement(value)), JSON.stringify(state));
  }
  for (const value of [-1, 11, NaN, Infinity]) assert.throws(() => dialStateFromDisplacement(value), /out of range/);
});

test('Anatomy presentation API is preserved and docs do not claim automatic physical coupling', () => {
  const tsx = read('styles/isometric-anatomy/anatomy.tsx');
  assert.match(tsx, /angleDeg\?: number/); assert.match(tsx, /valueText\?: string/);
  assert.match(tsx, /组件不自动校准或耦合/);
  const spec = read('styles/isometric-anatomy/SPEC.md');
  assert.match(spec, /未发现已验证的调用错配/);
  assert.match(spec, /未接入渲染/);
});

test('source index includes the three historical sources with accurate implementation status', () => {
  const sources = read('reference/workflows/sources.md');
  for (const slug of ['Leonxlnx/cinetic', 'Kianzzz/xilo-opus-video', 'Vincentwei1021/video-talkcraft']) assert.ok(sources.includes(`https://github.com/${slug}`));
  assert.match(sources, /15 张草稿配方/);
  assert.match(sources, /历史方法借鉴，不只是发现索引/);
  assert.match(sources, /DotFieldBg/);
  assert.match(sources, /JohnHeibel\/PDoomVideo/);
  assert.match(sources, /不是上述八张卡的 mexicat 来源/);
});

test('license records preserve restricted-source uncertainty, rather than inheriting sibling licenses', () => {
  const sources = read('reference/workflows/sources.md');
  assert.match(sources, /video-talkcraft[^\n]*PolyForm Noncommercial 1\.0\.0[^\n]*不是 shotcraft 的 Apache-2\.0/);
  assert.match(sources, /未查到覆盖本地该移植的进一步特别许可/);
  assert.match(sources, /不以当前上游许可单独断言历史使用违法/);
  const corrections = read('reference/reference-corrections-2026-11-04.md');
  for (const sha of ['ecfa6605de1adb9345ce937724810dc32267d068', 'fa164b74fd0b26a99375715b619c55b4a0fb3d05', 'f2cd828e2692e7186186408ee01a936707c2c38d', 'a7c29edfb2404612dde6a5a1c8aa94232e85625b']) assert.ok(corrections.includes(sha));
  assert.match(corrections, /没有上游视频播放或听音/);
  assert.match(corrections, /不是法律结论/);
});
