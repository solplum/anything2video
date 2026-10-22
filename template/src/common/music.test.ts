// music.ts 断言（纯 TS、零依赖、无 React）——node 直跑：
//   仓库根目录：node --test tests/music.test.mjs（使用 template 的 TypeScript 依赖）
//   npx esbuild src/common/music.test.ts --bundle --format=cjs --outfile=.music-test.cjs
//   node -e "require('./.music-test.cjs').runAllMusicTests().forEach(l => console.log(l))"
import {createMusic, type MusicFeaturesJSON} from './music';

const FPS = 30;
const ok = (c: boolean, m: string): void => {
  if (!c) throw new Error(`FAIL: ${m}`);
};
const near = (a: number, b: number, tol = 1e-9): boolean => Math.abs(a - b) <= tol;

/** 合成 fixture：120BPM、首拍 0.5s、40 拍；kick onset 在每拍上（强度交替 1/0.8）；
 * rms 包络 0.5 恒定 + percussive 在 index 100（=t1.0s）处尖峰。 */
const fixture = (): MusicFeaturesJSON => {
  const beats: number[] = [];
  for (let i = 0; i < 40; i++) beats.push(+(0.5 + i * 0.5).toFixed(4));
  const n = 200;
  const rms = new Array(n).fill(0.5);
  const perc = new Array(n).fill(0.1);
  perc[100] = 0.9;
  perc[101] = 0.7;
  const kicks: [number, number][] = beats.map((t, i) => [+t.toFixed(3), i % 2 ? 0.8 : 1.0]);
  return {
    duration_s: 2.0,
    fps_env: 100,
    grid: {
      bpm: 120, bpm_confidence: 8, beat_interval_s: 0.5, first_beat_s: 0.5,
      beats_s: beats, downbeats_s: beats.filter((_, i) => i % 4 === 0),
      beats_frame: beats.map((t) => Math.round(t * FPS)),
      downbeats_frame: beats.filter((_, i) => i % 4 === 0).map((t) => Math.round(t * FPS)),
      onsets: {kick: kicks, snare: [], hat: []},
    },
    envelopes: {rms, percussive: perc},
  };
};

const testEnv = (M: ReturnType<typeof createMusic>): string[] => {
  const out: string[] = [];
  ok(M.env('rms', 0) === 0.5, 'env 常量通道');
  ok(near(M.env('rms', 15), 0.5), 'env 采样点取值');
  ok(M.env('不存在', 10) === 0, 'env 未知通道 → 0');
  // percussive: index100=0.9, 101=0.7 → t=1.0s=frame30 处峰值；中点 100.5 → 0.8
  ok(near(M.env('percussive', 30), 0.9), 'env 包络峰取值');
  ok(near(M.env('percussive', 30.15), 0.8, 1e-6), 'env 线性插值（帧小数）');
  ok(M.env('percussive', -5) === 0.1, 'env 负帧钳到首值');
  ok(M.envPeak('percussive', 32) >= M.env('percussive', 32), 'envPeak ≥ env');
  // frame33=t1.1s，回看 0.15s → [0.95,1.1] 罩住 index100 峰
  ok(near(M.envPeak('percussive', 33, 0.15), 0.9), 'envPeak 回看窗内取峰');
  out.push('PASS env/envPeak: 线性插值 + 峰值保持 + 未知/负值边界');
  return out;
};

const testHit = (M: ReturnType<typeof createMusic>): string[] => {
  const out: string[] = [];
  const f15 = Math.round(0.5 * FPS); // 首个 kick @0.5s
  ok(near(M.hit('kick', f15), 1.0, 1e-6), 'hit 命中帧=强度');
  const half = 0.12 * FPS; // 半衰期 0.12s 后 ≈ 0.5
  ok(near(M.hit('kick', f15 + half), 0.5, 0.02), 'hit 半衰期衰减');
  const lastKickFrame = Math.round(20.0 * FPS); // fixture 最后一个 kick @20.0s
  ok(M.hit('kick', lastKickFrame + 0.12 * 8 * FPS + 1) === 0, 'hit 8×半衰期外归零');
  ok(M.hit('snare', f15) === 0, 'hit 未知类别归零');
  ok(M.hit('kick', -1) === 0, 'hit 负帧归零');
  // 强度单调：更近的强 kick 压过更远的弱 kick
  const v1 = M.hit('kick', f15); // s=1.0
  const v2 = M.hit('kick', f15 + FPS); // 1s 后：|dt=1s|>8×0.12 → 0（周期 0.5s：实际命中 t=1.0 的 kick）
  ok(v2 > 0 && v2 <= 1.0, `hit 后续 onset 接管 (${v2.toFixed(2)})`);
  ok(v1 >= v2, 'hit 近拍 ≥ 远拍');
  out.push('PASS hit: 衰减曲线 + 边界归零 + 后续 onset 接管');
  return out;
};

