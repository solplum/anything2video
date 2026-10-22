/** Original, artwork-independent timing for riso separations.
 * Frames are zero-based and may be fractional. Convert seconds with the caller's
 * FPS once; these functions neither round frames nor assume a playback rate.
 */
export type RevealBounds = Readonly<{x: number; y: number; width: number; height: number}>;
export type RevealDirection = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top';
export type RevealEvent = Readonly<{
  startFrame: number;
  endFrame: number;
  direction?: RevealDirection;
  /** A paper-coordinate region; the sweep fills this area for the whole event. */
  bounds?: RevealBounds;
}>;
export type RegistrationKick = Readonly<{
  atFrame: number;
  durationFrames: number;
  x: number;
  y: number;
}>;
/** A one-time linear move to a new registration offset, held after endFrame. */
export type RegistrationDrift = Readonly<{
  startFrame: number;
  endFrame: number;
  x: number;
  y: number;
}>;
export type Registration = Readonly<{
  /** A fixed, shot-level offset in SVG user units. */
  x?: number;
  y?: number;
  /** Optional event-driven shift; never a free-running wobble. */
  drift?: RegistrationDrift;
  /** Decaying impulses add to the shot offset (and to one another). */
  kicks?: readonly RegistrationKick[];
}>;
export type PlateOffset = Readonly<{x: number; y: number}>;
export type RevealRect = Readonly<{x: number; y: number; width: number; height: number}>;

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
};
const positive = (value: number, name: string): number => {
  if (finite(value, name) <= 0) throw new RangeError(`${name} must be positive`);
  return value;
};
function validateBounds(bounds: RevealBounds): void {
  if (finite(bounds.x, 'bounds.x') < 0 || finite(bounds.y, 'bounds.y') < 0) {
    throw new RangeError('reveal bounds must start inside the paper');
  }
  positive(bounds.width, 'bounds.width');
  positive(bounds.height, 'bounds.height');
  finite(bounds.x + bounds.width, 'bounds right edge');
  finite(bounds.y + bounds.height, 'bounds bottom edge');
}
const directions: readonly RevealDirection[] = ['left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top'];

function windowProgress(frame: number, start: number, end: number): number {
  finite(frame, 'frame');
  finite(start, 'startFrame');
  finite(end, 'endFrame');
  const duration = finite(end - start, 'window duration');
  if (duration < 0) throw new RangeError('endFrame must be at least startFrame');
  // A zero-duration event is an intentional hard gate at startFrame.
  if (frame < start) return 0;
  if (frame >= end) return 1;
  return (frame - start) / duration;
}

/** Linear sweep progress. Omitted reveal means the complete separation. */
export function revealProgress(frame: number, reveal?: RevealEvent): number {
  finite(frame, 'frame');
  if (!reveal) return 1;
  if (reveal.bounds !== undefined) validateBounds(reveal.bounds);
  if (reveal.direction !== undefined && !directions.includes(reveal.direction)) {
    throw new RangeError('unknown reveal direction');
  }
  return windowProgress(frame, reveal.startFrame, reveal.endFrame);
}

/** The sweep gate stays in paper coordinates, independently of registration. */
export function revealRect(frame: number, reveal: RevealEvent | undefined, width: number, height: number): RevealRect {
  positive(width, 'width');
  positive(height, 'height');
  const progress = revealProgress(frame, reveal);
  const bounds = reveal?.bounds ?? {x: 0, y: 0, width, height};
  if (bounds.x + bounds.width > width || bounds.y + bounds.height > height) {
    throw new RangeError('reveal bounds must fit inside the paper');
  }
  const {x, y, width: w, height: h} = bounds;
  switch (reveal?.direction ?? 'left-to-right') {
    case 'left-to-right': return {x, y, width: w * progress, height: h};
    case 'right-to-left': return {x: x + w * (1 - progress), y, width: w * progress, height: h};
    case 'top-to-bottom': return {x, y, width: w, height: h * progress};
    case 'bottom-to-top': return {x, y: y + h * (1 - progress), width: w, height: h * progress};
  }
}

/** Pure registration evaluation: random seeking has no history or RNG state.
 * Each kick starts at full displacement and decays quadratically to exactly
 * zero at atFrame + durationFrames. Before/after an event, the plate is still.
 */
export function registrationOffset(frame: number, registration?: Registration): PlateOffset {
  finite(frame, 'frame');
  let x = finite(registration?.x ?? 0, 'registration.x');
  let y = finite(registration?.y ?? 0, 'registration.y');
  const drift = registration?.drift;
  if (drift) {
    finite(drift.x, 'drift.x');
    finite(drift.y, 'drift.y');
    const progress = windowProgress(frame, drift.startFrame, drift.endFrame);
    x += drift.x * progress;
    y += drift.y * progress;
  }
  for (const kick of registration?.kicks ?? []) {
    finite(kick.atFrame, 'kick.atFrame');
    positive(kick.durationFrames, 'kick.durationFrames');
    finite(kick.x, 'kick.x');
    finite(kick.y, 'kick.y');
    const end = finite(kick.atFrame + kick.durationFrames, 'kick endFrame');
    if (end <= kick.atFrame) throw new RangeError('kick duration must advance time');
    if (frame < kick.atFrame || frame >= end) continue;
    const remaining = 1 - (frame - kick.atFrame) / kick.durationFrames;
    const envelope = remaining * remaining;
    x += kick.x * envelope;
    y += kick.y * envelope;
  }
  return {x: finite(x, 'result.x'), y: finite(y, 'result.y')};
}
