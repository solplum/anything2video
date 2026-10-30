import fs from 'node:fs';
import path from 'node:path';
import {isRecord, nonempty, projectFile, sha256File} from './runtime-lib.mjs';

export const MATCH_CUT_MODE = 'match-cut-beat-relay';
const directions = ['left', 'right', 'up', 'down', 'in', 'out', 'clockwise', 'counterclockwise', 'none'];
const finite = n => typeof n === 'number' && Number.isFinite(n);
const positive = n => finite(n) && n > 0;
const frame = n => Number.isSafeInteger(n) && n >= 1;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const sortedShots = plan => (Array.isArray(plan?.shots) ? plan.shots : []).filter(isRecord).sort((a, b) => a.from - b.from);
const active = project => project?.editingMode === MATCH_CUT_MODE;

/** Opt-in storyboard contract. No palette, recipe, overlay or default timing changes. */
export function validateEditingMode(project, plan) {
  const errors = [];
  const mode = project?.editingMode;
  if (mode !== undefined && !['standard', MATCH_CUT_MODE].includes(mode)) errors.push('Unknown editingMode; omit it, use standard, or match-cut-beat-relay');
  if (!active(project)) {
    if (plan?.matchCut !== undefined || sortedShots(plan).some(shot => shot.matchCut !== undefined)) errors.push('matchCut declarations require editingMode=match-cut-beat-relay (remove declarations to disable)');
    return errors;
  }
  const spec = plan?.matchCut;
  if (!isRecord(spec)) return [...errors, 'match-cut-beat-relay requires storyboard.matchCut'];
  if (spec.schemaVersion !== 1) errors.push('matchCut.schemaVersion must be 1');
  if (!nonempty(spec.meaning)) errors.push('matchCut.meaning must explain the narrative benefit, not only a shape rhyme');
  const shots = sortedShots(plan);
  const shotIds = new Set(shots.map(shot => shot.id));
  if (!nonempty(spec.heroShotId) || !shotIds.has(spec.heroShotId)) errors.push('matchCut.heroShotId must name an existing payoff shot');
  const music = spec.music;
  if (!isRecord(music) || !['measured', 'composed'].includes(music.kind) || !nonempty(music.path) || !hash(music.sha256) || !finite(music.outputOffsetSeconds)) errors.push('matchCut.music needs kind (measured/composed), path, sha256 and finite outputOffsetSeconds');
  if (project?.audio?.mode === 'silent' && music?.kind === 'measured') errors.push('A silent project cannot claim measured music synchronization; use an explicit composed timing study or standard editing');
  const relays = Array.isArray(spec.relays) ? spec.relays : [];
  if (!relays.length) errors.push('matchCut.relays needs at least one selected adjacent cut');
  const selected = new Set();
  const pairs = new Set();
  for (const [i, relay] of relays.entries()) {
    const label = `matchCut relay ${i + 1}`;
    if (!isRecord(relay)) {errors.push(`${label} must be an object`); continue;}
    const fromIndex = shots.findIndex(shot => shot.id === relay.fromShot);
    const outgoing = shots[fromIndex], incoming = shots[fromIndex + 1];
    const adjacent = fromIndex >= 0 && Boolean(incoming) && incoming.id === relay.toShot && incoming.from === outgoing.to + 1;
    if (!nonempty(relay.fromShot) || !nonempty(relay.toShot) || !adjacent) errors.push(`${label} must connect existing adjacent shots in timeline order`);
    const key = JSON.stringify([relay.fromShot, relay.toShot]);
    if (pairs.has(key)) errors.push(`${label} duplicates a selected cut`);
    pairs.add(key);
    selected.add(relay.fromShot); selected.add(relay.toShot);
    if (!['movement', 'rest'].includes(relay.cut)) errors.push(`${label}.cut must be movement or rest`);
    if (!finite(relay.beat) || relay.beat < 0) errors.push(`${label}.beat must be a nonnegative beat index`);
    if (![relay.reason, relay.soundBridge].every(nonempty)) errors.push(`${label} needs reason and soundBridge (including an intentional no-foley reason)`);
    const tolerance = relay.tolerance;
    if (!isRecord(tolerance) || !['anchor', 'scale', 'speed'].every(k => finite(tolerance[k]) && tolerance[k] >= 0) || tolerance.anchor > Math.SQRT2 || tolerance.scale > 1) errors.push(`${label}.tolerance needs explicit nonnegative anchor (<=sqrt(2)), scale (<=1), speed limits`);
  }
  const validEndpoints = new Map();
  for (const shot of shots) {
    if (!selected.has(shot.id) && shot.matchCut === undefined) continue;
    const label = `Shot ${shot.id} matchCut`;
    const c = shot.matchCut;
    if (!isRecord(c)) {errors.push(`${label} contract missing`); continue;}
    for (const field of ['subject', 'metaphor', 'cause', 'grip', 'startState', 'endState']) if (!nonempty(c[field])) errors.push(`${label}.${field} must be nonempty (use an explained n/a for nonphysical grips)`);
    const window = c.actionWindow;
    if (!isRecord(window) || !frame(window.from) || !frame(window.to) || window.from > window.to || window.from < shot.from || window.to > shot.to) errors.push(`${label}.actionWindow must contain the whole action inside the shot, in global inclusive 1-based frames`);
    for (const edge of ['entry', 'exit']) {
      const e = c[edge];
      const valid = isRecord(e) && Array.isArray(e.anchor) && e.anchor.length === 2 && e.anchor.every(n => finite(n) && n >= 0 && n <= 1) && positive(e.scale) && e.scale <= 1 && directions.includes(e.direction) && finite(e.speed) && e.speed >= 0 && ((e.direction === 'none') === (e.speed === 0));
      if (!valid) errors.push(`${label}.${edge} needs normalized anchor/scale, direction and speed; rest is none/0, movement has positive speed`);
      else validEndpoints.set(`${shot.id}:${edge}`, e);
    }
  }
  for (const [i, relay] of relays.entries()) {
    if (!isRecord(relay)) continue;
    const a = validEndpoints.get(`${relay.fromShot}:exit`), b = validEndpoints.get(`${relay.toShot}:entry`);
    if (!a || !b) continue;
    const label = `matchCut relay ${i + 1}`;
    if (relay.cut === 'movement' && (a.direction === 'none' || a.direction !== b.direction)) errors.push(`${label}: movement cut needs the same non-rest direction; use a rest cut for a reversal`);
    if (relay.cut === 'rest' && (a.direction !== 'none' || b.direction !== 'none')) errors.push(`${label}: rest cut needs both endpoints at rest before reversing`);
    const deltas = {anchor: Math.hypot(a.anchor[0] - b.anchor[0], a.anchor[1] - b.anchor[1]), scale: Math.abs(a.scale - b.scale), speed: Math.abs(a.speed - b.speed)};
    for (const [name, delta] of Object.entries(deltas)) if (finite(relay.tolerance?.[name]) && delta > relay.tolerance[name] + 1e-12) errors.push(`${label}: declared ${name} mismatch ${delta.toFixed(6)} exceeds tolerance ${relay.tolerance[name]}`);
  }
  return errors;
}

