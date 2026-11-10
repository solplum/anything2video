/** Fixed screen-space lattice retained as a public layout / QC contract.
 * Illumination is a periodic diagonal carrier, evaluated directly at time t.
 * No accumulated state: seeking, reverse playback and parallel renders agree.
 */
export const DOT_WIDTH = 960;
export const DOT_HEIGHT = 540;
export const DOT_STEP = 36;
export const DOT_X0 = 24;
export const DOT_Y0 = 18;
export const DOT_MAX_RADIUS = 1.8;
export const DOT_BACKGROUND = '#0a0c10';
export const DOT_COLOR = '#b7d0ed';

export function dotAppearance(x: number, y: number, seconds: number) {
  const t = Number.isFinite(seconds) ? seconds : 0;
  const u = x / DOT_WIDTH;
  const v = y / DOT_HEIGHT;
  // The phase axis runs diagonally across the normalized image. A raised
  // cosine crest creates a soft narrow band; the longer spatial wavelength
  // leaves a quiet interval between passes without a discontinuous phase reset.
  const projection = 0.72 * u + 0.28 * v;
  const carrier = Math.cos(2 * Math.PI * (projection / 1.65 + 0.12 - t / 14));
  const light = Math.max(0, carrier) ** 12;
  const inset = Math.max(0, Math.min(u, 1 - u, v, 1 - v));
  const rim = 0.3 + 0.7 * Math.min(1, inset / 0.18);
  return {opacity: (0.17 + 0.55 * light) * rim, radius: 1.4 + 0.4 * light};
}

export function dotsVisible(frame: number, specs: readonly {from: number; to: number; stars?: unknown}[]) {
  return !specs.some(({from, to, stars}) => stars === 'none' && from <= frame + 1 && frame + 1 <= to);
}

export const DOT_POSITIONS = Array.from(
  {length: Math.ceil((DOT_HEIGHT - DOT_Y0) / DOT_STEP)}, (_, row) =>
    Array.from({length: Math.ceil((DOT_WIDTH - DOT_X0) / DOT_STEP)}, (_, column) =>
      ({x: DOT_X0 + column * DOT_STEP, y: DOT_Y0 + row * DOT_STEP})),
).flat();
