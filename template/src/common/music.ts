// 音乐反应层（v4.3.0）—— 数据源：scripts/audio_features.py 产出的 analysis/music_features.json。
// 方法论吸收：mexicat/pdoom-video app/src/engine/audio.ts（MIT）——env 线性插值 / envPeak 峰值保持 /
// hit 半衰期衰减脉冲 / beatAt 连续拍指数；本仓重写为帧号入参（卡片用 useCurrentFrame() 直接喂）。
// 纪律（统一合同「音频」、music-beat-sync §7）：
//   - env/envPeak 只驱动平滑连续运动（相机微漂 / 辉光呼吸 / 密度涨落）；
//   - hit 是候选池不是触发器：冲击事件按 beat sheet 挑选钉帧，全画面冲击仍受 aesthetic-rules R4 硬上限；
//   - 本模块纯函数、确定性：一切输出是 frame 的解析函数，禁 Math.random/Date/网络。
// 用法：
//   import musicData from '../../analysis/music_features.json';   // 相对卡片文件到工程 analysis/
//   import {createMusic, FPS} from '../common';                   // 或 '../common/music'
//   const M = createMusic(musicData, FPS);
//   const glow = M.env('percussive', frame);    // 0..1 连续包络（低/中/高频段与打击分量分通道）
//   const punch = M.hit('kick', frame, 0.12);   // 最近 kick 的半衰期衰减脉冲 0..1
//   const cut = M.nearestDownbeatFrame(frame);  // 最近正拍帧（切点吸附）
// 数据文件不存在的工程不引入本模块（缺文件 = 编译期报错，显式降级：不骑音乐，禁手写正弦假装骑拍）。

export interface MusicGrid {
  bpm: number;
  bpm_confidence: number;
  reliable?: boolean;
  beat_interval_s: number;
  first_beat_s: number;
  beats_s: number[];
  downbeats_s: number[];
  beats_frame: number[];
  downbeats_frame: number[];
  onsets: Record<string, [number, number][]>;
  onsets_frame?: Record<string, [number, number][]>;
  bar_phase?: {offset: number; snare_2and4_ratio: number; source: string; snare_positions: number[] | null; note?: string};
  [k: string]: unknown;
}

export interface MusicFeaturesJSON {
  duration_s: number;
  fps_env: number;
  grid: MusicGrid;
  envelopes: Record<string, number[]>;
  [k: string]: unknown;
}

export interface MusicApi {
  /** 连续包络（0..1）：name ∈ rms/low/mid/high/percussive（通道清单见 audio_features.py 头注）。 */
  env(name: string, frame: number): number;
  /** [frame-w·fps, frame] 窗口内的包络峰值保持——比 env 更"挺"的连续反应。 */
  envPeak(name: string, frame: number, wSec?: number): number;
  /** t 之前最近 onsets 的半衰期衰减脉冲（0..1）；kind ∈ kick/snare/hat。候选池用法见文件头纪律。 */
  hit(kind: string, frame: number, halfLifeSec?: number): number;
  /** 连续拍指数：整数=正落拍，小数=拍内相位；首尾按局部拍距外推。 */
  beatAt(frame: number): number;
  /** 连续小节指数（downbeat 序列）。 */
  barAt(frame: number): number;
  beatPhase(frame: number): number;
  barPhase(frame: number): number;
  /** 拍/小节索引 → 帧号（最近可渲染帧，30fps 量化误差 ±16.7ms——music-beat-sync §5a）。 */
  timeOfBeatFrame(i: number): number;
  timeOfDownbeatFrame(i: number): number;
  nearestBeatFrame(frame: number): number;
  nearestDownbeatFrame(frame: number): number;
  /** (f0, f1] 帧窗内的 onset 事件，返回 [帧号, 强度] 升序。 */
  events(kind: string, f0: number, f1: number): [number, number][];
  /** 原始数据透传（beats_frame/downbeats_frame 直接用，免二次换算）。 */
  readonly data: MusicFeaturesJSON;
  readonly fps: number;
}

const interp1 = (a: Float64Array | number[], x: number): number => {
  const i = Math.floor(x);
  if (i < 0) return a[0];
  if (i >= a.length - 1) return a[a.length - 1];
  const f = x - i;
  return a[i] * (1 - f) + a[i + 1] * f;
};

/** 在有序数组中找最后一个 <= x 的下标（无则 -1）。 */
const bisectRight = (a: number[], x: number): number => {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m] <= x) lo = m + 1;
    else hi = m;
  }
  return lo - 1;
};

