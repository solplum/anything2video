import React from 'react';

// =====================================================================
// VarText 可变字体轴动画（v4.3.0）—— 方法论吸收 mexicat/pdoom-video（MIT，
// docs/TREATMENT.md "Animate width and weight for expression"）：其因 Canvas2D
// 无可变轴只能把 Archivo 烘焙成静态实例离散步进切换；Remotion 跑在 Chrome DOM，
// font-variation-settings 可逐帧连续插值——本组件是这条路的正向实现。
// 用法：
//   const wght = breatheWght(frame, from);            // 帧号纯函数，调用方算轴值
//   <VarText axes={{wght}} style={{fontSize: 120}}>字</VarText>
//   或直接取字符串：style={{fontVariationSettings: varSettings({wght, wdth: 87.5})}}
// 约束：
//   - family 必须是已加载的可变字体（template/public/fonts/ 实测：NotoSansSC.ttf
//     与 NotoSerifSC[wght]/Exo2-Italic/Fraunces 均为可变，Orbitron[wght] 轴 400-900，
//     Audiowide 为静态——fonttools 核验 2026-10-11）；静态字体上传轴值被浏览器忽略
//     （视觉无变化、不报错），用前确认字体轴。
//   - CJK 排版宽度按 1em 估宽的卡（如 kinetic-type ktTextW）不受 wght 影响；
//     拉丁字重变化会轻微改变字宽，混排卡需自行实测。
//   - 确定性：轴值是帧号的纯函数，由调用方计算；本组件不做任何时间运算。
// =====================================================================

/** 轴表 → font-variation-settings 值字符串。 */
export const varSettings = (axes: Record<string, number>): string =>
  Object.entries(axes)
    .map(([k, v]) => `"${k}" ${Math.round(Number(v) * 100) / 100}`)
    .join(', ');

/** 可变字体轴渲染 span：axes 逐帧传入即得轴动画。静态字体上等价于无操作。 */
export const VarText: React.FC<{
  axes: Record<string, number>;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({axes, style, children}) => (
  <span style={{fontVariationSettings: varSettings(axes), ...style}}>{children}</span>
);

/** 字重呼吸（真字轴）：wght 在 [base−amp, base] 间正弦摆动（向下载——900 是轴上限，
 * 只能软化）。默认 base=900/amp=90/period=90f，MAD 量级与原 ±1.2% scale 相当，
 * 「定帧微动」语义不变；替换的是"用 scale 冒充字重"的假机制。
 * 需可变字体；静态字体视觉无变化（回退=呼吸消失，可见、可查，非静默出错）。 */
export const breatheWght = (frame: number, from: number, base = 900, amp = 90, period = 90): number =>
  frame < from ? base : base + amp * 0.5 * Math.sin(((frame - from) * 2 * Math.PI) / period) - amp * 0.5;
