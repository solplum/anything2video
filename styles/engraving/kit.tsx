import React, {useLayoutEffect, useRef} from 'react';
import {B, engraveShape, type Shape} from './engine';

export const ENGRAVING = {paper: '#F1E8D2', ink: '#1C1510', wash: '#B29A48', accent: '#6B492B'};
// Original subject geometry; no upstream demo composition or specimen is reused.
export const PEAR = 'M -17 -166 C -49 -156 -37 -99 -79 -49 C -154 37 -157 145 -88 179 C -47 204 5 190 18 190 C 42 204 111 194 139 150 C 178 84 125 8 82 -48 C 43 -98 53 -153 17 -166 C 6 -172 -9 -170 -17 -166 Z';
export const LEAF = 'M 8 -179 C 41 -240 124 -251 145 -233 C 110 -188 53 -166 8 -179 Z';
const clamp = (x: number) => Math.max(0, Math.min(1, x));

function makePlate(seed: number) {
  const ink = new B.Ink();
  const pear = engraveShape(PEAR, {ink, g: 'pear', style: 'contour', spacing: 4.8, wMax: 2.3, outlineW: 2.3, seed});
  engraveShape(LEAF, {ink, g: 'leaf', spacing: 3.7, wMax: 1.8, angle: -0.38, seed: seed + 11});
  ink.group('stem');
  B.stroke(ink, [[-3, -162], [-5, -180], [2, -199], [8, -216]], 6, {taper: 10});
  B.stroke(ink, [[9, -182], [47, -202], [92, -217], [142, -233]], 1.5);
  for (const prefix of ['pear', 'leaf']) {
    ink.schedule(prefix + 'ol', 0, 1.2);
    ink.schedule(prefix + 'h1', 1.2, 4);
    ink.schedule(prefix + 'h2', 4, 5.5);
    ink.schedule(prefix + 'h3', 5.2, 6.2);
  }
  ink.schedule('stem', 0.1, 1.1);
  ink.build();
  return {ink, pear: pear.shape};
}

function wash(ctx: CanvasRenderingContext2D, shape: Shape, seconds: number) {
  const p = clamp((seconds - 6.4) / 1.8);
  if (!p) return;
  ctx.save();
  ctx.clip(shape.path);
  // Colour comes after the black print, underneath the ink. The wet front grows
  // spatially, without temporal accumulation or animation-clock state.
  ctx.beginPath(); ctx.ellipse(-52, 15, 370 * p, 440 * p, -0.2, 0, Math.PI * 2); ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(178,154,72,0.30)'; ctx.fill(shape.path);
  const r = B.RNG(719);
  for (let i = 0; i < 420; i++) {
    const x = -150 + r() * 320, y = -170 + r() * 380;
    ctx.fillStyle = `rgba(133,112,38,${0.025 + r() * 0.035})`;
    ctx.beginPath(); ctx.ellipse(x, y, 3 + r() * 13, 2 + r() * 8, r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(133,112,38,0.14)'; ctx.lineWidth = 3; ctx.stroke(shape.path);
  ctx.restore();
}

/** Pure frame input. Re-seeking and out-of-order frames reconstruct the full image.
 * Host supplies the canvas size and frame/fps; no RAF, audio or second exporter. */
export const EngravedPear: React.FC<{frame: number; fps: number; width: number; height: number; seed?: number}> = ({frame, fps, width, height, seed = 41}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const plate = useRef<ReturnType<typeof makePlate> | null>(null);
  const plateSeed = useRef<number | null>(null);
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) throw new Error('engraving requires Canvas 2D');
    if (!plate.current || plateSeed.current !== seed) {plate.current = makePlate(seed); plateSeed.current = seed;}
    ctx.clearRect(0, 0, width, height);
    const s = Math.min(width / 560, height / 540);
    ctx.save(); ctx.translate(width / 2, height / 2 + 18 * s); ctx.scale(s, s);
    wash(ctx, plate.current.pear, frame / fps);
    plate.current.ink.draw(ctx, frame / fps);
    ctx.restore();
  }, [frame, fps, width, height, seed]);
  return <canvas ref={canvas} width={width} height={height} style={{width, height, display: 'block'}}/>;
};

/** Paper coordinates belong to the composition, so grain never crawls each frame. */
export const PlatePaper: React.FC<{width: number; height: number}> = ({width, height}) => {
  const r = B.RNG(53);
  const marks = Array.from({length: 220}, (_, i) => ({x: r() * width, y: r() * height, length: 2 + r() * 8, key: i}));
  return <svg width={width} height={height} style={{position: 'absolute', inset: 0}} aria-hidden="true">
    <rect width={width} height={height} fill={ENGRAVING.paper}/>
    {marks.map(m => <path key={m.key} d={`M${m.x} ${m.y}l${m.length} 1`} stroke="#745A35" strokeWidth="0.65" opacity="0.13"/>)}
    <rect x="23" y="23" width={width - 46} height={height - 46} fill="none" stroke="#9B8866" strokeWidth="3"/>
    <rect x="26" y="26" width={width - 52} height={height - 52} fill="none" stroke="#FFF8E8" strokeWidth="2"/>
    <rect x="36" y="36" width={width - 72} height={height - 72} fill="none" stroke={ENGRAVING.ink} strokeWidth="0.8"/>
  </svg>;
};
