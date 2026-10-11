import React from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// =====================================================================
// StrokeText 单笔画（刻印/绘图仪）字体库 —— 逐字移植自 mexicat/pdoom-video
// app/src/engine/stroke.ts（MIT，副本 LICENSE-THIRDPARTY/MIT-pdoom-video.txt）。
// 字体：Hershey（公有领域）+ EMS（OFL，副本 LICENSE-THIRDPARTY/OFL-hersheytext-stroke-fonts.txt），
// SVG 已 vendor 到 template/public/fonts/stroke/（8 款共 392KB）。
// 能力：文字作为折线渲染，可被一个移动的笔头**逐像素写出**；writtenLength 把
// 写字进度钉到逐字时间戳（对接 tts_build 的 SubEntry.chars 或词级时间）；
// 字体无 kerning 表——留洞字形对（To/Yo/AV/LT）按轮廓剖面做光学 kern（全量移植）。
// 与 pdoom 的差异：时间入参改为帧号口径（a2v 惯例）；加载走 staticFile + delayRender。
// 边界（诚实口径）：单笔画字体只覆盖拉丁/数字/标点——**中文不走此件**
// （CJK 单笔画字体无干净许可源），中文手写继续用 draw-svg-trace 手绘骨架路线。
//
// 用法：
//   <StrokeFonts />                                  // Main 顶层挂一次（delayRender 等解析完）
//   const st = strokeText('P(doom)', 'script', 120); // 版式（确定性，可 useMemo）
//   const len = writtenLength(st, charTimesFrames, frame);   // 逐字时间戳 → 已写长度 px
//   const {paths, head} = writtenStrokes(st, len);   // SVG 部分折线 + 笔头位置
//   // Canvas2D 用户：drawStrokeText(ctx, st, len) 同 pdoom 签名
// =====================================================================

export interface V2 { x: number; y: number }

export const STROKE_FONTS = {
  script: 'EMSAllure.svg', // 流动连笔
  hscript: 'HersheyScript1.svg', // 经典 Hershey 手写体
  sans: 'HersheySans1.svg', // 绘图仪无衬线
  readable: 'EMSReadability.svg', // 清晰单线无衬线
  tech: 'EMSTech.svg', // 工程标注体
  serif: 'HersheySerifMed.svg',
  osmotron: 'EMSOsmotron.svg', // 几何/科技
  felix: 'EMSFelix.svg', // 笔刷感
} as const;
export type StrokeFontName = keyof typeof STROKE_FONTS;

/** 连笔脚本：kern 会断笔画连接，禁用。 */
const SCRIPTS = new Set<StrokeFontName>(['script', 'hscript']);

export interface SGlyph { adv: number; strokes: V2[][] }
export interface SFont {
  upm: number; ascent: number; descent: number; xh: number; cap: number; glyphs: Map<string, SGlyph>; missingAdv: number;
  /** 从轮廓实测（文件的 x-height/cap-height 属性是占位值）。 */
  base: number; xTop: number; capTop: number;
  /** 剖面带：[yLo, yLo + ROWS*dy] 覆盖所有字形的墨迹。 */
  yLo: number; dy: number;
  prof: Map<string, Profile | null>; kern: Map<string, number>; target: { lc: number; uc: number } | null;
}
const fonts = new Map<StrokeFontName, SFont>();

/** 加载全部 8 款字体；Remotion 里包在 delayRender 中调用（见 <StrokeFonts/>）。 */
export const loadStrokeFonts = async (getUrl?: (file: string) => string): Promise<void> => {
  const url = getUrl ?? ((f: string) => staticFile(`fonts/stroke/${f}`));
  await Promise.all(
    (Object.keys(STROKE_FONTS) as StrokeFontName[]).map(async (k) => {
      const res = await fetch(url(STROKE_FONTS[k]));
      const f = parseSvgFont(await res.text());
      addTypographic(f);
      fonts.set(k, f);
    }),
  );
};

/** React 侧加载器：Main 顶层挂一次，等字体解析完成再继续渲染。 */
export const StrokeFonts: React.FC = () => {
  const [handle] = React.useState(() => delayRender('stroke-fonts'));
  React.useEffect(() => {
    loadStrokeFonts()
      .catch((e) => {
        throw new Error(`stroke fonts 加载失败（fonts/stroke/ 是否在工程 public/ 下？）: ${String(e)}`);
      })
      .finally(() => continueRender(handle));
  }, [handle]);
  return null;
};

