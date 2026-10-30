#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createComposedGrid, beatToFrame} from '../../scripts/editing-mode-lib.mjs';
import {resolvedPath, isWithin, sha256File} from '../../scripts/runtime-lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [target, ...args] = process.argv.slice(2);
const values = {fps: 24, bpm: 96, phase: 0.18};
if (!target || args.length % 2 !== 0) throw new Error('Usage: node examples/match-cut-beat-relay/prepare.mjs <new-external-directory> [--fps 24] [--bpm 96] [--phase 0.18]');
for (let i = 0; i < args.length; i += 2) {
  const name = args[i].replace(/^--/, '');
  if (!args[i].startsWith('--') || !Object.hasOwn(values, name)) throw new Error(`Unknown option: ${args[i]}`);
  values[name] = Number(args[i + 1]);
}
const {fps, bpm, phase} = values;
if (!Number.isSafeInteger(fps) || fps < 1 || fps > 120 || !Number.isFinite(bpm) || bpm < 30 || bpm > 240 || !Number.isFinite(phase) || phase < 0 || phase > 2) throw new Error('Study needs integer fps 1..120, BPM 30..240 and first-beat phase 0..2 seconds');
const out = resolvedPath(target);
if (isWithin(repo, out) || isWithin(out, repo)) throw new Error('Choose a non-overlapping output directory outside the repository');
if (fs.existsSync(out)) throw new Error('Refusing an existing output directory');

// This is an explicitly composed timing study. No measured-music inference,
// provider, generation call, or silent 120 BPM fallback is involved.
// At least 2 seconds remain for the dial's reading hold, even at higher BPM.
const beatsPerShot = Math.max(4, Math.ceil(3 * bpm / 60));
const completeGrid = {...createComposedGrid({bpm, beat0Seconds: phase, beatCount: beatsPerShot * 3 + 1}),
  source: 'Original synthetic click-track timing study; not measured music',
};
const cut1 = beatToFrame(completeGrid, beatsPerShot, fps);
const cut2 = beatToFrame(completeGrid, beatsPerShot * 2, fps);
const totalFrames = beatToFrame(completeGrid, beatsPerShot * 3, fps) - 1;
const scale = 0.28;
const speed = 0.25;
const firstDuration = (cut1 - 1) / fps;
// Keep the first seed on canvas, even in slow-tempo/high-phase studies.
const actualSpeed = Math.min(speed, 0.27 / (firstDuration * scale));
const settleSeconds = 0.5;
const settleX = 0.5 + scale * actualSpeed * settleSeconds / 2;
const endpoint = (x, direction = 'none', velocity = 0) => ({anchor: [x, 0.48], scale, direction, speed: velocity});
const physical = (subject, metaphor, cause, startState, endState, from, to, entry, exit) => ({
  subject, metaphor, cause, grip: 'n/a — code-drawn paper symbols, no hand or physical product handling',
  startState, endState, actionWindow: {from, to}, entry, exit,
});

for (const name of ['src', 'script', 'public', 'research', 'qc']) fs.mkdirSync(path.join(out, name), {recursive: true});
const copy = (from, to) => fs.copyFileSync(path.join(repo, from), path.join(out, to));
for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) copy(`template/${name}`, name);
for (const name of ['Root.tsx', 'Scene.tsx']) copy(`examples/match-cut-beat-relay/${name}`, `src/${name}`);
copy('LICENSE', 'LICENSE-anything2video.txt');
// Keep the exact generator as provenance, not as a relocated executable entry.
copy('examples/match-cut-beat-relay/prepare.mjs', 'research/prepare-source.mjs');
const write = (file, data) => fs.writeFileSync(path.join(out, file), JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'src/index.ts'), "import {registerRoot} from 'remotion';\nimport {Root} from './Root';\nregisterRoot(Root);\n");
write('project.json', {schemaVersion: 1, status: 'draft', slug: 'match-cut-study', width: 1280, height: 720, fps, totalFrames, composition: 'MatchCutStudy', recipe: 'promo', editingMode: 'match-cut-beat-relay'});
write('script/beat_grid.json', completeGrid);
write('script/study-motion.json', {scale, speed: actualSpeed, settleSeconds, settleX});

// Original PCM click track: source of the beats and a cheap animatic aid, not
// licensed stock music, natural sound, a soundtrack recommendation or final mix.
const sampleRate = 48000;
const samples = Math.ceil(totalFrames / fps * sampleRate);
const pcm = new Float64Array(samples);
for (const [index, seconds] of completeGrid.beats_s.entries()) {
  const start = Math.round(seconds * sampleRate);
  for (let n = 0; n < Math.round(sampleRate * 0.055) && start + n < samples; n++) {
    const t = n / sampleRate;
    pcm[start + n] += (index % beatsPerShot === 0 ? 0.36 : 0.2) * Math.sin(2 * Math.PI * (index % beatsPerShot === 0 ? 1500 : 1050) * t) * Math.exp(-t * 95);
  }
}
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let n = 0; n < samples; n++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[n])) * 32767), 44 + n * 2);
fs.writeFileSync(path.join(out, 'public/click-study.wav'), wav);

