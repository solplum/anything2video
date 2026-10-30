// SPDX-License-Identifier: Apache-2.0
// Local bounded adaptations, 2026-10-30. See ../MODIFICATIONS.md.
// Methods compared with video-shotcraft 1266a3ec4831289c4d893d42dd5102723658039a.

// A CSS circle radius takes a length, not a percentage. Resolve the design
// percentage against the small canvas width BEFORE DesignStage scales it.
export const circleRadiusPx = (percent, designWidth) => percent / 100 * designWidth;

// Preserve the original approach and spring settling time; only compress its
// below-rest excursion. A clamp of the display alone would lie about overlap.
// The 0..max bound is defensive: the configured spring stays strictly above 0.
export const boundedSpringGap = (progress, rest, max) => {
  const compressed = progress > 1 ? 1 + (progress - 1) * 0.45 : progress;
  return Math.max(0, Math.min(max, max + (rest - max) * compressed));
};
