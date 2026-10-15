import { Flat, Point3, Projection, iso, pathOf, tenth, add3, sub3, mul3, dot3, len3, unit3, cross3, cameraOf } from "./math";

export interface Frame {
  o: Point3;
  a: Point3;
  u: Point3;
  v: Point3;
}

const BANDS = [0, 0.2, 0.42, 0.62];
const LIGHT_UP = 1.2;

export function frameAlong(o: Point3, a: Point3): Frame {
  const axis = unit3(a);
  const helper: Point3 = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = unit3(cross3(helper, axis));
  const v = cross3(axis, u);
  return { o, a: axis, u, v };
}

export function lightOf(projection: Projection): Point3 {
  const { sinA, cosA } = cameraOf(projection);
  return unit3([-sinA, cosA, LIGHT_UP]);
}

export function pointOf(F: Frame, s: number, r: number, angle: number): Point3 {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  return [
    F.o[0] + F.a[0] * s + r * (c * F.u[0] + n * F.v[0]),
    F.o[1] + F.a[1] * s + r * (c * F.u[1] + n * F.v[1]),
    F.o[2] + F.a[2] * s + r * (c * F.u[2] + n * F.v[2]),
  ];
}

export function normalOf(F: Frame, s: number, r: number, angle: number, dr_ds = 0): Point3 {
  const c = Math.cos(angle);
  const n = Math.sin(angle);
  const radial: Point3 = [
    c * F.u[0] + n * F.v[0],
    c * F.u[1] + n * F.v[1],
    c * F.u[2] + n * F.v[2],
  ];
  return unit3(sub3(radial, mul3(F.a, dr_ds)));
}

export function bandOf(score: number): number {
  let tone = 0;
  while (tone < BANDS.length && score >= BANDS[tone]!) tone++;
  return tone;
}

export interface LatheResult {
  outline: string;
  shades: string[];
  capStart?: string;
  capEnd?: string;
}

export function lathe(
  F: Frame,
  profile: [number, number][], // [s, radius] along axis
  projection: Projection,
  steps = 32
): LatheResult {
  const shades: string[] = ["", "", "", ""];
  const light = lightOf(projection);
  const dAng = (Math.PI * 2) / steps;
  
  for (let i = 0; i < profile.length - 1; i++) {
    const [s0, r0] = profile[i]!;
    const [s1, r1] = profile[i + 1]!;
    const dr_ds = (r1 - r0) / (s1 - s0 || 1e-6);
    
    for (let k = 0; k < steps; k++) {
      const a0 = k * dAng;
      const a1 = a0 + dAng;
      const midAng = (a0 + a1) / 2;
      
      const p00 = iso(pointOf(F, s0, r0, a0), projection);
      const p10 = iso(pointOf(F, s1, r1, a0), projection);
      const p11 = iso(pointOf(F, s1, r1, a1), projection);
      const p01 = iso(pointOf(F, s0, r0, a1), projection);
      
      const nMid = normalOf(F, (s0 + s1) / 2, (r0 + r1) / 2, midAng, dr_ds);
      const score = dot3(nMid, light);
      const band = Math.min(3, Math.max(0, bandOf(score)));
      
      shades[band] += pathOf([p00, p10, p11, p01], true);
    }
  }
  
  // Extract visible silhouette/outline
  const outlinePts: Flat[] = [];
  for (let i = 0; i < profile.length; i++) {
    const [s, r] = profile[i]!;
    outlinePts.push(iso(pointOf(F, s, r, 0), projection));
  }
  for (let i = profile.length - 1; i >= 0; i--) {
    const [s, r] = profile[i]!;
    outlinePts.push(iso(pointOf(F, s, r, Math.PI), projection));
  }
  
  return {
    outline: pathOf(outlinePts, true),
    shades,
  };
}
