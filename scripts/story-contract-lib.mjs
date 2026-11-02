import {isRecord, nonempty} from './runtime-lib.mjs';

export const STORY_PHASES = ['anticipation', 'contact', 'support', 'release', 'settle'];
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Optional, additive declarations. This validates structure, not acting, truth or story quality. */
export function validateStory(plan) {
  if (!isRecord(plan)) return ['Storyboard must be an object'];
  if (!Array.isArray(plan.shots) || plan.shots.some(s => !isRecord(s))) return ['Storyboard shots must be an array of objects'];
  const shots = plan.shots;
  if (plan.story === undefined) return shots.some(s => s.story !== undefined) ? ['Shot story requires a top-level story registry'] : [];
  const errors = [];
  const fields = (value, allowed, label) => {
    if (!isRecord(value)) {errors.push(`${label} must be an object`); return false;}
    for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`Unknown ${label} field: ${key}`);
    return true;
  };
  const story = plan.story;
  if (!fields(story, ['schemaVersion', 'kind', 'characters', 'props', 'factualBoundary'], 'story')) return errors;
  if (story.schemaVersion !== 1) errors.push('story.schemaVersion must be 1');
  if (!['fiction', 'adaptation'].includes(story.kind)) errors.push('story.kind must be fiction or adaptation');
  if (story.kind === 'adaptation' && !nonempty(story.factualBoundary)) errors.push('Adaptation needs story.factualBoundary: distinguish sources, uncertainty and dramatization');
  const registries = {};
  for (const key of ['characters', 'props']) {
    const list = story[key];
    const ids = new Set(); registries[key] = ids;
    if (!Array.isArray(list) || list.length > 100 || (key === 'characters' && !list.length)) {errors.push(`story.${key} must be an array (1–100 characters, 0–100 props)`); continue;}
    for (const item of list) {
      if (!fields(item, ['id', 'identity'], `story.${key} item`)) continue;
      if (typeof item.id !== 'string' || !ID.test(item.id) || ids.has(item.id) || item.id === 'world') errors.push(`Invalid/duplicate/reserved ${key} id: ${item.id}`);
      else ids.add(item.id);
      if (!nonempty(item.identity)) errors.push(`${key} ${item.id} needs stable visual identity`);
    }
  }
  const owner = id => id === 'world' || registries.characters.has(id);
  let count = 0;
  for (const shot of shots) {
    if (shot.story === undefined) continue;
    count++;
    if (!Number.isSafeInteger(shot.from) || !Number.isSafeInteger(shot.to) || shot.from < 1 || shot.to < shot.from) errors.push(`shot ${shot.id} story needs valid full-film frame bounds`);
    const label = `shot ${shot.id} story`;
    const beat = shot.story;
    if (!fields(beat, ['actor', 'goal', 'obstacle', 'attempt', 'outcome', 'before', 'after', 'evidence', 'actions'], label)) continue;
    if (!registries.characters.has(beat.actor)) errors.push(`${label} has unknown actor`);
    for (const key of ['goal', 'obstacle', 'attempt', 'outcome', 'before', 'after']) if (!nonempty(beat[key])) errors.push(`${label} needs ${key}`);
    if (nonempty(beat.before) && beat.before === beat.after) errors.push(`${label} must declare an observable state change`);
    if (story.kind === 'adaptation' || beat.evidence !== undefined) {
      if (fields(beat.evidence, ['kind', 'note'], `${label} evidence`)) {
        if (!['documented', 'dramatized'].includes(beat.evidence.kind) || !nonempty(beat.evidence.note)) errors.push(`${label} evidence needs documented/dramatized and an explicit note`);
        if (beat.evidence.kind === 'documented' && (!Array.isArray(shot.facts) || !shot.facts.length)) errors.push(`${label} documented action needs existing shot.facts claim bindings`);
      }
    }
    if (!Array.isArray(beat.actions) || !beat.actions.length || beat.actions.length > 32) {errors.push(`${label} needs 1–32 actions`); continue;}
    const ids = new Set();
    for (const action of beat.actions) {
      if (!fields(action, ['id', 'actor', 'prop', 'ownerBefore', 'ownerAfter', 'phases'], `${label} action`)) continue;
      const a = `${label} action ${action.id}`;
      if (typeof action.id !== 'string' || !ID.test(action.id) || ids.has(action.id)) errors.push(`${a}: invalid/duplicate action id`); else ids.add(action.id);
      if (!registries.characters.has(action.actor)) errors.push(`${a}: unknown actor`);
      if (action.prop !== undefined) {
        if (!registries.props.has(action.prop)) errors.push(`${a}: unknown prop`);
        if (!owner(action.ownerBefore) || !owner(action.ownerAfter)) errors.push(`${a}: prop ownership needs a character id or world before and after`);
      } else if (action.ownerBefore !== undefined || action.ownerAfter !== undefined) errors.push(`${a}: ownership requires a prop`);
      if (!fields(action.phases, STORY_PHASES, `${a} phases`)) continue;
      let end = shot.from - 1;
      for (const phase of STORY_PHASES) {
        const range = action.phases[phase];
        if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] < shot.from || range[1] > shot.to || range[0] > range[1]) {errors.push(`${a} ${phase}: expected a 1-based inclusive range inside shot`); continue;}
        if (range[0] <= end) errors.push(`${a} ${phase}: phases must be ordered and non-overlapping`);
        end = range[1];
      }
    }
  }
  if (!count) errors.push('story registry needs at least one shot.story beat');
  return errors;
}

/** Declared timings, never automatic recognition of contact in the rendered image. */
export function storyReviewWindows(plan, contextFrames = 0) {
  const errors = validateStory(plan);
  if (errors.length) throw new Error(errors.join('; '));
  if (!Number.isSafeInteger(contextFrames) || contextFrames < 0) throw new Error('Story context must be a nonnegative integer');
  return (plan.shots ?? []).flatMap(shot => (shot.story?.actions ?? []).flatMap(action => STORY_PHASES.map(phase => {
    const [from, to] = action.phases[phase];
    return {from: Math.max(shot.from, from - contextFrames), to: Math.min(shot.to, to + contextFrames), selection: {kind: 'story-action', id: `story:${shot.id}:${action.id}:${phase}`, label: `${action.actor} / ${action.id} / ${phase}`, shotId: shot.id, actionId: action.id, actor: action.actor, ...(action.prop ? {prop: action.prop} : {}), phase, phaseFrames: [from, to], note: `Before: ${shot.story.before}; after: ${shot.story.after}. Hide captions; verify the visible action and consequence.`}};
  })));
}

/** Review guard for a declared timing-only revision; not a source/audio/media diff tool. */
export function checkStoryActionEdit(before, after, {shotId, actionId}) {
  const errors = [...validateStory(before), ...validateStory(after)];
  const locate = plan => {
    const shot = Array.isArray(plan?.shots) ? plan.shots.find(s => isRecord(s) && s.id === shotId) : undefined;
    return Array.isArray(shot?.story?.actions) ? shot.story.actions.find(a => isRecord(a) && a.id === actionId) : undefined;
  };
  const a = locate(before), b = locate(after);
  if (!a || !b) return {pass: false, errors: [...errors, 'Unknown target shot/action']};
  if (same(a.phases, b.phases)) errors.push('Target timing did not change');
  const normalized = structuredClone(after);
  locate(normalized).phases = structuredClone(a.phases);
  if (!same(before, normalized)) errors.push('Timing-only edit changed unrelated storyboard fields');
  return {pass: errors.length === 0, errors, note: 'Storyboard timing guard only. Compare source/audio/style hashes and actual adjacent rendered frames separately.'};
}