const shots = [
  {id: 'S01', from: 1, to: cut1 - 1, group: 'Study', component: 'src/Scene.tsx', purpose: 'One small beginning; establish the care-routine motif', action: 'A paper seed travels right; its seam identifies it before the circular silhouette becomes sunlight', matchCut: physical('paper seed', 'A small beginning is the reason for the daily care ritual', 'A designed graphic slide, not a claim of real seed propulsion', 'Seed symbol visible left of center', 'Seed motion hands its circular outline to the daylight symbol', 1, cut1 - 1, endpoint(0.5 - firstDuration * scale * actualSpeed, 'right', actualSpeed), endpoint(0.5 - scale * actualSpeed / fps, 'right', actualSpeed))},
  {id: 'S02', from: cut1, to: cut2 - 1, group: 'Study', component: 'src/Scene.tsx', purpose: 'Associate the seed with a recurring day, not a feature claim about any product', action: 'A circular sun receives the same rightward motion, slows to a complete rest and holds', matchCut: physical('paper sun', 'Daylight marks the repeated day in a care routine', 'The graphic relay carries the seed trajectory into a daily symbol', 'Sun is moving right at the seed handoff', 'Sun disc is still and centered for the dial match', cut1, cut2 - 1, endpoint(0.5, 'right', actualSpeed), endpoint(settleX))},
  {id: 'S03', from: cut2, to: totalFrames, group: 'Study', component: 'src/Scene.tsx', purpose: 'Resolve the daily motif into an imagined reminder, leaving the conclusion readable', action: 'The stationary sun becomes a stationary dial; its hand turns clockwise, then rests on the care-time marker', matchCut: physical('paper care-time dial', 'A daily intention becomes a chosen reminder time; this is a fictional concept, not a product capability', 'A designed pointer turn chooses the graphic reminder marker', 'Dial matches the sun at rest before its hand begins moving', 'Hand rests on the chosen care-time dot; conclusion remains readable', cut2, totalFrames, endpoint(settleX), endpoint(settleX))},
];
write('script/storyboard.json', {
  shots, claims: [],
  assets: [{path: 'public/click-study.wav', sha256: sha256File(path.join(out, 'public/click-study.wav')), source: 'local:research/prepare-source.mjs', license: 'MIT — original procedural timing study; LICENSE-anything2video.txt', usage: 'Synthetic click aid for the draft animatic; not a finished music mix', ai: false}],
  matchCut: {
    schemaVersion: 1, meaning: 'Small beginning → repeated day → deliberate care routine. The circular match supports that idea; it is not a chain of unrelated round things.', heroShotId: 'S03',
    music: {kind: 'composed', path: 'script/beat_grid.json', sha256: sha256File(path.join(out, 'script/beat_grid.json')), outputOffsetSeconds: 0},
    relays: [
      {fromShot: 'S01', toShot: 'S02', cut: 'movement', beat: beatsPerShot, reason: 'Carry the beginning into the repeated day without changing the horizontal motion direction', soundBridge: 'The same original click pulse continues across the change of symbol', tolerance: {anchor: 0.02, scale: 0.01, speed: 0.01}},
      {fromShot: 'S02', toShot: 'S03', cut: 'rest', beat: beatsPerShot * 2, reason: 'Settle the translation before changing from a sun to a dial and starting a new clockwise action', soundBridge: 'An accented click identifies the care-time arrival; no artificial foley is claimed', tolerance: {anchor: 0.01, scale: 0.01, speed: 0}},
    ],
  },
});
write('research/beat-sheet.json', {note: 'Synthetic study only. Shared timing truth is script/beat_grid.json, not a measured music analysis.', beats: [{beat: beatsPerShot, event: 'seed-to-sun', shot: 'S02', frame: cut1}, {beat: beatsPerShot * 2, event: 'sun-to-dial', shot: 'S03', frame: cut2}]});
fs.writeFileSync(path.join(out, 'research/creative-brief.md'), '# Match-cut timing study\n\nOriginal fictional paper-symbol animatic; not a branded advertisement or a finished video. Visual treatment and promo recipe are independent of the optional editing mode. No narration, official claims, outside assets or generation services. Text is fixture copy for evaluating the skill, not user-approved production copy. For a real project use the normal script/voice/music approval and final-QC contracts.\n\nNo visual, motion, music-synchronization or listening acceptance is asserted by preparing this example.\n');
console.log(out);
