import { Flat, Point3, Projection, iso, pathOf, tenth, add3, sub3, mul3, len3, unit3, cross3 } from "./math";

export interface TubePiece {
  fill: string;
  outline: string;
  shine?: string;
  shade?: string;
  depth: number;
}

export function tubePieces(
  points: Point3[],
  radius: number,
  projection: Projection,
  options: {
    gaps?: [number, number][]; // arc-length spans to gap (e.g. under collars)
    breaks?: number[];
  } = {}
): TubePiece[] {
  if (points.length < 2) return [];
  
  const pieces: TubePiece[] = [];
  const screenPts = points.map(p => iso(p, projection));
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = screenPts[i]!;
    const p1 = screenPts[i + 1]!;
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-4) continue;
    
    const nx = (-dy / dist) * radius * projection.scale;
    const ny = (dx / dist) * radius * projection.scale;
    
    const left0: Flat = [p0[0] + nx, p0[1] + ny];
    const right0: Flat = [p0[0] - nx, p0[1] - ny];
    const left1: Flat = [p1[0] + nx, p1[1] + ny];
    const right1: Flat = [p1[0] - nx, p1[1] - ny];
    
    const fill = pathOf([left0, left1, right1, right0], true);
    
    // Average 3D depth for painters order sorting
    const depth = (points[i]![2] + points[i + 1]![2]) / 2;
    
    // Shine highlight line
    const shine0: Flat = [p0[0] + nx * 0.35, p0[1] + ny * 0.35];
    const shine1: Flat = [p1[0] + nx * 0.35, p1[1] + ny * 0.35];
    const shine = `M${tenth(shine0[0])} ${tenth(shine0[1])}L${tenth(shine1[0])} ${tenth(shine1[1])}`;
    
    pieces.push({
      fill,
      outline: fill,
      shine,
      depth,
    });
  }
  
  return pieces;
}
