// Adapted from lemo-opuscar, Copyright (c) 2026 LemoLab, MIT.
// See ../../../LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt and ../UPSTREAM.md.
// Only the line engine is retained; Remotion owns timing, compositing and export.
export * as B from './burin.js';
import * as B from './burin.js';

export function engraveShape(d, {at = B.xf(), light = [-0.6, -0.7], spacing = 4, wMax = 1.6, outlineW = 1.8, style = 'hatch', angle = -0.6, ink = new B.Ink(), g = '', base = 0.05, seed = 1} = {}) {
  const sh = typeof d === 'string' ? B.shape(d, at) : d;
  const tone = B.formTone(sh.polys, {light, base});
  ink.group(g + 'ol');
  for (const p of sh.polys) B.outline(ink, p, {w: outlineW, light, seed});
  for (const l of sh.lines || []) B.stroke(ink, l, outlineW * 0.8);
  if (style === 'contour') {
    ink.group(g + 'h1'); B.contourHatch(ink, sh.polys, {spacing, tone, wMax, thr: 0.12, seed});
    ink.group(g + 'h2'); B.hatch(ink, sh.polys, {angle, spacing: spacing * 1.15, tone, thr: 0.55, wMax: wMax * 0.8, seed: seed + 1});
  } else {
    ink.group(g + 'h1'); B.hatch(ink, sh.polys, {angle, spacing, tone, thr: 0.12, wMax, seed});
    ink.group(g + 'h2'); B.hatch(ink, sh.polys, {angle: angle + 1.05, spacing: spacing * 1.1, tone, thr: 0.5, wMax: wMax * 0.8, seed: seed + 1});
  }
  ink.group(g + 'h3'); B.hatch(ink, sh.polys, {angle: angle - 0.5, spacing: spacing * 1.25, tone, thr: 0.78, wMax: wMax * 0.6, seed: seed + 2});
  return {ink, shape: sh, tone};
}