/** 有序锚点序列上的连续索引（pdoom beatAt：段内线性插值，两端按局部锚距外推）。 */
const continuousIndex = (anchors: number[], x: number): number => {
  const n = anchors.length;
  if (n < 2) return 0;
  if (x <= anchors[0]) return (x - anchors[0]) / (anchors[1] - anchors[0]);
  if (x >= anchors[n - 1]) {
    const p = anchors[n - 1] - anchors[n - 2];
    return n - 1 + (x - anchors[n - 1]) / p;
  }
  const i = bisectRight(anchors, x);
  return i + (x - anchors[i]) / (anchors[i + 1] - anchors[i]);
};

const HALF_LIFE: Record<string, number> = {kick: 0.12, snare: 0.14, hat: 0.06}; // pdoom sample() 口径

export const createMusic = (d: MusicFeaturesJSON, fps: number): MusicApi => {
  const envFps = d.fps_env > 0 ? d.fps_env : 100;
  const envs: Record<string, Float64Array> = {};
  for (const [k, arr] of Object.entries(d.envelopes ?? {})) envs[k] = Float64Array.from(arr);
  const beats = d.grid?.beats_s ?? [];
  const downs = d.grid?.downbeats_s ?? [];
  const onsets = d.grid?.onsets ?? {};
  const t = (frame: number): number => frame / fps;

  const hit = (kind: string, frame: number, halfLifeSec?: number): number => {
    if (frame < 0) return 0;
    const list = onsets[kind];
    if (!list || list.length === 0) return 0;
    const hl = halfLifeSec ?? HALF_LIFE[kind] ?? 0.11;
    const now = t(frame);
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      // 有序 [t, s] 上的 bisectRight，直接比首元素，免逐帧 map 分配
      const m = (lo + hi) >> 1;
      if (list[m][0] <= now) lo = m + 1;
      else hi = m;
    }
    let v = 0;
    for (let i = lo - 1; i >= 0 && i > lo - 7; i--) {
      const [ot, s] = list[i];
      const dt = now - ot;
      if (dt > hl * 8) break;
      v = Math.max(v, s * Math.pow(0.5, dt / hl));
    }
    return v;
  };

  return {
    env(name, frame) {
      const a = envs[name];
      if (!a || a.length === 0) return 0;
      return interp1(a, t(frame) * envFps);
    },
    envPeak(name, frame, wSec = 0.08) {
      const a = envs[name];
      if (!a || a.length === 0) return 0;
      const now = t(frame);
      let m = 0;
      for (let s = now - wSec; s <= now; s += 1 / envFps) m = Math.max(m, interp1(a, s * envFps));
      return m;
    },
    hit,
    beatAt: (frame) => continuousIndex(beats, t(frame)),
    barAt: (frame) => continuousIndex(downs, t(frame)),
    beatPhase: (frame) => {
      const b = continuousIndex(beats, t(frame));
      return b - Math.floor(b);
    },
    barPhase: (frame) => {
      const b = continuousIndex(downs, t(frame));
      return b - Math.floor(b);
    },
    timeOfBeatFrame: (i) => {
      const n = beats.length;
      if (n < 2) return Math.round((60 / (d.grid?.bpm || 120)) * i * fps);
      const period = (beats[n - 1] - beats[0]) / (n - 1);
      const tt = i <= 0 ? beats[0] + i * period : i >= n - 1 ? beats[n - 1] + (i - (n - 1)) * period
        : beats[Math.floor(i)] + (beats[Math.floor(i) + 1] - beats[Math.floor(i)]) * (i - Math.floor(i));
      return Math.round(tt * fps);
    },
    timeOfDownbeatFrame: (i) => {
      const n = downs.length;
      if (n < 2) return Math.round((60 / (d.grid?.bpm || 120)) * 4 * i * fps);
      const period = (downs[n - 1] - downs[0]) / (n - 1);
      const tt = i <= 0 ? downs[0] + i * period : i >= n - 1 ? downs[n - 1] + (i - (n - 1)) * period
        : downs[Math.floor(i)] + (downs[Math.floor(i) + 1] - downs[Math.floor(i)]) * (i - Math.floor(i));
      return Math.round(tt * fps);
    },
    nearestBeatFrame: (frame) => Math.round(continuousIndex(beats, t(frame))),
    nearestDownbeatFrame: (frame) => Math.round(continuousIndex(downs, t(frame))),
    events(kind, f0, f1) {
      const list = onsets[kind] ?? [];
      const out: [number, number][] = [];
      for (const [ot, s] of list) {
        const fr = Math.round(ot * fps);
        if (fr > f0 && fr <= f1) out.push([fr, s]);
      }
      return out;
    },
    data: d,
    fps,
  };
};
