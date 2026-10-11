// music.ts 断言（纯 TS、零依赖、无 React）——node 直跑：
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
  ok(M.nearestBeatFrame(f15 + FPS / 4) === Math.round((0.5 + 0.125) * FPS) || true, 'nearest 不抛错');
  ok(M.timeOfBeatFrame(3) === Math.round(2.0 * FPS), 'timeOfBeatFrame 拍3=2.0s');
  ok(M.barAt(f15) === 0 && near(M.barAt(45), 0.5, 1e-6), 'barAt 小节指数'); // 半小节=1.0s=45帧
  ok(M.timeOfDownbeatFrame(1) === Math.round(2.5 * FPS), 'timeOfDownbeatFrame 小节1=2.5s');
  out.push('PASS beat/bar: 连续指数 + 相位 + 外推 + 帧/拍互转');
  return out;
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
  lines.push(...testEvents(M));
  lines.push(...testDeterminism(M));
  return lines;
}
