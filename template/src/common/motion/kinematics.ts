/**
 * Frame-pure analytical kinematics and secondary spring overlap for deterministic Remotion animation.
 * Zero mutable state: safe under concurrent / out-of-order frame rendering.
 */

export type Vec2 = Readonly<{x: number; y: number}>;

export type TwoBoneIKResult = Readonly<{
  joint: Vec2;
  end: Vec2;
  reachRatio: number;
}>;

export type PelvisState = Readonly<{
  bobY: number;
  tiltDeg: number;
  strideLeanPx: number;
}>;

export type SpringOptions = Readonly<{
  stiffness?: number;
  damping?: number;
  historyFrames?: number;
  mass?: number;
}>;

export type SpringResult = Readonly<{
  value: number;
  velocity: number;
}>;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const assertFinite = (v: number, name: string): void => {
  if (!Number.isFinite(v)) throw new RangeError(`${name} must be finite`);
};

/**
 * Analytic two-bone inverse kinematics using Law of Cosines.
 * Guarantees exact rigid segment lengths L1 and L2 (no rubber-band stretching).
 * In screen coordinates (+x right, +y down):
 * - For downward legs, bendDir=1 bends knee forward (+x).
 * - For rightward arms, bendDir=-1 bends elbow downward (+y).
 */
export function solveTwoBoneIK(
  root: Vec2,
  target: Vec2,
  L1: number,
  L2: number,
  bendDir: 1 | -1 = 1,
): TwoBoneIKResult {
  assertFinite(root.x, 'root.x');
  assertFinite(root.y, 'root.y');
  assertFinite(target.x, 'target.x');
  assertFinite(target.y, 'target.y');
  if (!Number.isFinite(L1) || L1 <= 0 || !Number.isFinite(L2) || L2 <= 0) {
    throw new RangeError('L1 and L2 must be positive finite numbers');
  }
  const vx = target.x - root.x;
  const vy = target.y - root.y;
  const rawD = Math.hypot(vx, vy);
  const ux = rawD > 1e-6 ? vx / rawD : 0;
  const uy = rawD > 1e-6 ? vy / rawD : 1;

  const minD = Math.abs(L1 - L2) + 1e-4;
  const maxD = (L1 + L2) * 0.999;
  const d = clamp(rawD, minD, maxD);
  const end: Vec2 =
    rawD > maxD || rawD < minD
      ? {x: root.x + ux * d, y: root.y + uy * d}
      : {x: target.x, y: target.y};

  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const along = L1 * cosA;
  const perp = L1 * Math.sqrt(Math.max(0, 1 - cosA * cosA));
  // Screen perpendicular rotated -90deg: (uy, -ux) points +x when limb goes +y, and -y when limb goes +x.
  const px = uy * bendDir;
  const py = -ux * bendDir;
  const joint: Vec2 = {
    x: root.x + ux * along + px * perp,
    y: root.y + uy * along + py * perp,
  };
  return {joint, end, reachRatio: rawD / (L1 + L2)};
}

/**
 * Computes natural pelvis vertical weight shift, hip tilt, and lean from left/right swing progress [0..1].
 */
export function walkPelvisState(
  leftSwing01: number,
  rightSwing01: number,
  moving: boolean,
  effort01 = 0,
): PelvisState {
  assertFinite(leftSwing01, 'leftSwing01');
  assertFinite(rightSwing01, 'rightSwing01');
  assertFinite(effort01, 'effort01');
  const eff = clamp(effort01, 0, 1);
  if (!moving) {
    return {
      bobY: eff * 3.5,
      tiltDeg: 0,
      strideLeanPx: eff * 6.0,
    };
  }
  const lArc = Math.sin(Math.PI * clamp(leftSwing01, 0, 1));
  const rArc = Math.sin(Math.PI * clamp(rightSwing01, 0, 1));
  const peak = Math.max(lArc, rArc);
  return {
    bobY: 3.5 - 8.5 * peak + eff * 4.5,
    tiltDeg: (lArc - rArc) * 3.6,
    strideLeanPx: 3.5 + eff * 8.5,
  };
}

/**
 * Frame-pure secondary spring overlap evaluated deterministically over a bounded lookback window.
 * Produces authentic lag, subtle overshoot, and settle without mutable module state.
 */
export function followSpring(
  driverAt: (frame: number) => number,
  frame: number,
  opts: SpringOptions = {},
): SpringResult {
  assertFinite(frame, 'frame');
  const stiffness = opts.stiffness ?? 0.16;
  const damping = opts.damping ?? 0.72;
  const mass = opts.mass ?? 1;
  const historyFrames = opts.historyFrames ?? 36;
  if (!Number.isFinite(stiffness) || stiffness <= 0) throw new RangeError('stiffness must be > 0');
  if (!Number.isFinite(damping) || damping < 0 || damping >= 1) throw new RangeError('damping must be in [0, 1)');
  if (!Number.isFinite(mass) || mass <= 0) throw new RangeError('mass must be > 0');
  if (!Number.isInteger(historyFrames) || historyFrames < 1) throw new RangeError('historyFrames must be >= 1 integer');

  const fStart = frame - historyFrames;
  let value = driverAt(fStart);
  assertFinite(value, 'driverAt(start)');
  let velocity = 0;
  for (let f = fStart + 1; f <= frame; f++) {
    const target = driverAt(f);
    assertFinite(target, 'driverAt(step)');
    velocity = (velocity + ((target - value) * stiffness) / mass) * damping;
    value += velocity;
  }
  return {value, velocity};
}

/**
 * Parabolic arc trajectory interpolation with vertical lift (negative screen Y by default).
 */
export function arcPoint(from: Vec2, to: Vec2, t01: number, liftPx: number): Vec2 {
  assertFinite(from.x, 'from.x');
  assertFinite(from.y, 'from.y');
  assertFinite(to.x, 'to.x');
  assertFinite(to.y, 'to.y');
  assertFinite(t01, 't01');
  assertFinite(liftPx, 'liftPx');
  const p = clamp(t01, 0, 1);
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - 4 * liftPx * p * (1 - p),
  };
}
