import React from 'react';

/**
 * 沙画环境微动四件套（2026-10-11 自黄巢片 R3 提升进 SKU，正本在该工程 hc-art.tsx）：
 * 长持镜（>3s）必须自带全程微动层——narration 拉长/换音色重锚时事件密度下降，
 * 没有这层的镜头会露出「只有背景+字幕」的空白长尾（directing-playbook 长持镜条目）。
 * 全部为 N 的纯函数，确定性无随机；判据规则：
 *   - DustDrift/PetalFall 属小面积运动，人眼可读但 freezedetect/probe_motion 等
 *     均值型检测不可见（<1% 帧面积 <0.1% 均值阈）——两套判据分开记；
 *   - 冻帧/空白感验收以逐镜静态审计为准（2fps 帧差按镜头区间聚合，黄巢片实证）。
 * 接线：拷进消费工程 src/common/，把下方本地 clamp01 换成工程 easing 导出。
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 浮尘缓漂：长持镜的环境微动（稀疏小点，作氛围层；主导微动用 PetalFall/SandStream） */
export const DustDrift: React.FC<{
  N: number; f0: number; count?: number; color?: string; opacity?: number; rise?: boolean; speed?: number;
}> = ({N, f0, count = 16, color = '#8a6f4a', opacity = 0.5, rise = true, speed = 0.7}) => {
  const n = N - f0;
  if (n <= 0) return null;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const s1 = (i * 137 + 31) % 100 / 100;
    const cyc = 200 / speed;
    const ph = (n + s1 * cyc) % cyc / cyc;
    const x = 60 + s1 * 1160 + Math.sin(n * 0.02 + i) * 20;
    const y = rise ? 680 - ph * 600 : 40 + ph * 600;
    const fade = Math.sin(ph * Math.PI);
    const r = 3.5 + (i % 3);
    dots.push(<div key={i} style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
      background: color, opacity: opacity * fade, filter: 'blur(1px)',
    }} />);
  }
  return <>{dots}</>;
};

/** 花瓣/沙粒持续飘落：可见面积大的主导微动（人眼可读的「持续动画」） */
export const PetalFall: React.FC<{
  N: number; f0: number; count?: number; color?: string; size?: number; speed?: number;
  wind?: number; opacity?: number; x0?: number; x1?: number; fall?: number;
}> = ({N, f0, count = 28, color = '#e0cba0', size = 8, speed = 1, wind = 30, opacity = 0.85, x0 = 20, x1 = 1260, fall = 780}) => {
  const n = N - f0;
  if (n <= 0) return null;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const s1 = (i * 137 + 53) % 100 / 100;
    const s2 = (i * 61 + 29) % 100 / 100;
    const cyc = fall / (4.4 * speed);
    const ph = ((n + s2 * cyc) % cyc) / cyc;
    const y = -12 + ph * fall;
    const x = x0 + s1 * (x1 - x0) + Math.sin(n * 0.03 + i * 1.7) * wind * (0.25 + ph * 0.75);
    const fade = Math.sin(ph * Math.PI);
    const r = size * (0.7 + (i % 3) * 0.18);
    dots.push(<div key={i} style={{
      position: 'absolute', left: x - r, top: y - r, width: r * 1.7, height: r * 2, borderRadius: '46%',
      background: color, opacity: opacity * fade,
      transform: `rotate(${(ph * 190 + i * 37) % 360}deg)`, filter: 'blur(0.6px)',
    }} />);
  }
  return <>{dots}</>;
};

/** 连续落沙柱：多列沙流持续坠落+底部沙堆隆起（开场钩子/纸面破静；SandPour 单波太短） */
export const SandStream: React.FC<{
  x: number; N: number; f0: number; w?: number; count?: number; top?: number; fall?: number;
}> = ({x, N, f0, w = 130, count = 16, top = -6, fall = 460}) => {
  const n = N - f0;
  if (n <= 0) return null;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 137 + Math.round(x)) % 97;
    const phase = (seed % 13) / 13;
    const ln = (n * (0.8 + phase * 0.5) + seed * 7) % (fall + 60);
    const px = x + (((seed * 53) % 100) / 100 - 0.5) * w * (0.35 + 0.65 * phase);
    const py = top + Math.min(ln, fall);
    const fade = ln > fall ? 1 - (ln - fall) / 60 : 1;
    if (fade <= 0) continue;
    dots.push(<div key={i} style={{
      position: 'absolute', left: px - 3.3, top: py, width: 6.6, height: 6.6, borderRadius: '50%',
      background: i % 3 === 0 ? '#5a4028' : '#4a3520', opacity: fade, filter: 'blur(1px)',
    }} />);
  }
  const mound = clamp01(n / 45);
  dots.push(
    <div key="mound" style={{
      position: 'absolute', left: x - w * 0.75, top: fall + 120 - 30 * mound, width: w * 1.5, height: 34 + 30 * mound,
      borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 30%, #56402a, #3a2917 78%)',
      opacity: 0.95 * mound, filter: 'blur(3px)',
    }} />,
  );
  return <>{dots}</>;
};

/** 纸底光呼吸：灯箱光大面积缓移（纸白章长持镜；soft-light 大面积——均值型检测可感知） */
export const PaperBreath: React.FC<{N: number; f0: number; strength?: number}> = ({N, f0, strength = 0.1}) => {
  const n = N - f0;
  if (n <= 0) return null;
  const o = strength * (0.5 + 0.5 * Math.sin(n * 0.045));
  const dx = Math.sin(n * 0.021) * 4;
  const dy = Math.cos(n * 0.017) * 2;
  return (
    <div style={{
      position: 'absolute', inset: 0, opacity: o, mixBlendMode: 'soft-light', pointerEvents: 'none',
      background: `radial-gradient(ellipse 80% 68% at ${(50 + dx).toFixed(2)}% ${(46 + dy).toFixed(2)}%, rgba(255,248,224,.95), rgba(201,179,132,.3) 68%, transparent 100%)`,
    }} />
  );
};