const inkBox = (strokes: V2[][]) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of strokes) for (const p of s) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  return { x0, x1, y0, y1 };
};
const moved = (g: SGlyph, dx: number, dy = 0): V2[][] => g.strokes.map((s) => s.map((p) => ({ x: p.x + dx, y: p.y + dy })));

/** 弯引号与省略号：用字体自己的 ' 和 . 合成（Hershey 的 ' 本就逗号形）。 */
function addTypographic(f: SFont) {
  const G = f.glyphs, q = G.get("'"), dot = G.get('.');
  if (q && q.strokes.length) {
    const b = inkBox(q.strokes), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const turned: SGlyph = { adv: q.adv, strokes: q.strokes.map((s) => s.map((p) => ({ x: 2 * cx - p.x, y: 2 * cy - p.y }))) };
    const dbl = (g: SGlyph): SGlyph => {
      const off = b.x1 - b.x0 + 0.07 * f.upm;
      return { adv: g.adv + off, strokes: [...g.strokes, ...moved(g, off)] };
    };
    if (!G.has('\u2019')) G.set('\u2019', q);
    if (!G.has('\u2018')) G.set('\u2018', turned);
    if (!G.has('\u201D')) G.set('\u201D', dbl(q));
    if (!G.has('\u201C')) G.set('\u201C', dbl(turned));
  }
  if (dot && !G.has('…')) {
    const step = dot.adv * 0.72;
    G.set('…', { adv: dot.adv + 2 * step, strokes: [...dot.strokes, ...moved(dot, step), ...moved(dot, 2 * step)] });
  }
}

// ------------------------------------------------------------------ 光学 kerning
// 单笔画字体的侧边距已把普通字对（nn/oo…）排开；缺的是留洞字形的 kern——
// 悬挑与斜笔（To/Yo/We/AV/LT/r.）。做法：墨迹压成左右剖面（每横带取极值，
// 上下带按 SHADE 斜率回投影，让 T 的横臂荫及下方带），右字左移到两字共享区
// （小写取 x-height、否则 cap height）内最近逼近值接近字体自身 n/o 字对的均值。
const ROWS = 90;
const SHADE = 0.4;
const OPEN_R = new Set("AFLPTVWYKXfrvwyk7'\"\u2019\u201D".split(''));
const OPEN_L = new Set("AJTVWYXvwyj.,'\"\u2019\u201D\u2026".split(''));
const CLEAR = 0.1; // em：墨迹全高最小间隙（45° 剖面计量，斜笔计入）
const STRENGTH = 0.6; // 只走近一半：等距逼近会把斜笔和圆字排得比目感更紧
interface Profile { l: Float32Array; r: Float32Array; l45: Float32Array; r45: Float32Array } // 无墨处 NaN

function profile(f: SFont, ch: string): Profile | null {
  if (f.prof.has(ch)) return f.prof.get(ch)!;
  const g = f.glyphs.get(ch);
  let p: Profile | null = null;
  if (g && g.strokes.length) {
    const l = new Float32Array(ROWS).fill(NaN), r = new Float32Array(ROWS).fill(NaN);
    const put = (x: number, y: number) => {
      const i = Math.floor((y - f.yLo) / f.dy);
      if (i < 0 || i >= ROWS) return;
      if (!(l[i]! <= x)) l[i] = x;
      if (!(r[i]! >= x)) r[i] = x;
    };
    for (const s of g.strokes) {
      if (s.length === 1) put(s[0]!.x, s[0]!.y);
      for (let k = 1; k < s.length; k++) {
        const a = s[k - 1]!, b = s[k]!;
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (f.dy * 0.35)));
        for (let j = 0; j <= n; j++) put(a.x + ((b.x - a.x) * j) / n, a.y + ((b.y - a.y) * j) / n);
      }
    }
    const widen = (k: number) => {
      const lw = new Float32Array(ROWS).fill(NaN), rw = new Float32Array(ROWS).fill(NaN);
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < ROWS; j++) {
          const d = Math.abs(i - j) * f.dy * k;
          if (!Number.isNaN(l[j]!) && !(lw[i]! <= l[j]! + d)) lw[i] = l[j]! + d;
          if (!Number.isNaN(r[j]!) && !(rw[i]! >= r[j]! - d)) rw[i] = r[j]! - d;
        }
      }
      return [lw, rw] as const;
    };
    const [lw, rw] = widen(SHADE), [l45, r45] = widen(1);
    p = { l: lw, r: rw, l45, r45 };
  }
  f.prof.set(ch, p);
  return p;
}

