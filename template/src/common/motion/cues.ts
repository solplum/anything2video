/** Named event timing, independently implemented for anything2video.
 * Times stay in seconds until final frame quantization: no cumulative rounding.
 * All frames in this module are zero-based except explicit storyboard conversion.
 */
export type CueDefinition = {id: string} & (
  {atSec: number; after?: never; offsetSec?: never} |
  {after: string; offsetSec?: number; atSec?: never}
);
export type ResolvedCue = Readonly<{id: string; seconds: number; frame: number}>;
const finite = (n: number, name: string) => {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
  return n;
};
const positive = (n: number, name: string) => {
  if (finite(n, name) <= 0) throw new Error(`${name} must be positive`);
  return n;
};
const safeFrame = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('frame must be a nonnegative safe integer');
  return n;
};
export const toStoryboardFrame = (frame: number): number => safeFrame(safeFrame(frame) + 1);
export const fromStoryboardFrame = (frame: number): number => safeFrame(safeFrame(frame) - 1);

/** Resolves forward references; fails on cycles, duplicate/missing ids and pre-roll. */
export function createCueSheet(fps: number, definitions: readonly CueDefinition[]) {
  positive(fps, 'fps');
  const source = new Map<string, CueDefinition>();
  for (const cue of definitions) {
    if (!cue || typeof cue.id !== 'string' || !cue.id.trim() || source.has(cue.id)) throw new Error('cue ids must be nonempty and unique');
    const absolute = 'atSec' in cue;
    if (absolute === ('after' in cue) || (absolute && 'offsetSec' in cue)) throw new Error(`cue ${cue.id}: use atSec OR after/offsetSec`);
    if (absolute) finite(cue.atSec as number, 'atSec');
    else {
      if (typeof cue.after !== 'string' || !cue.after.trim()) throw new Error(`cue ${cue.id}: missing after id`);
      finite(cue.offsetSec ?? 0, 'offsetSec');
    }
    source.set(cue.id, {...cue});
  }
  const resolved = new Map<string, ResolvedCue>();
  const visiting = new Set<string>();
  const resolve = (id: string): ResolvedCue => {
    const found = resolved.get(id);
    if (found) return found;
    const cue = source.get(id);
    if (!cue) throw new Error(`unknown cue: ${id}`);
    if (visiting.has(id)) throw new Error(`cyclic cue dependency: ${id}`);
    visiting.add(id);
    const seconds = 'atSec' in cue ? cue.atSec as number : resolve(cue.after).seconds + (cue.offsetSec ?? 0);
    if (finite(seconds, 'resolved seconds') < 0) throw new Error(`cue ${id} starts before zero; adjust the lead-in`);
    // Treat floating-point noise around a half frame as a tie, without shifting large integers.
    const value = Object.freeze({id, seconds, frame: safeFrame(Math.round(seconds * fps + Math.min(1e-7, 4 * Number.EPSILON * Math.max(1, seconds * fps))))});
    resolved.set(id, value);
    visiting.delete(id);
    return value;
  };
  for (const id of source.keys()) resolve(id);
  return Object.freeze({fps, get: resolve,
    cues: Object.freeze([...resolved.values()].sort((a, b) => a.seconds - b.seconds || a.id.localeCompare(b.id))),
  });
}

export type MotionWindow = Readonly<{start: number; end: number; reveal: number; duration: number}>;
/** Align a meaningful transition moment, not its start, to a cue frame.
 * revealProgress is RAW normalized time, not an eased output value.
 * Fractional boundaries are retained for subframe sampling / shutter blur.
 */
export function alignMotion(cueFrame: number, durationFrames: number, revealProgress = 1): MotionWindow {
  finite(cueFrame, 'cueFrame');
  positive(durationFrames, 'durationFrames');
  if (finite(revealProgress, 'revealProgress') < 0 || revealProgress > 1) throw new Error('revealProgress must be 0..1');
  const start = cueFrame - durationFrames * revealProgress;
  const end = start + durationFrames;
  if (start < 0 || !Number.isFinite(end)) throw new Error('motion window is outside finite nonnegative time; adjust the lead-in');
  return Object.freeze({start, end, reveal: cueFrame, duration: durationFrames});
}

/** Pure clamped timeline progress. Easing is applied by the caller after this. */
export function motionProgress(frame: number, window: MotionWindow): number {
  finite(frame, 'frame');
  positive(window.duration, 'window.duration');
  finite(window.start, 'window.start');
  return Math.max(0, Math.min(1, (frame - window.start) / window.duration));
}
