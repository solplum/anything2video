import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {EngravedPear, PlatePaper, ENGRAVING} from './style/kit';

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const portrait = height > width;
  const t = frame / fps;
  const label = t < 1.2 ? '01  刻出轮廓' : t < 4 ? '02  排线塑造明暗' : t < 6.4 ? '03  交叉排线加深' : '04  透明设色，墨线仍在上方';
  const unit = width / (portrait ? 720 : 1280);
  const figureW = (portrait ? 650 : 640) * unit;
  const figureH = (portrait ? 650 : 490) * unit;
  const figureX = (width - figureW) / 2;
  const figureY = (portrait ? 285 : 125) * unit;
  const rule = (text: string, x: number, y: number, w: number, start: number) => <div style={{position: 'absolute', left: x * unit, top: y * unit, width: w * unit, fontSize: 34 * unit, lineHeight: 1.55, whiteSpace: 'pre-line', clipPath: `inset(0 ${100 * (1 - Math.max(0, Math.min(1, (t - start) / 0.7)))}% 0 0)`}}>{text}</div>;
  return <AbsoluteFill style={{color: ENGRAVING.ink, fontFamily: 'PlateSerif, serif'}}>
    <style>{`@font-face{font-family:PlateSerif;src:url('${staticFile('fonts/NotoSerifSC.ttf')}')} @font-face{font-family:PlateRoman;src:url('${staticFile('fonts/Fraunces.ttf')}')}`}</style>
    <PlatePaper width={width} height={height}/>
    <div style={{position: 'absolute', top: 62 * unit, width: '100%', textAlign: 'center', fontSize: (portrait ? 47 : 44) * unit, fontWeight: 700, letterSpacing: 4 * unit}}>一枚梨的明暗</div>
    <div style={{position: 'absolute', top: 126 * unit, width: '100%', textAlign: 'center', fontFamily: 'PlateRoman, serif', fontSize: 21 * unit, fontStyle: 'italic'}}>A study in copperplate · Plate I</div>
    <div style={{position: 'absolute', left: figureX, top: figureY}}><EngravedPear frame={frame} fps={fps} width={figureW} height={figureH}/></div>
    {rule('受光处\n留出纸白', portrait ? 86 : 82, portrait ? 213 : 264, portrait ? 548 : 220, 2.4)}
    {rule('背光处\n交叉排线', portrait ? 86 : 1005, portrait ? 947 : 355, portrait ? 548 : 220, 4.5)}
    <svg width={width} height={height} style={{position: 'absolute'}} aria-hidden="true">
      {t >= 3.1 && <g transform={`scale(${unit})`}><path d={portrait ? 'M248 290 L320 505' : 'M300 316 L580 350'} fill="none" stroke={ENGRAVING.ink} strokeWidth="1.1"/><circle cx={portrait ? 320 : 580} cy={portrait ? 505 : 350} r="2.5" fill={ENGRAVING.ink}/></g>}
      {t >= 5.2 && <g transform={`scale(${unit})`}><path d={portrait ? 'M255 1000 L575 1000 L530 750' : 'M1000 403 L770 455'} fill="none" stroke={ENGRAVING.ink} strokeWidth="1.1"/><circle cx={portrait ? 530 : 770} cy={portrait ? 750 : 455} r="2.5" fill={ENGRAVING.ink}/></g>}
    </svg>
    <div style={{position: 'absolute', bottom: 75 * unit, left: 60 * unit, right: 60 * unit, textAlign: 'center', fontSize: 34 * unit, borderTop: `1px solid ${ENGRAVING.accent}`, paddingTop: 16 * unit}}>{label}</div>
    <div style={{position: 'absolute', bottom: 43 * unit, width: '100%', textAlign: 'center', fontSize: 21 * unit, letterSpacing: 2 * unit}}>铜版雕刻 · 材质研究 · 无声</div>
  </AbsoluteFill>;
};