const isLower = (ch: string) => ch !== ch.toUpperCase() && ch === ch.toLowerCase();
const isLetter = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

/** b 对 a 的最近逼近（字体单位），以 a 的 advance 为基线，在共享纵向区内计。 */
function approach(f: SFont, a: string, b: string): number | null {
  const pa = profile(f, a), pb = profile(f, b);
  if (!pa || !pb) return null;
  const adv = f.glyphs.get(a)!.adv;
  const lower = isLower(a) || isLower(b) || !isLetter(a) || !isLetter(b);
  const top = lower ? f.xTop : f.capTop;
  const i0 = Math.max(0, Math.floor((f.base - f.yLo) / f.dy)), i1 = Math.min(ROWS - 1, Math.floor((top - f.yLo) / f.dy));
  let m = Infinity;
  for (let i = i0; i <= i1; i++) {
    const ra = pa.r[i]!, lb = pb.l[i]!;
    if (!Number.isNaN(ra) && !Number.isNaN(lb)) m = Math.min(m, adv + lb - ra);
  }
  return m === Infinity ? null : m;
}

/** 相邻两字形的光学 kern（字体单位，≤0）；无留洞字形对返回 0。 */
function pairKern(f: SFont, a: string, b: string): number {
  if (a === ' ' || b === ' ' || !(OPEN_R.has(a) || OPEN_L.has(b))) return 0;
  if (!isLetter(a) && !isLetter(b)) return 0;
  const key = a + b;
  const hit = f.kern.get(key);
  if (hit !== undefined) return hit;
  if (!f.target) {
    const mean = (ps: string[]) => { const v = ps.map((p) => approach(f, p[0]!, p[1]!) ?? 0); return v.reduce((x, y) => x + y, 0) / v.length; };
    f.target = { lc: mean(['nn', 'oo', 'no', 'on']), uc: mean(['HH', 'OO', 'HO', 'OH']) };
  }
  const m = approach(f, a, b);
  let k = 0;
  if (m !== null) {
    const lower = isLower(a) || isLower(b) || !isLetter(a) || !isLetter(b);
    k = Math.max(-0.15 * f.upm, Math.min(0, STRENGTH * ((lower ? f.target.lc : f.target.uc) - m)));
    const pa = profile(f, a)!, pb = profile(f, b)!, adv = f.glyphs.get(a)!.adv;
    let near = Infinity;
    for (let i = 0; i < ROWS; i++) {
      const ra = pa.r45[i]!, lb = pb.l45[i]!;
      if (!Number.isNaN(ra) && !Number.isNaN(lb)) near = Math.min(near, adv + lb - ra);
    }
    k = Math.max(k, Math.min(0, CLEAR * f.upm - near));
  }
  f.kern.set(key, k);
  return k;
}

