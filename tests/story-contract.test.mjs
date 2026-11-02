import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan} from '../scripts/check-plan.mjs';
import {validateStory, storyReviewWindows, checkStoryActionEdit} from '../scripts/story-contract-lib.mjs';
import {planReview, reviewDocuments} from '../scripts/review-pack.mjs';

const cfg = {width: 1280, height: 720, fps: 30, totalFrames: 300};
const shot = {id: 'S1', from: 1, to: 300, group: 'G1', component: 'src/Shot.tsx', purpose: 'Make a visible cause and effect', action: 'Push pot into sunlight'};
const base = () => ({story: {schemaVersion: 1, kind: 'fiction', characters: [{id: 'hero', identity: 'Round hat and blue coat'}], props: [{id: 'pot', identity: 'Terracotta pot with one flower'}]}, shots: [{...shot, story: {actor: 'hero', goal: 'Help flower', obstacle: 'Pot is in shadow', attempt: 'Push pot', outcome: 'Flower opens', before: 'Pot in shadow', after: 'Pot in sun', actions: [{id: 'push', actor: 'hero', prop: 'pot', ownerBefore: 'world', ownerAfter: 'world', phases: {anticipation: [50, 70], contact: [71, 75], support: [76, 130], release: [131, 140], settle: [141, 160]}}]}}], claims: [], assets: []});
const action = plan => plan.shots[0].story.actions[0];

test('optional contract leaves legacy storyboard valid, validates a complete declared causal action', () => {
  assert.deepEqual(validatePlan(cfg, {shots: [shot]}), []);
  assert.deepEqual(validatePlan(cfg, base()), []);
});

test('registry, actor/prop identity, causal change and ownership fail closed', () => {
  for (const mutate of [p => delete p.story, p => {p.story = null;}, p => {p.story.schemaVersion = 2;}, p => {p.story.kind = 'documentry';}, p => {p.story.characters = [];}, p => {p.story.props = null;}, p => {p.story.characters.push({...p.story.characters[0]});}, p => {p.story.characters[0].id = 123;}, p => {action(p).id = 123;}, p => {p.story.characters[0].id = 'world';}, p => {p.story.characters[0].identity = '';}, p => {p.shots[0].story.actor = 'ghost';}, p => {p.shots[0].story.before = p.shots[0].story.after;}, p => {p.shots[0].story.outcome = '';}, p => {action(p).prop = 'unknown';}, p => {action(p).ownerBefore = 'unknown';}, p => {delete action(p).prop;}, p => {action(p).actor = 'unknown';}, p => {p.shots[0].story.actions.push(structuredClone(action(p)));}, p => {p.story.typo = true;}, p => {p.shots[0].story.actions = [];}]) {
    const p = base(); mutate(p); assert.ok(validateStory(p).length, mutate.toString());
  }
});

test('phase ranges are full-film 1-based, inclusive, ordered, bounded and typo checked', () => {
  for (const mutate of [p => {action(p).phases.contact = [0, 75];}, p => {action(p).phases.contact = [71.5, 75];}, p => {action(p).phases.contact = [80, 75];}, p => {action(p).phases.settle = [141, 301];}, p => {action(p).phases.contact = [70, 75];}, p => {delete action(p).phases.support;}, p => {action(p).phases.contcat = [71, 75];}, p => {action(p).phases = [];}, p => {action(p).phases.contact = [71, 75, 77];}]) {
    const p = base(); mutate(p); assert.ok(validateStory(p).length, mutate.toString());
  }
  const p = base(); p.shots[0].from = 301; p.shots[0].to = 600;
  assert.ok(validateStory(p).length, 'shot-local timings cannot masquerade as global frames');
  for (const phase of Object.values(action(p).phases)) {phase[0] += 300; phase[1] += 300;}
  assert.deepEqual(validateStory(p), []);
});

test('adaptation binds documented scenes to existing facts, labels dramatization and uncertainty', () => {
  const p = base(); p.story.kind = 'adaptation';
  assert.ok(validatePlan(cfg, p).length);
  p.story.factualBoundary = 'Only sourced event is factual; dialogue and inner thoughts are not invented.';
  p.shots[0].story.evidence = {kind: 'documented', note: 'This source documents the action, not private motivation.'};
  assert.ok(validatePlan(cfg, p).some(e => /facts/.test(e)));
  p.claims = [{text: 'A supplied source reports the event', source: 'user:fixture-source'}]; p.shots[0].facts = [0];
  assert.deepEqual(validatePlan(cfg, p), []);
  p.shots[0].facts = [1]; assert.ok(validatePlan(cfg, p).some(e => /out of range/.test(e)));
  p.shots[0].facts = []; p.shots[0].story.evidence = {kind: 'dramatized', note: 'Symbolic action only; not a historical reconstruction.'};
  assert.deepEqual(validatePlan(cfg, p), []);
});

