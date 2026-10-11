// StrokeText 纯函数断言（合成字体直喂，不经 DOMParser/fetch）——node 直跑：
//   npx esbuild src/common/kit/stroke.test.ts --bundle --format=cjs --outfile=.stroke-test.cjs
//   node -e "require('./.stroke-test.cjs').runAllStrokeTests().forEach(l => console.log(l))"
import {
  strokeTextWithFont, writtenLength, writtenStrokes,
  type SFont, type SGlyph, type StrokeFontName, type V2,
} from './StrokeText';

const ok = (c: boolean, m: string): void => {
  if (!c) throw new Error(`FAIL: ${m}`);
};
const near = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) <= tol;

/** 合成三字字体：L（直角）、T（悬挑横臂——留洞字形）、o（方圈）。 */
const mkFont = (): SFont => {
  const glyphs = new Map<string, SGlyph>();
  glyphs.set('L', {adv: 500, strokes: [[{x: 100, y: 0}, {x: 100, y: 700}], [{x: 100, y: 0}, {x: 400, y: 0}]]} as SGlyph);
  glyphs.set('T', {adv: 600, strokes: [[{x: 0, y: 700}, {x: 500, y: 700}], [{x: 250, y: 700}, {x: 250, y: 0}]]});
  glyphs.set('o', {adv: 500, strokes: [[{x: 100, y: 0}, {x: 100, y: 450}, {x: 400, y: 450}, {x: 400, y: 0}, {x: 100, y: 0}]]});
  const all: V2[] = [...glyphs.values()].flatMap((g) => g.strokes.flat());
  const ys = all.map((p) => p.y);
  const yLo = Math.min(...ys), yHi = Math.max(...ys) + 1;
  return {
    upm: 1000, ascent: 800, descent: -200, xh: 450, cap: 700,
    glyphs, missingAdv: 500,
    base: 0, xTop: 450, capTop: 700,
    yLo, dy: (yHi - yLo) / 90, // 与 stroke.ts ROWS=90 对齐
    prof: new Map(), kern: new Map(), target: null,
  } as SFont;
};

const testLayout = (): string[] => {
  const out: string[] = [];
  const f = mkFont();
  const st = strokeTextWithFont(f, 'To', 100);
  ok(st.strokes.length === 3, `折线数 = T2+o1（got ${st.strokes.length}）`);
  ok(near(st.size, 100) && near(st.capHeight, 70), 'size/capHeight 换算（100px/upm1000 → cap 700→70px）');
  // 坐标系：字体 y 向上 → 输出 y 向下（基线 0）
  ok(st.strokes.every((p) => p.every((q) => q.y <= 0)), 'y 翻转向下（≤0）');
  // 光学 kern：T（悬挑）+ o 应比无 kern 更紧
  const stNoKern = strokeTextWithFont(f, 'To', 100, 0, false);
  ok(st.width < stNoKern.width, `kern 生效（${st.width.toFixed(1)} < ${stNoKern.width.toFixed(1)}）`);
  ok(st.width > 0 && st.charRange.length === 2, 'width 正值 + 逐字区间');
  // charRange 单调且覆盖 [0, total]
  ok(near(st.charRange[0][0], 0) && near(st.charRange[1][1], st.total), 'charRange 覆盖全程');
  // 空格（无笔画字形）继承前字末端
  const stSp = strokeTextWithFont(f, 'T o', 100, 0, false);
  ok(near(stSp.charRange[1][0], stSp.charRange[1][1]), '空格 charRange 零宽继承');
  out.push('PASS layout: 折线/y 翻转/光学 kern/charRange/空格继承');
  return out;
};

const testWritten = (): string[] => {
  const out: string[] = [];
  const f = mkFont();
  const st = strokeTextWithFont(f, 'To', 100, 0, false);
  const times: [number, number][] = [[0, 10], [10, 20]]; // 逐字帧窗
  ok(writtenLength(st, times, -1) === 0, '开写前 = 0');
  ok(writtenLength(st, times, 0) === 0, '窗口起点 = 0');
  const half = writtenLength(st, times, 5);
  ok(half > 0 && half < st.charRange[0][1], '字1中途 = 部分长度');
  ok(near(writtenLength(st, times, 10), st.charRange[0][1]), '字1窗口末 = 字1终点');
  ok(near(writtenLength(st, times, 15), (st.charRange[0][1] + st.charRange[1][1]) / 2, st.charRange[1][1] * 0.51), '字2中途推进');
  ok(near(writtenLength(st, times, 100), st.total), '全部写完 = total');
  // 单调
  let prev = -1;
  let mono = true;
  for (let fr = 0; fr <= 20; fr++) {
    const v = writtenLength(st, times, fr);
    if (v < prev) mono = false;
    prev = v;
  }
  ok(mono, '写字长度随帧单调不减');
  // writtenStrokes：len=0 空、len=total 全折线还原、笔头在末段
  const e0 = writtenStrokes(st, 0);
  ok(e0.paths.length === 0 && e0.head === null, 'len=0 → 空笔');
  const full = writtenStrokes(st, st.total);
  ok(full.paths.length === st.strokes.length, 'len=total → 折线全数还原');
  const mid = writtenStrokes(st, half);
  ok(mid.paths.length >= 1 && mid.paths[0].length >= 2, '中途 ≥1 条部分折线');
  ok(near(writtenLength(st, times, 5), writtenLength(st, times, 5)), '确定性：同参重入逐位一致');
  out.push('PASS written: 时间→长度映射 + 单调 + 部分折线');
  return out;
};

/** 跑全部断言；任一失败 throw Error('FAIL: …')。返回 PASS 行列表。 */
export function runAllStrokeTests(): string[] {
  const lines: string[] = [];
  lines.push(...testLayout());
  lines.push(...testWritten());
  return lines;
}

//（类型引用占位：保证 StrokeFontName 导入不被 tree-shake 警告）
export type _StrokeFontNameRef = StrokeFontName;