/** Explicit synthetic/composed study only, never a fallback for unmeasured music. */
export function createComposedGrid({bpm, beat0Seconds, beatCount}) {
  if (!positive(bpm) || !finite(beat0Seconds) || beat0Seconds < 0 || !Number.isSafeInteger(beatCount) || beatCount < 2 || beatCount > 1000000) throw new Error('Composed grid needs positive bpm, nonnegative beat0Seconds and beatCount in 2..1000000');
  const result = {bpm, beats_s: Array.from({length: beatCount}, (_, i) => beat0Seconds + i * 60 / bpm)};
  validateGrid(result);
  return result;
}

/** Reuse either beat_grid.json or music_features.json.grid as the single timing source. */
export function validateGrid(data, {kind} = {}) {
  const grid = isRecord(data?.grid) ? data.grid : data;
  if (!isRecord(grid) || !positive(grid.bpm) || !Array.isArray(grid.beats_s) || grid.beats_s.length < 2 || grid.beats_s.some((t, i, all) => !finite(t) || t < 0 || (i > 0 && t <= all[i - 1]))) throw new Error('Music grid needs positive bpm and at least two strictly increasing, nonnegative beats_s; no synthetic fallback');
  if (grid.reliable !== undefined && typeof grid.reliable !== 'boolean') throw new Error('Music grid reliable must be boolean when present');
  if (grid.reliable === false) throw new Error('Music grid is explicitly unreliable; use content pacing or an explicitly authorized composed study, not a measured-sync claim');
  // beat_grid.py CLI sets reliable, but audio_features.py embeds analyze() output
  // before that flag is added. Preserve the producer's CONF_MIN=3 convention.
  if (kind === 'measured') {
    const hasConfidence = grid.bpm_confidence !== undefined;
    if ((hasConfidence && (!finite(grid.bpm_confidence) || grid.bpm_confidence < 3)) || (grid.reliable !== true && !(hasConfidence && grid.bpm_confidence >= 3))) throw new Error('Measured music needs reliable:true or native bpm_confidence >= 3; missing/low confidence is not evidence of reliable beats');
  }
  return grid;
}

export function beatToSeconds(data, beat) {
  const grid = validateGrid(data);
  if (!finite(beat) || beat < 0 || beat > grid.beats_s.length - 1) throw new Error('Beat index is outside the supplied grid; extrapolation is not allowed');
  const i = Math.floor(beat);
  return i === beat ? grid.beats_s[i] : grid.beats_s[i] + (grid.beats_s[i + 1] - grid.beats_s[i]) * (beat - i);
}