function parseSvgFont(txt: string): SFont {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const ff = doc.querySelector('font-face')!;
  const fontEl = doc.querySelector('font')!;
  const defAdv = parseFloat(fontEl.getAttribute('horiz-adv-x') ?? '500');
  const glyphs = new Map<string, SGlyph>();
  doc.querySelectorAll('glyph').forEach((g) => {
    const u = g.getAttribute('unicode');
    if (u == null) return;
    const adv = parseFloat(g.getAttribute('horiz-adv-x') ?? String(defAdv));
    glyphs.set(u, { adv, strokes: parsePath(g.getAttribute('d') ?? '') });
  });
  let yLo = Infinity, yHi = -Infinity;
  for (const g of glyphs.values()) for (const st of g.strokes) for (const p of st) { yLo = Math.min(yLo, p.y); yHi = Math.max(yHi, p.y + 1); }
  const H = inkBox(glyphs.get('H')?.strokes ?? [[{ x: 0, y: 0 }, { x: 0, y: 700 }]]);
  const X = inkBox(glyphs.get('x')?.strokes ?? [[{ x: 0, y: 0 }, { x: 0, y: 450 }]]);
  return {
    upm: parseFloat(ff.getAttribute('units-per-em') ?? '1000'),
    ascent: parseFloat(ff.getAttribute('ascent') ?? '800'),
    descent: parseFloat(ff.getAttribute('descent') ?? '-200'),
    xh: parseFloat(ff.getAttribute('x-height') ?? '300'),
    cap: parseFloat(ff.getAttribute('cap-height') ?? '500'),
    glyphs,
    missingAdv: defAdv,
    base: H.y0, xTop: X.y1, capTop: H.y1,
    yLo, dy: (yHi - yLo) / ROWS,
    prof: new Map(), kern: new Map(), target: null,
  };
}

