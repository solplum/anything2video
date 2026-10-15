import { Flat, Point3, Plane, Projection, iso, pathOf, tenth, add3, sub3, mul3, dot3, cameraOf, towardViewer, AZIMUTH, ELEVATION, SHADES } from "./math";

export interface Plan {
  x: number;
  y: number;
  w: number;
  d: number;
  r: number;
}

export interface SolidPaths {
  fill: string;
  outline: string;
  crease: string;
  top: string;
  shades: string[];
  bevel?: string;
}

export type Tone = "hi" | "mid" | "lo" | "faint";
export type LineTone = Tone | "lit" | "red" | "green" | "blue";

const RADIANS = Math.PI / 180;

export function roundedPlan({ x, y, w, d, r }: Plan, steps = 8): Plane[] {
  const radius = Math.max(0, Math.min(r, w / 2, d / 2));
  const corners: [number, number, number][] = [
    [x + w - radius, y + radius, -90],
    [x + w - radius, y + d - radius, 0],
    [x + radius, y + d - radius, 90],
    [x + radius, y + radius, 180],
  ];
  const out: Plane[] = [];
  for (const [cx, cy, start] of corners) {
    const count = radius > 0 ? steps : 0;
    for (let step = 0; step <= count; step++) {
      const angle = (start + (count ? (90 * step) / count : 45)) * RADIANS;
      out.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  }
  return out;
}

export function insetPlan({ x, y, w, d, r }: Plan, inset: number): Plan {
  return {
    x: x + inset,
    y: y + inset,
    w: Math.max(0, w - inset * 2),
    d: Math.max(0, d - inset * 2),
    r: Math.max(0, r - inset),
  };
}

export function corners({ x, y, w, d }: Plan, inset: number): Plane[] {
  return [
    [x + inset, y + inset],
    [x + w - inset, y + inset],
    [x + w - inset, y + d - inset],
    [x + inset, y + d - inset],
  ];
}

export function slabOf(plan: Plan, z: number, height: number, projection: Projection, steps = 8, bevel = 0): SolidPaths {
  const baseRing = roundedPlan(plan, steps);
  const topRing = baseRing.map(([px, py]): Point3 => [px, py, z + height]);
  const botRing = baseRing.map(([px, py]): Point3 => [px, py, z]);
  
  const topPoints = topRing.map(p => iso(p, projection));
  const botPoints = botRing.map(p => iso(p, projection));
  
  const shades: string[] = Array.from({ length: SHADES }, () => "");
  const [vx, vy] = towardViewer(projection);
  
  // Build side quads and assign to 4 shade tones based on surface normal dot viewer
  for (let i = 0; i < baseRing.length; i++) {
    const j = (i + 1) % baseRing.length;
    const [x0, y0] = baseRing[i]!;
    const [x1, y1] = baseRing[j]!;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const nx = dy;
    const ny = -dx;
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) continue;
    
    const dot = (nx * vx + ny * vy) / len;
    if (dot <= 0) continue; // backfacing side
    
    const quad: Flat[] = [
      topPoints[i]!,
      topPoints[j]!,
      botPoints[j]!,
      botPoints[i]!
    ];
    const shadeIdx = Math.min(SHADES - 1, Math.max(0, Math.floor((1 - dot) * SHADES)));
    shades[shadeIdx] += pathOf(quad, true);
  }
  
  const topPath = pathOf(topPoints, true);
  const outlinePath = pathOf([...topPoints, ...botPoints], true); // Simplified hull
  
  return {
    fill: topPath,
    top: topPath,
    outline: outlinePath,
    crease: pathOf(topPoints, true),
    shades,
  };
}

export function cylinder(cx: number, cy: number, r: number, z: number, height: number, projection: Projection, segments = 32): SolidPaths {
  const plan: Plan = { x: cx - r, y: cy - r, w: r * 2, d: r * 2, r };
  return slabOf(plan, z, height, projection, Math.ceil(segments / 4));
}

export function knurl(cx: number, cy: number, r: number, z0: number, z1: number, count: number, projection: Projection): string {
  const lines: string[] = [];
  const dAngle = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const a0 = i * dAngle;
    const a1 = a0 + dAngle;
    const p0 = iso([cx + r * Math.cos(a0), cy + r * Math.sin(a0), z0], projection);
    const p1 = iso([cx + r * Math.cos(a1), cy + r * Math.sin(a1), z1], projection);
    lines.push(`M${tenth(p0[0])} ${tenth(p0[1])}L${tenth(p1[0])} ${tenth(p1[1])}`);
  }
  return lines.join("");
}

export function coil(xFrom: number, xTo: number, [cy, cz]: [number, number], r: number, turns: number, axis: "x" | "y" | "z", projection: Projection) {
  const stepsPerTurn = 24;
  const totalSteps = turns * stepsPerTurn;
  const backSegments: string[] = [];
  const frontSegments: string[] = [];
  
  for (let i = 0; i < totalSteps; i++) {
    const t0 = i / totalSteps;
    const t1 = (i + 1) / totalSteps;
    const pos0 = xFrom + (xTo - xFrom) * t0;
    const pos1 = xFrom + (xTo - xFrom) * t1;
    const ang0 = t0 * turns * Math.PI * 2;
    const ang1 = t1 * turns * Math.PI * 2;
    
    const p0: Point3 = axis === "x"
      ? [pos0, cy + r * Math.cos(ang0), cz + r * Math.sin(ang0)]
      : [cy + r * Math.cos(ang0), pos0, cz + r * Math.sin(ang0)];
    const p1: Point3 = axis === "x"
      ? [pos1, cy + r * Math.cos(ang1), cz + r * Math.sin(ang1)]
      : [cy + r * Math.cos(ang1), pos1, cz + r * Math.sin(ang1)];
      
    const pt0 = iso(p0, projection);
    const pt1 = iso(p1, projection);
    const line = `M${tenth(pt0[0])} ${tenth(pt0[1])}L${tenth(pt1[0])} ${tenth(pt1[1])}`;
    
    // Split into front/back by normal toward viewer
    if (Math.sin(ang0) > 0) frontSegments.push(line);
    else backSegments.push(line);
  }
  
  return {
    back: backSegments.join(""),
    front: frontSegments.join("")
  };
}

export function haloOf(plan: Plan, z: number, blur: number, projection: Projection): string {
  const pts = roundedPlan(plan, 8).map(([x, y]) => iso([x, y, z], projection));
  return pathOf(pts, true);
}