/** Final conversion only: seconds -> full-film, 1-based frame; Sequence uses frame-1. */
export function beatToFrame(data, beat, fps, outputOffsetSeconds = 0) {
  if (!positive(fps) || !finite(outputOffsetSeconds)) throw new Error('fps must be positive and outputOffsetSeconds finite');
  const time = beatToSeconds(data, beat) + outputOffsetSeconds;
  if (time < 0) throw new Error('Beat plus output offset is before the film start');
  const result = Math.round(time * fps) + 1;
  if (!frame(result)) throw new Error('Beat frame is outside the safe frame range');
  return result;
}

export function compileMatchCut(project, plan, data) {
  const errors = validateEditingMode(project, plan);
  const cuts = [];
  if (!active(project)) return {errors, cuts};
  if (errors.length) return {errors, cuts};
  const spec = plan.matchCut;
  try {validateGrid(data, {kind: spec.music.kind});} catch (error) {return {errors: [error.message], cuts};}
  for (const relay of spec.relays) {
    try {
      const sourceSeconds = beatToSeconds(data, relay.beat);
      const seconds = sourceSeconds + spec.music.outputOffsetSeconds;
      const cutFrame = beatToFrame(data, relay.beat, project.fps, spec.music.outputOffsetSeconds);
      const target = plan.shots.find(shot => shot.id === relay.toShot);
      if (cutFrame !== target.from) errors.push(`Relay ${relay.fromShot}->${relay.toShot}: beat ${relay.beat} resolves to frame ${cutFrame}, but incoming shot starts at ${target.from}`);
      cuts.push({fromShot: relay.fromShot, toShot: relay.toShot, cut: relay.cut, beat: relay.beat, sourceSeconds, seconds, frame: cutFrame, sequenceFrom: cutFrame - 1, quantizationMs: ((cutFrame - 1) / project.fps - seconds) * 1000, soundBridge: relay.soundBridge});
    } catch (error) {errors.push(`Relay ${relay.fromShot}->${relay.toShot}: ${error.message}`);}
  }
  return {errors, cuts};
}

export function checkEditingMode(root, project, plan) {
  const errors = validateEditingMode(project, plan);
  const result = {mode: project?.editingMode ?? 'standard', status: active(project) ? 'needs_review' : 'not_selected', errors, cuts: []};
  if (!active(project) || errors.length) return result;
  try {
    const ref = plan.matchCut.music;
    const file = projectFile(root, ref.path);
    const sourceParts = path.relative(fs.realpathSync(root), file).split(path.sep);
    if (!['script', 'analysis', 'research'].includes(sourceParts[0]) || sourceParts.some(part => /^(?:node_modules|\.venv|\.git|__pycache__|\.cache)$/.test(part)) || path.extname(file).toLowerCase() !== '.json') throw new Error('MatchCut grid must be a source JSON under script/, analysis/ or research/, not an excluded output/cache');
    const before = sha256File(file);
    if (before !== ref.sha256.toLowerCase()) throw new Error(`Stale matchCut music grid hash: ${ref.path}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (sha256File(file) !== before) throw new Error('MatchCut music grid changed while reading');
    const compiled = compileMatchCut(project, plan, data);
    errors.push(...compiled.errors);
    result.cuts = compiled.cuts;
  } catch (error) {errors.push(error.message);}
  return result;
}

/** Consumed by the existing review-pack planner/renderer, never an acceptance result. */
export function matchCutReviewRequest(project, plan, cuts) {
  if (!active(project) || !cuts.length) throw new Error('Select and validate a match-cut plan before creating a review request');
  const selected = new Set(cuts.flatMap(cut => [cut.fromShot, cut.toShot]));
  const shots = sortedShots(plan).filter(shot => selected.has(shot.id));
  const context = Math.max(1, Math.round(project.fps * 0.5));
  return {
    schemaVersion: 1,
    id: 'match-cut-review',
    focus: ['Full-size hand/product geometry, grip, contact, force and occlusion; whole actions, not thumbnails alone.', 'Play each relay at normal speed with sound; compare outgoing last and incoming first frames. These selections are not proof of continuity or synchronization.'],
    preserve: ['Selected visual style and recipe, approved narration, reading holds and unchanged non-relay cuts.'],
    windows: shots.map((shot, i) => ({id: `action-${i + 1}`, shotId: shot.id, ...shot.matchCut.actionWindow, label: `${shot.id}: ${shot.matchCut.subject}`, note: `${shot.matchCut.startState} -> ${shot.matchCut.endState}; ${shot.matchCut.cause}; grip: ${shot.matchCut.grip}`})),
    cues: cuts.map((cut, i) => ({id: `relay-${i + 1}`, frame: cut.frame, beforeFrames: context, afterFrames: context, label: `${cut.fromShot} -> ${cut.toShot}: ${cut.cut}`, note: `Beat ${cut.beat}; ${cut.soundBridge}`})),
    stills: cuts.flatMap((cut, i) => [{id: `out-${i + 1}`, frame: cut.frame - 1, label: 'Outgoing last frame, full-size'}, {id: `in-${i + 1}`, frame: cut.frame, label: 'Incoming first frame, full-size'}]),
  };
}