const testBeats = (M: ReturnType<typeof createMusic>): string[] => {
  const out: string[] = [];
  const f15 = Math.round(0.5 * FPS);
  ok(near(M.beatAt(f15), 0, 1e-6), 'beatAt 首拍=0');
  ok(near(M.beatAt(f15 + FPS), 2, 1e-6), 'beatAt 每秒 +2 拍（120BPM）');
  ok(near(M.beatAt(f15 + FPS / 2), 1, 1e-6), 'beatAt 半拍=+1');
  const ph = M.beatPhase(f15 + FPS / 4);
  ok(ph >= 0 && ph < 1 && near(ph, 0.5, 1e-6), 'beatPhase 半拍=0.5');
  ok(near(M.beatAt(0), -1, 1e-6), 'beatAt 首拍前负外推'); // t=0，首拍 0.5s，局部拍距 0.5s → -1
  ok(M.beatAt(40 * FPS) > 39, 'beatAt 末拍后继续外推');
  ok(M.nearestBeatFrame(f15) === f15, 'nearestBeatFrame 返回帧15，不是拍索引0');
  ok(M.nearestBeatFrame(f15 + FPS / 4) === 30, 'nearestBeatFrame 等距取后拍');
  ok(M.timeOfBeatFrame(3) === Math.round(2.0 * FPS), 'timeOfBeatFrame 拍3=2.0s');
  ok(M.barAt(f15) === 0 && near(M.barAt(45), 0.5, 1e-6), 'barAt 小节指数'); // 半小节=1.0s=45帧
  ok(M.timeOfDownbeatFrame(1) === Math.round(2.5 * FPS), 'timeOfDownbeatFrame 小节1=2.5s');
  out.push('PASS beat/bar: 连续指数 + 相位 + 外推 + 帧/拍互转');
  return out;
};

const withAnchors = (beats: number[], downbeats: number[]): MusicFeaturesJSON => {
  const d = fixture();
  d.grid.beats_s = beats;
  d.grid.downbeats_s = downbeats;
  d.grid.beats_frame = beats.map((t) => Math.round(t * FPS));
  d.grid.downbeats_frame = downbeats.map((t) => Math.round(t * FPS));
  return d;
};

const testNearestFrames = (): string[] => {
  const d = withAnchors([0.5, 0.75, 1.5, 2.75], [0.75, 2.25, 5.25]);
  const original = JSON.stringify(d);
  const M = createMusic(d, FPS);
  ok(M.nearestBeatFrame(17) === 15, 'nearestBeatFrame 就近取前拍');
  ok(M.nearestBeatFrame(20) === 23, 'nearestBeatFrame 就近取后拍并取整');
  ok(M.nearestBeatFrame(18.75) === 23, 'nearestBeatFrame 非等距拍点的中点取后拍');
  ok(M.nearestDownbeatFrame(25) === 23, 'nearestDownbeatFrame 返回独立 downbeat 帧');
  ok(M.nearestDownbeatFrame(50) === 68, 'nearestDownbeatFrame 就近取后小节');
  ok(M.nearestDownbeatFrame(45) === 68, 'nearestDownbeatFrame 等距取后小节');
  for (const frame of [-1000, 0]) {
    ok(M.nearestBeatFrame(frame) === 15, 'nearestBeatFrame 首拍前取首拍');
    ok(M.nearestDownbeatFrame(frame) === 23, 'nearestDownbeatFrame 首小节前取首小节');
  }
  for (const frame of [200, 10000]) {
    ok(M.nearestBeatFrame(frame) === 83, 'nearestBeatFrame 末拍后取末拍，不外推');
    ok(M.nearestDownbeatFrame(frame) === 158, 'nearestDownbeatFrame 末小节后取末小节，不外推');
  }

  // 选择依据是真实秒值，不能先把锚点取整到帧再比较距离。
  const subframe = createMusic(withAnchors([0.49, 0.62], [0.49, 0.62]), FPS);
  ok(subframe.nearestBeatFrame(16.7) === 19, 'nearestBeatFrame 保留亚帧精度到最后一步');
  ok(subframe.nearestDownbeatFrame(16.7) === 19, 'nearestDownbeatFrame 保留亚帧精度到最后一步');
  const decimalTie = createMusic(withAnchors([0.1, 0.2], [0.1, 0.2]), FPS);
  ok(decimalTie.nearestBeatFrame(4.5) === 6, 'nearestBeatFrame 小数秒等距不受浮点误差影响');
  ok(decimalTie.nearestDownbeatFrame(4.5) === 6, 'nearestDownbeatFrame 小数秒等距不受浮点误差影响');
  ok(decimalTie.nearestBeatFrame(4.5 - 1e-8) === 3, 'nearestBeatFrame 等距点之前仍取前拍');
  ok(decimalTie.nearestDownbeatFrame(4.5 + 1e-8) === 6, 'nearestDownbeatFrame 等距点之后取后拍');

  // 使用调用方 FPS，不能误用在分析时缓存的 30fps beats_frame/downbeats_frame。
  for (const fps of [24, 29.97, 60]) {
    const scaled = createMusic(d, fps);
    for (const seconds of d.grid.beats_s) {
      ok(scaled.nearestBeatFrame(seconds * fps) === Math.round(seconds * fps), `beat 精确命中 @${fps}fps`);
    }
    for (const seconds of d.grid.downbeats_s) {
      ok(scaled.nearestDownbeatFrame(seconds * fps) === Math.round(seconds * fps), `downbeat 精确命中 @${fps}fps`);
    }
  }
  ok(M.data === d && JSON.stringify(d) === original, '吸附不改写音乐分析数据');
  return ['PASS nearest frames: 实测锚点 + 不等距/亚帧 + 前后/等距/越界 + 多FPS + 数据不变'];
};