/** 这些字体只用 M/L（绝对）指令；字体单位里 y 向上。 */
function parsePath(d: string): V2[][] {
  const out: V2[][] = [];
  const tok = d.match(/[MLml]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let cur: V2[] | null = null;
  let cmd = 'M';
  for (let i = 0; i < tok.length;) {
    const t = tok[i]!;
    if (/[MLml]/.test(t)) { cmd = t.toUpperCase(); i++; continue; }
    const x = parseFloat(tok[i]!), y = parseFloat(tok[i + 1]!);
    i += 2;
    if (cmd === 'M') { cur = [{ x, y }]; out.push(cur); cmd = 'L'; }
    else cur?.push({ x, y });
  }
  return out;
}

const polylineLengths = (pts: V2[]): Float32Array => {
  const out = new Float32Array(pts.length);
  for (let i = 1; i < pts.length; i++) out[i] = out[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return out;
};

export interface StrokeText {
  /** 折线（px），原点在左基线，y 向下。 */
  strokes: V2[][];
  /** 每条折线所属字符下标。 */
  charOf: number[];
  /** 每条折线起点的累计长度 & 总长（渐进写字用）。 */
  startLen: number[];
  lens: Float32Array[];
  total: number;
  width: number;
  /** 字符下标 → 该字笔画的 [起, 止] 累计长度（写字进度钉时间戳用）。 */
  charRange: [number, number][];
  size: number;
  capHeight: number;
}

/** 以字体对象排版（纯函数，测试可直接构造合成字体喂入）。 */
export function strokeTextWithFont(f: SFont, text: string, size = 100, tracking = 0, kern = true): StrokeText {
  const s = size / f.upm;
  const strokes: V2[][] = [];
  const charOf: number[] = [];
  let x = 0;
  const chars = Array.from(text);
  chars.forEach((ch, ci) => {
    const g = f.glyphs.get(ch);
    for (const st of g?.strokes ?? []) {
      strokes.push(st.map((p) => ({ x: x + p.x * s, y: -p.y * s })));
      charOf.push(ci);
    }
    x += (g?.adv ?? f.missingAdv) * s + tracking;
    if (ci + 1 < chars.length && kern) x += pairKern(f, ch, chars[ci + 1]!) * s;
  });
  const lens = strokes.map((p) => polylineLengths(p));
  const startLen: number[] = [];
  let acc = 0;
  for (const L of lens) { startLen.push(acc); acc += L[L.length - 1] ?? 0; }
  const charRange: [number, number][] = chars.map(() => [Infinity, -Infinity]);
  strokes.forEach((_, i) => {
    const r = charRange[charOf[i]!]!;
    r[0] = Math.min(r[0], startLen[i]!);
    r[1] = Math.max(r[1], startLen[i]! + (lens[i]![lens[i]!.length - 1] ?? 0));
  });
  // 无笔画的字符（空格）继承前一字符末端的累计长度
  let last = 0;
  for (const r of charRange) {
    if (r[0] === Infinity) { r[0] = last; r[1] = last; }
    last = r[1];
  }
  return { strokes, charOf, startLen, lens, total: acc, width: x - tracking, charRange, size, capHeight: f.cap * s };
}

/** 排版字符串（需先 loadStrokeFonts）；结果按入参缓存，重复调用零开销。 */
const layoutCache = new Map<string, StrokeText>();
export function strokeText(text: string, fontName: StrokeFontName = 'script', size = 100, tracking = 0, kern = !SCRIPTS.has(fontName)): StrokeText {
  const f = fonts.get(fontName);
  if (!f) throw new Error(`stroke font not loaded: ${fontName}（先挂 <StrokeFonts/>）`);
  const key = `${fontName}|${text}|${size}|${tracking}|${kern}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const st = strokeTextWithFont(f, text, size, tracking, kern);
  layoutCache.set(key, st);
  return st;
}

/** 把 StrokeText 截到前 len px：返回部分折线（SVG/DOM 直用）与笔头位置。 */
export function writtenStrokes(st: StrokeText, len: number): { paths: V2[][]; head: V2 | null } {
  const paths: V2[][] = [];
  let head: V2 | null = null;
  for (let i = 0; i < st.strokes.length; i++) {
    const s0 = st.startLen[i]!;
    if (s0 >= len) break;
    const pts = st.strokes[i]!, L = st.lens[i]!;
    const remain = len - s0;
    const out: V2[] = [pts[0]!];
    let j = 1;
    for (; j < pts.length && L[j]! <= remain; j++) out.push(pts[j]!);
    if (j < pts.length) {
      const a = pts[j - 1]!, b = pts[j]!;
      const u = (remain - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!);
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      head = out[out.length - 1]!;
    } else {
      head = out[out.length - 1] ?? null;
    }
    if (out.length >= 2) paths.push(out);
  }
  return { paths, head };
}

/** Canvas2D 直画版（pdoom 同签名）：画前 len px，返回笔头位置或 null。 */
export function drawStrokeText(c: CanvasRenderingContext2D, st: StrokeText, len: number): { x: number; y: number } | null {
  const { paths, head } = writtenStrokes(st, len);
  c.beginPath();
  for (const p of paths) {
    c.moveTo(p[0]!.x, p[0]!.y);
    for (let i = 1; i < p.length; i++) c.lineTo(p[i]!.x, p[i]!.y);
  }
  c.stroke();
  return head;
}

/** 逐字时间戳（帧）→ 已写长度 px：每字在它的词被唱到时写完。 */
export function writtenLength(st: StrokeText, charTimesFrames: [number, number][], frame: number): number {
  let len = 0;
  for (let i = 0; i < st.charRange.length; i++) {
    const [a, b] = st.charRange[i]!;
    const [t0, t1] = charTimesFrames[i] ?? [Infinity, Infinity];
    if (frame >= t1) len = b;
    else if (frame > t0) { len = a + (b - a) * ((frame - t0) / Math.max(1e-3, t1 - t0)); break; }
    else break;
  }
  return len;
}

/** React 渲染件：按 frame 渐进写出的 SVG 文字。charTimesFrames 缺省=立即全写完。 */
export const StrokeWritten: React.FC<{
  text: string;
  font?: StrokeFontName;
  size?: number;
  tracking?: number;
  charTimesFrames?: [number, number][];
  frame: number;
  color?: string;
  strokeWidth?: number;
  x?: number;
  y?: number;
  style?: React.CSSProperties;
}> = ({text, font = 'script', size = 100, tracking = 0, charTimesFrames, frame, color = 'currentColor', strokeWidth, x = 0, y = 0, style}) => {
  const st = strokeText(text, font, size, tracking);
  const len = charTimesFrames ? writtenLength(st, charTimesFrames, frame) : st.total;
  const { paths, head } = writtenStrokes(st, len);
  const sw = strokeWidth ?? Math.max(1.5, size * 0.03);
  const w = Math.ceil(st.width + sw * 2 + 4);
  const h = Math.ceil(size * 1.4);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`${-sw - 2} ${-st.capHeight - sw - 2} ${w} ${h}`}
      style={{position: 'absolute', left: x, top: y, overflow: 'visible', pointerEvents: 'none', ...style}}
    >
      {paths.map((p, i) => (
        <polyline key={i} points={p.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {head ? <circle cx={head.x} cy={head.y} r={Math.max(2, size * 0.035)} fill={color} /> : null}
    </svg>
  );
};