test('declared phases feed existing review media windows and exact contact stills with no automatic pass', () => {
  const p = base(), original = structuredClone(p);
  const request = {schemaVersion: 1, id: 'story', automatic: {opening: false, middle: false, ending: false, cuts: false, endpointStills: false}};
  const packet = planReview(cfg, p, request);
  assert.equal(packet.items.filter(i => i.mode === 'preview').length, 5);
  const contact = packet.items.find(i => i.mode === 'preview' && i.selections.some(s => s.phase === 'contact'));
  assert.deepEqual(contact.frames, {from: 56, to: 90});
  assert.deepEqual(contact.selections[0].phaseFrames, [71, 75]);
  assert.ok(packet.items.some(i => i.mode === 'stills' && i.frames.from === 71));
  assert.ok(packet.items.every(i => i.status === 'needs_review'));
  assert.deepEqual(p, original);
  const docs = reviewDocuments({...packet, mediaState: 'not_rendered', items: packet.items.map(i => ({...i, plannedMedia: 'pending.mp4'}))});
  assert.match(docs.checklist, /Hide captions/);
  assert.match(docs.checklist, /ownership/);
  assert.throws(() => planReview(cfg, p, {...request, automatic: false}), /no windows/);
  assert.throws(() => planReview(cfg, p, {...request, automatic: {...request.automatic, storyActions: false}}), /no windows/);
  assert.throws(() => storyReviewWindows(p, -1), /nonnegative/);
});

test('review phase context stays within shot boundaries, not adjacent shots', () => {
  const p = base(); action(p).phases.anticipation = [1, 10]; action(p).phases.settle = [290, 300];
  const windows = storyReviewWindows(p, 15);
  assert.equal(windows[0].from, 1); assert.equal(windows.at(-1).to, 300);
});

test('timing-only edit guard preserves all unrelated storyboard declarations', () => {
  const before = base(), after = structuredClone(before), target = {shotId: 'S1', actionId: 'push'};
  for (const range of Object.values(action(after).phases)) {range[0] += 15; range[1] += 15;}
  assert.equal(checkStoryActionEdit(before, after, target).pass, true);
  assert.equal(checkStoryActionEdit(before, before, target).pass, false);
  assert.equal(checkStoryActionEdit(before, after, {...target, actionId: 'missing'}).pass, false);
  const changed = structuredClone(after); changed.shots[0].story.outcome = 'unrelated rewrite';
  assert.equal(checkStoryActionEdit(before, changed, target).pass, false);
  const invalid = structuredClone(after); action(invalid).phases.contact = [999, 1000];
  assert.equal(checkStoryActionEdit(before, invalid, target).pass, false);
});

test('standalone story APIs reject malformed plans and missing frame bounds without NaN outputs', () => {
  for (const p of [null, {}, {shots: {}}, {shots: [null]}, {...base(), shots: [{...base().shots[0], from: undefined, to: undefined}]}]) {
    assert.ok(validateStory(p).length);
    assert.throws(() => storyReviewWindows(p));
    assert.equal(checkStoryActionEdit(p, base(), {shotId: 'S1', actionId: 'push'}).pass, false);
  }
  for (const id of [true, ['hero'], 123]) {
    const p = base(); p.story.characters[0].id = id; p.shots[0].story.actor = id; action(p).actor = id;
    assert.ok(validateStory(p).length);
  }
});

test('portable review retains identity, ownership and adaptation provenance, escaped and not self-certified', () => {
  const p = base(); p.story.kind = 'adaptation'; p.story.factualBoundary = '<script>not a source</script>';
  p.shots[0].story.evidence = {kind: 'documented', note: 'Only the supplied action is documented'};
  p.claims = [{text: 'Source claim', source: 'user:fixture'}]; p.shots[0].facts = [0];
  const packet = planReview(cfg, p, {schemaVersion: 1, id: 'portable'});
  assert.deepEqual(packet.story, p.story); assert.deepEqual(packet.shots[0].story, p.shots[0].story);
  assert.deepEqual(packet.claims, p.claims);
  const docs = reviewDocuments({...packet, mediaState: 'not_rendered', items: packet.items.map(i => ({...i, plannedMedia: 'pending.mp4'}))});
  assert.match(docs.checklist, /Round hat and blue coat/); assert.match(docs.checklist, /Declared ownership/);
  assert.match(docs.checklist, /user:fixture/); assert.match(docs.checklist, /documented/);
  assert.ok(!docs.checklist.includes('<script>')); assert.match(docs.checklist, /not observed facts/);
  packet.story.characters[0].identity = 'edited'; assert.equal(p.story.characters[0].identity, 'Round hat and blue coat');
});