const testSparseAnchors = (): string[] => {
  for (const anchors of [[], [1.25]]) {
    const M = createMusic(withAnchors(anchors, anchors), FPS);
    for (const frame of [-12.4, 0, 31.2, 37.5, 10000]) {
      const expected = anchors.length === 0 ? Math.round(frame) : 38;
      ok(M.nearestBeatFrame(frame) === expected, `nearestBeatFrame 空/单拍数组 @${frame}`);
      ok(M.nearestDownbeatFrame(frame) === expected, `nearestDownbeatFrame 空/单拍数组 @${frame}`);
    }
  }
  // 运行时可能没有 grid 或拍点字段；与原有可选链降级行为保持一致。
  const missingGrid = fixture();
  delete (missingGrid as Partial<MusicFeaturesJSON>).grid;
  const M = createMusic(missingGrid, FPS);
  ok(M.nearestBeatFrame(42.6) === 43 && M.nearestDownbeatFrame(42.6) === 43, '缺 grid 时不补造拍点');
  const missingAnchors = fixture();
  delete (missingAnchors.grid as Partial<typeof missingAnchors.grid>).beats_s;
  delete (missingAnchors.grid as Partial<typeof missingAnchors.grid>).downbeats_s;
  const missing = createMusic(missingAnchors, FPS);
  ok(missing.nearestBeatFrame(42.6) === 43 && missing.nearestDownbeatFrame(42.6) === 43, '缺拍点字段时不补造拍点');
  const beatsOnly = createMusic(withAnchors([0.5, 1], []), FPS);
  ok(beatsOnly.nearestBeatFrame(28) === 30, '无小节数据时正常吸附拍点');
  ok(beatsOnly.nearestDownbeatFrame(28) === 28, '无小节数据时不把普通拍当正拍');
  return ['PASS sparse anchors: 空/缺失网格保持输入帧 + 单拍保留实测偏移 + 不补造 downbeat'];
};

const testEvents = (M: ReturnType<typeof createMusic>): string[] => {
  const out: string[] = [];
  const ev = M.events('kick', 0, Math.round(1.2 * FPS));
  // kicks 在 t=0.5/1.0/1.5s → 帧 15/30/45；窗 (0,36] 含 15、30 → 2 条
  ok(ev.length === 2, `events 窗口计数（got ${ev.length}）`);
  ok(ev.every(([f, s]) => f > 0 && s > 0 && s <= 1), 'events 元素形状');
  ok(M.events('snare', 0, 9999).length === 0, 'events 空类别');
  out.push(`PASS events: 窗口过滤（(f0,f1] 语义，实测 ${ev.length} 条）`);
  return out;
};

const testDeterminism = (M: ReturnType<typeof createMusic>): string[] => {
  const out: string[] = [];
  const a = [M.env('percussive', 100), M.hit('kick', 100), M.beatAt(100), M.beatPhase(100)];
  const b = [M.env('percussive', 100), M.hit('kick', 100), M.beatAt(100), M.beatPhase(100)];
  ok(a.every((v, i) => v === b[i]), '同帧重复调用逐位一致');
  const v = Object.is(M.data, M.data);
  ok(v, 'data 透传引用稳定');
  out.push('PASS 确定性: 纯函数重入一致');
  return out;
};

/** 跑全部断言；任一失败 throw Error('FAIL: …')。返回 PASS 行列表。 */
export function runAllMusicTests(): string[] {
  const M = createMusic(fixture(), FPS);
  const lines: string[] = [];
  lines.push(...testEnv(M));
  lines.push(...testHit(M));
  lines.push(...testBeats(M));
  lines.push(...testNearestFrames());
  lines.push(...testSparseAnchors());
  lines.push(...testEvents(M));
  lines.push(...testDeterminism(M));
  return lines;
}
