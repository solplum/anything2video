/** Opt-in teaching overlays. Frames use the caller's timebase, not wall-clock time. */
export const TEACHING = Object.freeze({promptSize: 48, labelSize: 40, noteSize: 38, fadeFrames: 6});

/** Fully readable at from + fadeFrames; remains still until until, then fades out. */
export function teachingOpacity(frame, from, until = Infinity, fadeFrames = TEACHING.fadeFrames) {
  if (!Number.isFinite(frame) || !Number.isFinite(from) ||
      !(Number.isFinite(until) || until === Infinity) ||
      !Number.isFinite(fadeFrames) || fadeFrames < 0 || until < from + fadeFrames) {
    throw new RangeError('Invalid teaching cue: finite frames, nonnegative fade and a complete entry are required');
  }
  if (frame < from) return 0;
  if (fadeFrames === 0) return frame < until ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - from) / fadeFrames, (until + fadeFrames - frame) / fadeFrames));
}
