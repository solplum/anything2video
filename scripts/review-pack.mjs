#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {validatePlan, checkPlan} from './check-plan.mjs';
import {isRecord, isWithin, projectFile, resolvedPath, snapshotSources, sha256File} from './runtime-lib.mjs';
import {renderBatch} from './render.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const hashJson = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const number = (value, name, min = 0, max = Infinity) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be a finite number in ${min}..${max}`);
  return value;
};
const integer = (value, name, min, max = Number.MAX_SAFE_INTEGER) => {
  number(value, name, min, max);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
};
function keys(value, allowed, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unknown ${label} field: ${unknown.join(', ')}`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 10000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`${label} must be nonempty text (at most 10000 characters)`);
  return value;
}
const rounded = value => Number(value.toFixed(9));
const stamp = seconds => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_{}[\]()#+.!|]/g, '\\$&').replace(/\r?\n/g, ' ');

/** Pure planning: supplied cue frames already use the full-film, 1-based time origin. */
export function planReview(cfg, storyboard, request) {
  const errors = validatePlan(cfg, storyboard);
  if (isRecord(cfg)) for (const field of ['width', 'height', 'fps', 'totalFrames']) integer(cfg[field], `project.${field}`, 1);
  if (errors.length) throw new Error(`Invalid storyboard: ${errors.join('; ')}`);
  keys(request, ['schemaVersion', 'id', 'automatic', 'windows', 'cues', 'stills', 'reviewer', 'focus', 'preserve', 'actionReview'], 'review request');
  if (request.schemaVersion !== 1 || typeof request.id !== 'string' || !ID.test(request.id)) throw new Error('Review request needs schemaVersion 1 and a safe id');
  const defaults = {opening: true, middle: true, ending: true, cuts: true, endpointStills: true, windowSeconds: 3, cutContextSeconds: 0.5};
  const automatic = request.automatic === false
    ? {...defaults, opening: false, middle: false, ending: false, cuts: false, endpointStills: false}
    : {...defaults, ...(request.automatic ?? {})};
  if (request.automatic !== undefined && request.automatic !== false) keys(request.automatic, Object.keys(defaults), 'automatic');
  for (const field of ['opening', 'middle', 'ending', 'cuts', 'endpointStills']) if (typeof automatic[field] !== 'boolean') throw new Error(`automatic.${field} must be boolean`);
  number(automatic.windowSeconds, 'automatic.windowSeconds', 0.001, 30);
  number(automatic.cutContextSeconds, 'automatic.cutContextSeconds', 0.001, 15);
  const actionReview = {enabled: true, ...(request.actionReview ?? {})};
  if (request.actionReview !== undefined) keys(request.actionReview, ['enabled', 'samples', 'interval', 'roi'], 'actionReview');
  if (typeof actionReview.enabled !== 'boolean') throw new Error('actionReview.enabled must be boolean');
  if (actionReview.samples !== undefined && actionReview.interval !== undefined) throw new Error('Choose actionReview.samples or interval, not both');
  if (actionReview.interval !== undefined) number(actionReview.interval, 'actionReview.interval', 0.000001, 30);
  else actionReview.samples = integer(actionReview.samples ?? 8, 'actionReview.samples', 2, 24);
  if (actionReview.roi !== undefined) {
    if (!Array.isArray(actionReview.roi) || actionReview.roi.length !== 4) throw new Error('actionReview.roi must be [x,y,width,height]');
    actionReview.roi.forEach(value => number(value, 'ROI', 0, 1));
    const [x, y, width, height] = actionReview.roi;
    if (width <= 0 || height <= 0 || x + width > 1 || y + height > 1) throw new Error('ROI must have positive size and stay inside the source frame');
  }
  const choices = {};
  if (request.reviewer !== undefined) choices.reviewer = text(request.reviewer, 'reviewer');
  for (const name of ['focus', 'preserve']) {
    if (request[name] !== undefined) {
      if (!Array.isArray(request[name]) || request[name].length > 100) throw new Error(`${name} must be an array of at most 100 notes`);
      choices[name] = request[name].map(value => text(value, name));
    }
  }
  const shots = [...storyboard.shots].sort((a, b) => a.from - b.from);
  const knownShots = new Set(shots.map(shot => shot.id));
  const selectedIds = new Set();
  const windows = new Map();
  const stills = new Map();
  const reason = (kind, item, extras = {}) => ({kind, id: `${kind}:${item.id}`, ...(item.label ? {label: item.label} : {}), ...(item.note ? {note: item.note} : {}), ...(item.shotId ? {shotId: item.shotId} : {}), ...extras});
  const addWindow = (from, to, why) => {
    const key = `${from}-${to}`;
    if (!windows.has(key)) windows.set(key, {id: `w-${key}`, from, to, selections: []});
    windows.get(key).selections.push(why);
  };
  const addStill = (frame, why) => {
    if (!stills.has(frame)) stills.set(frame, {id: `s-${frame}`, frame, selections: []});
    stills.get(frame).selections.push(why);
  };
  const auto = (label, from, to, extras = {}) => addWindow(from, to, {kind: 'automatic', id: `automatic:${label}`, label, ...extras});
  const length = Math.min(cfg.totalFrames, Math.max(1, Math.round(automatic.windowSeconds * cfg.fps)));
  if (automatic.opening) auto('opening', 1, length);
  if (automatic.middle) {const from = Math.floor((cfg.totalFrames - length) / 2) + 1; auto('timeline-middle (not inferred complexity)', from, from + length - 1);}
  if (automatic.ending) auto('ending', cfg.totalFrames - length + 1, cfg.totalFrames);
  const context = Math.max(1, Math.round(automatic.cutContextSeconds * cfg.fps));
  if (automatic.cuts) for (const [index, shot] of shots.entries()) {
    if (index > 0) auto(`cut-${index}`, Math.max(1, shot.from - context), Math.min(cfg.totalFrames, shot.from + context - 1), {cutAtFrame: shot.from, shotIds: [shots[index - 1].id, shot.id]});
  }
  for (const kind of ['windows', 'cues', 'stills']) {
    const items = request[kind] === undefined ? [] : request[kind];
    if (!Array.isArray(items) || items.length > 512) throw new Error(`${kind} must be an array of at most 512 selections`);
    for (const item of items) {
      const allowed = kind === 'windows' ? ['id', 'from', 'to', 'label', 'note', 'shotId'] : kind === 'cues' ? ['id', 'frame', 'beforeFrames', 'afterFrames', 'label', 'note', 'shotId'] : ['id', 'frame', 'label', 'note', 'shotId'];
      keys(item, allowed, kind);
      if (typeof item.id !== 'string' || !ID.test(item.id) || selectedIds.has(item.id.toLowerCase())) throw new Error('Selection ids must be safe and unique, case-insensitively');
      selectedIds.add(item.id.toLowerCase());
      for (const field of ['label', 'note', 'shotId']) if (item[field] !== undefined) text(item[field], field);
      if (item.shotId !== undefined && !knownShots.has(item.shotId)) throw new Error(`Unknown shotId: ${item.shotId}`);
      let from, to;
      if (kind === 'windows') {
        from = integer(item.from, 'window.from', 1, cfg.totalFrames);
        to = integer(item.to, 'window.to', from, cfg.totalFrames);
        addWindow(from, to, reason('window', item));
      } else {
        const frame = integer(item.frame, `${kind}.frame`, 1, cfg.totalFrames);
        if (kind === 'stills') {from = frame; to = frame; addStill(frame, reason('still', item));}
        else {
          const before = integer(item.beforeFrames ?? context, 'cue.beforeFrames', 0, cfg.totalFrames);
          const after = integer(item.afterFrames ?? context, 'cue.afterFrames', 0, cfg.totalFrames);
          from = Math.max(1, frame - before); to = Math.min(cfg.totalFrames, frame + after);
          addWindow(from, to, reason('cue', item, {cueFrame: frame, beforeFrames: before, afterFrames: after}));
        }
      }
      if (item.shotId !== undefined) {
        const shot = shots.find(shot => shot.id === item.shotId);
        if (to < shot.from || from > shot.to) throw new Error(`Selection does not overlap its declared shotId: ${item.id}`);
      }
    }
  }
  const selectedWindows = [...windows.values()].sort((a, b) => a.from - b.from || a.to - b.to);
  if (automatic.endpointStills) for (const window of selectedWindows) {
    addStill(window.from, {kind: 'endpoint', id: `${window.id}:start`, windowId: window.id, label: 'start'});
    addStill(window.to, {kind: 'endpoint', id: `${window.id}:end`, windowId: window.id, label: 'end'});
  }
  const selectedStills = [...stills.values()].sort((a, b) => a.frame - b.frame);
  if (!selectedWindows.length && !selectedStills.length) throw new Error('Review request selects no windows or stills');
  if (selectedWindows.length > 128 || selectedStills.length > 512) throw new Error('Review budget exceeded (128 windows / 512 stills); choose fewer cuts or explicit ranges, never silently sample');
  const format = frame => `F${String(frame).padStart(String(cfg.totalFrames).length, '0')} / ${stamp((frame - 1) / cfg.fps)}`;
  const enrich = (item, from, to) => ({...item, frames: {from, to}, frameLabel: `${format(from)} → ${format(to)} (1-based inclusive)`, time: {sourceStartSeconds: rounded((from - 1) / cfg.fps), sourceEndSeconds: rounded((to - 1) / cfg.fps), previewLocalEndSeconds: rounded((to - from) / cfg.fps), encodedDurationSeconds: rounded((to - from + 1) / cfg.fps)}, shotIds: shots.filter(shot => shot.from <= to && shot.to >= from).map(shot => shot.id), status: 'needs_review'});
  const items = [...selectedWindows.map(item => ({...enrich(item, item.from, item.to), mode: 'preview'})), ...selectedStills.map(item => ({...enrich(item, item.frame, item.frame), mode: 'stills'}))];
  return {
    schemaVersion: 1, id: request.id, status: 'needs_review', kind: 'review-pack',
    dimensions: {width: cfg.width, height: cfg.height, fps: cfg.fps, totalFrames: cfg.totalFrames},
    requestSha256: hashJson(request), automatic, actionReview, reviewerChoices: choices,
    summary: {windows: selectedWindows.length, stills: selectedStills.length, totalPreviewFrames: selectedWindows.reduce((sum, item) => sum + item.to - item.from + 1, 0), totalPreviewSeconds: rounded(selectedWindows.reduce((sum, item) => sum + item.to - item.from + 1, 0) / cfg.fps), overlappingWindows: selectedWindows.some((item, index) => selectedWindows.slice(0, index).some(other => other.to >= item.from)), note: 'Duration counts overlapping windows separately; exact duplicates share media and retain all selections.'},
    items, shots: shots.map(({id, from, to, purpose, action}) => ({id, from, to, purpose, action})),
    renderRequest: {schemaVersion: 1, id: request.id, allowOverlap: true, windows: selectedWindows.map(({id, from, to}) => ({id, from, to})), stills: selectedStills.map(({id, frame}) => ({id, frame}))},
  };
}

export function reviewDocuments(packet) {
  const choiceLines = Object.entries(packet.reviewerChoices).flatMap(([name, value]) => (Array.isArray(value) ? value : [value]).map(note => `- ${name}: ${escape(note)}`));
  const header = [`# Review packet: ${escape(packet.id)}`, '', `**needs_review — ${packet.mediaState === 'not_rendered' ? 'PLAN ONLY: no media rendered or reviewed' : 'preview evidence generated, not reviewed'}**`, '', `Specification: ${packet.dimensions.width}×${packet.dimensions.height} @ ${packet.dimensions.fps} fps (unchanged).`, `Windows: ${packet.summary.windows}; stills: ${packet.summary.stills}; summed preview duration: ${packet.summary.totalPreviewSeconds}s (overlap counted).`, `Source snapshot SHA256: \`${packet.sourceSnapshotSha256}\``, `Request SHA256: \`${packet.requestSha256}\``, '', 'Frame labels are full-film, 1-based inclusive. Source seconds and preview-local seconds start at their own first frame. A preview decoded index i maps to source frame from+i; its last frame is at (to-from)/fps, not the encoded duration.', '', 'Opening / timeline-middle / ending / cut windows are deterministic coverage samples, not detection of complex actions. Explicit actions/cues come from caller-authored timing. Still images and numerical checks do not establish motion or sound quality.', '', ...choiceLines, ''];
  const table = ['| Item / source start → end | Shots | Selection | Media |', '|---|---|---|---|'];
  const check = [...header, '## Review checklist (unchecked; no automatic pass)', '', '- [ ] Play every selected preview at original speed with its available audio; log actual observations, defects, intentional holds, reviewer and tool.', '- [ ] Inspect boundary and endpoint stills for readability, contact/occlusion and continuity; stills alone cannot establish movement.', '- [ ] Preserve intentional static reading/emotional holds and the caller’s preserve choices; no minimum-motion quota.', '- [ ] Recheck source and media hashes after edits. New evidence does not inherit old passed/reviewed judgments.', '- [ ] Separately watch the complete current film and listen to its entire soundtrack, then use the existing final QC contract. This packet is neither final delivery nor full-film acceptance.', ''];
  for (const item of packet.items) {
    const selection = item.selections.map(why => why.label ?? why.id).join('; ');
    const media = item.media ? `[${item.mode === 'preview' ? 'Preview' : 'Still'} ${escape(item.id)}](${encodeURI(item.media)})` : `not_rendered (planned ${escape(item.plannedMedia)})`;
    table.push(`| ${escape(item.id)}: ${escape(item.frameLabel)} | ${item.shotIds.map(escape).join(', ')} | ${escape(selection)} | ${media} |`);
    check.push(`### ${escape(item.id)} — ${escape(item.frameLabel)}`, '', `- Status: needs_review; playback: not_performed; ${media}`, `- Shots: ${item.shotIds.map(escape).join(', ')}. Selection: ${escape(selection)}.`);
    for (const why of item.selections) if (why.note) check.push(`- Caller note: ${escape(why.note)}`);
    for (const shot of packet.shots.filter(shot => item.shotIds.includes(shot.id))) check.push(`- ${escape(shot.id)} purpose: ${escape(shot.purpose)}; action: ${escape(shot.action)}; component SHA256: \`${shot.componentSha256}\`.`);
    if (item.mode === 'preview') {
      check.push(`- Preview-local first/last frame: 0s → ${item.time.previewLocalEndSeconds}s. Source frame = ${item.frames.from} + decoded index.`);
      if (item.frames.from === item.frames.to) check.push('- Action strip: not_performed; one frame cannot meet the two-distinct-frame minimum. Choose a longer window for motion review.');
      else if (item.actionReview?.generation === 'generated') check.push(`- Action strips: ${item.actionReview.strips.map(strip => `[${escape(path.basename(strip.path))}](${strip.path})`).join(', ')}; [actual PTS + source-frame mapping](${item.actionReview.report}). Sampling is an overview, not proof of every intervening frame; ROI is fixed and does not track.`);
      else check.push(`- Action strip: not_performed — ${escape(item.actionReview?.reason ?? 'Plan only; no media decoded.')}`);
    }
    check.push('- [ ] Record actual observation (do not replace needs_review with an automated pass).', '- Reviewer / method / observed range / defect or intentional hold / next action: ____________________', '');
  }
  return {index: [...header, ...table, '', '[Open checklist](checklist.md). Machine-readable evidence: [review.json](review.json).', ''].join('\n'), checklist: check.join('\n')};
}

function packetFor(plan, storyboard, sources, batch = null, requestFileSha256 = null) {
  const mediaState = batch ? 'rendered' : 'not_rendered';
  const {renderRequest, ...content} = plan;
  const packet = {...content, ...(requestFileSha256 ? {requestFileSha256} : {}), mediaState, visualReview: 'not_performed', audioReview: 'not_performed', sourceSnapshotSha256: hashJson(sources), generatedAt: new Date().toISOString(), limitations: ['Not full-film review or final delivery.', 'No automatic recognition of arbitrary animation semantics.', 'Static holds may be intentional; reviewer choices are preserved.'], shots: plan.shots.map(shot => ({...shot, componentSha256: sources[path.posix.normalize(storyboard.shots.find(source => source.id === shot.id).component.replaceAll('\\', '/'))]})), items: plan.items.map(item => {
    const evidence = batch?.items.find(evidence => evidence.id === item.id);
    const plannedMedia = `${item.id}.${item.mode === 'preview' ? 'mp4' : 'png'}`;
    if (batch && (!evidence || JSON.stringify(evidence.frames) !== JSON.stringify(item.frames))) throw new Error('Batch evidence does not match review plan');
    return {...item, mediaState, actionReview: {generation: 'not_performed', status: 'needs_review', reason: batch ? 'Not explicitly selected action/cue; generic coverage only.' : 'Plan only; no media decoded.'}, visualReview: 'not_performed', audioReview: 'not_performed', ...(evidence ? {media: path.basename(evidence.media), mediaSha256: evidence.mediaSha256, delivery: path.basename(evidence.delivery), deliverySha256: evidence.deliverySha256} : {plannedMedia})};
  })};
  return packet;
}
function actionDependencies(env) {
  const python = spawnSync(env.A2V_PYTHON || 'python3', ['-B', '-c', 'import sys; from PIL import Image; assert sys.version_info >= (3, 11)'], {encoding: 'utf8', timeout: 10000, env});
  if (python.status !== 0) throw new Error('Automatic action strips require Python 3.11+ and Pillow in A2V_PYTHON (default python3); install the existing action_review.py dependencies or use plan mode. No render started.');
  for (const executable of ['ffmpeg', 'ffprobe']) {
    const check = spawnSync(executable, ['-version'], {encoding: 'utf8', timeout: 10000, env});
    if (check.status !== 0) throw new Error(`Automatic action strips require ${executable} on PATH; use plan mode until available. No render started.`);
  }
}

/** Reuse actual rendered clips: no browser/render call and no synthesized frames. */
export function postprocessReviewActions(directory, packet, env = process.env) {
  directory = fs.realpathSync(directory);
  const settings = packet.actionReview;
  const selected = packet.items.filter(item => item.mode === 'preview' && item.selections.some(selection => ['window', 'cue'].includes(selection.kind)));
  for (const item of selected) {
    if (typeof item.id !== 'string' || !ID.test(item.id)) throw new Error('Unsafe action item id');
    const skip = reason => {item.actionReview = {generation: 'not_performed', status: 'needs_review', reason};};
    if (!settings.enabled) {skip('Action strips disabled by caller; review previews in playback.'); continue;}
    if (!item.media) {skip('Plan only; no media decoded.'); continue;}
    if (item.frames.from === item.frames.to) {skip('One frame cannot meet the two-distinct-frame minimum.'); continue;}
    if (path.basename(item.media) !== item.media) throw new Error('Expected packet-local media filename');
    const video = packetFile(directory, item.media);
    if (sha256File(video) !== item.mediaSha256) throw new Error('Preview media changed before action review');
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', video], {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, env});
    if (probe.status !== 0) throw new Error('Action review needs working ffprobe and decodable preview media; no review packet published');
    const pts = JSON.parse(probe.stdout).frames.map(frame => Number(frame.best_effort_timestamp_time));
    if (pts.length !== item.frames.to - item.frames.from + 1 || pts.some((time, index) => !Number.isFinite(time) || (index > 0 && time <= pts[index - 1]))) throw new Error('Preview decoded frames/PTS do not match source-frame mapping');
    const times = pts.map(time => time - pts[0]);
    // Keep each strip within the existing helper's 30s / 24-target limits.
    const maxSpan = settings.interval === undefined ? 30 : Math.min(30, settings.interval * 22);
    const windows = [];
    let start = 0;
    while (start < times.length - 1) {
      let end = start + 1;
      while (end + 1 < times.length && times[end + 1] - times[start] <= maxSpan) end++;
      if (times[end] - times[start] > maxSpan) {windows.length = 13; break;}
      windows.push([times[start], times[end]]); start = end;
      if (windows.length > 12) break;
    }
    if (windows.length > 12) {skip('Action-strip budget exceeded (12 windows, 30s and 24 targets each); choose a shorter explicit action window or coarser interval. No strip was generated.'); continue;}
    const relative = `actions/${item.id}`;
    const out = path.join(directory, relative);
    assertNewDirectory(directory, out);
    try {if (fs.lstatSync(path.dirname(out)).isSymbolicLink()) throw new Error('Unsafe action output parent symlink');} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const args = ['-B', fileURLToPath(new URL('./action_review.py', import.meta.url)), video, ...windows.flatMap(bounds => ['--window', bounds.join(',')]), ...(settings.interval === undefined ? ['--samples', String(settings.samples)] : ['--interval', String(settings.interval)]), ...(settings.roi ? ['--roi', settings.roi.join(',')] : []), '--out', out];
    const run = spawnSync(env.A2V_PYTHON || 'python3', args, {encoding: 'utf8', timeout: 240000, maxBuffer: 1024 * 1024, env});
    if (run.status !== 0) {
      const detail = (run.stderr?.trim().split('\n').at(-1) || run.error?.code || 'unknown decoding error').replaceAll(directory, '<packet>').slice(0, 500);
      throw new Error(`Action strip generation failed (${item.id}): ${detail}. Python 3.11+, Pillow and FFmpeg/ffprobe are required; no review packet published.`);
    }
    const reportFile = path.join(out, 'review.json');
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (report.videoSha256 !== item.mediaSha256 || report.decodedFrameCount !== pts.length || report.status !== 'needs_review' || sha256File(video) !== item.mediaSha256) throw new Error('Action evidence does not match preview media');
    // The standalone helper records its local input path; replace only that locator,
    // preserving original measured PTS and timestamp labels, before hashing the packet.
    report.video = `../../${item.media}`;
    report.sourceRelocation = {locatorBasis: 'relative to this review.json', note: 'Input locator rewritten for atomic packet relocation; measured timestamps, frame/strip hashes and media hash are unchanged.'};
    report.frameMapping = {sourceFrames1BasedInclusive: item.frames, fps: packet.dimensions.fps, sourceSnapshotSha256: packet.sourceSnapshotSha256, formula: 'sourceFrame1Based = previewDecodedIndex0Based + sourceFrames1BasedInclusive.from'};
    for (const window of report.windows) {
      if (sha256File(packetFile(out, window.strip)) !== window.stripSha256) throw new Error('Action strip hash changed during generation');
    }
    for (const window of report.windows) for (const frame of window.frames) {
      frame.sourceFrame1Based = item.frames.from + frame.index;
      frame.sourceTimeSec = rounded((frame.sourceFrame1Based - 1) / packet.dimensions.fps);
    }
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    item.actionReview = {generation: 'generated', status: 'needs_review', report: `${relative}/review.json`, reportSha256: sha256File(reportFile), decodedFrameCount: report.decodedFrameCount, strips: report.windows.map(window => ({path: `${relative}/${window.strip}`, sha256: window.stripSha256}))};
  }
  return packet;
}

function packetFile(directory, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe packet artifact path');
  let file = directory;
  for (const part of relative.split('/')) {
    file = path.join(file, part);
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Unsafe packet artifact symlink');
  }
  if (!isWithin(directory, fs.realpathSync(file)) || !fs.statSync(file).isFile()) throw new Error('Unsafe packet artifact');
  return file;
}
function writePacket(directory, packet, request) {
  const docs = reviewDocuments(packet);
  for (const [name, value] of [['review.json', JSON.stringify(packet, null, 2) + '\n'], ['request.json', JSON.stringify(request, null, 2) + '\n'], ['index.md', docs.index], ['checklist.md', docs.checklist]]) fs.writeFileSync(path.join(directory, name), value, {flag: 'wx'});
  const artifacts = Object.fromEntries(['review.json', 'request.json', 'index.md', 'checklist.md'].map(name => [name, sha256File(packetFile(directory, name))]));
  for (const item of packet.items) if (item.actionReview?.generation === 'generated') {
    artifacts[item.actionReview.report] = item.actionReview.reportSha256;
    for (const strip of item.actionReview.strips) artifacts[strip.path] = strip.sha256;
  }
  return () => {
    for (const [relative, hash] of Object.entries(artifacts)) if (sha256File(packetFile(directory, relative)) !== hash) throw new Error('Review packet artifact changed before publication');
  };
}
function assertNewDirectory(root, directory) {
  if (!isWithin(root, path.resolve(directory)) || path.resolve(directory) === root) throw new Error('Review output escapes project');
  let cursor = root;
  for (const part of path.relative(root, directory).split(path.sep)) {
    cursor = path.join(cursor, part);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error('Unsafe review output parent or destination symlink');
      if (cursor === directory) throw new Error('Review directory already exists; choose a new review id');
      if (!stat.isDirectory()) throw new Error('Review output parent is not a directory');
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}

/** Plan writes only a labeled plan; render uses the shared gated single-bundle batch renderer. */
export async function createReviewPack(root, request, options = {}, env = process.env) {
  keys(options, ['mode', 'onPlan', 'requestFile'], 'review options');
  const mode = options.mode ?? 'plan';
  if (!['plan', 'render'].includes(mode)) throw new Error('Review mode must be plan or render');
  if (options.onPlan !== undefined && typeof options.onPlan !== 'function') throw new Error('onPlan must be a function');
  root = fs.realpathSync(root);
  request = structuredClone(request);
  let requestFileSha256 = null;
  if (options.requestFile !== undefined) {
    const input = fs.readFileSync(projectFile(root, options.requestFile));
    if (hashJson(JSON.parse(input.toString('utf8'))) !== hashJson(request)) throw new Error('Request file differs from the supplied request');
    requestFileSha256 = createHash('sha256').update(input).digest('hex');
  }
  const verifyRequest = () => {
    if (requestFileSha256 && sha256File(projectFile(root, options.requestFile)) !== requestFileSha256) throw new Error('Request file changed during review planning/rendering; use the current request');
  };
  const sources = snapshotSources(root);
  const cfg = JSON.parse(fs.readFileSync(projectFile(root, 'project.json'), 'utf8'));
  const storyboard = JSON.parse(fs.readFileSync(projectFile(root, 'script/storyboard.json'), 'utf8'));
  const plan = planReview(cfg, storyboard, request);
  if (mode === 'plan') {
    const gate = checkPlan(root);
    if (!gate.pass) throw new Error(`Storyboard gate failed: ${gate.errors.join('; ')}`);
  }
  if (hashJson(snapshotSources(root)) !== hashJson(sources)) throw new Error('Sources changed during review planning; create a fresh review plan');
  verifyRequest();
  options.onPlan?.(plan.summary);
  verifyRequest();
  if (mode === 'render') {
    if (plan.actionReview.enabled && plan.items.some(item => item.mode === 'preview' && item.frames.to > item.frames.from && item.selections.some(selection => ['window', 'cue'].includes(selection.kind)))) actionDependencies(env);
    verifyRequest();
    let verifyPacket = () => {};
    const result = await renderBatch(root, plan.renderRequest, env, {verifyInputs: () => {verifyRequest(); verifyPacket();}, finalize: async ({directory, manifest}) => {
      if (hashJson(manifest.sourceHashes) !== hashJson(sources)) throw new Error('Sources changed between review planning and rendering');
      verifyRequest();
      const packet = packetFor(plan, storyboard, sources, manifest, requestFileSha256);
      postprocessReviewActions(directory, packet, env);
      verifyPacket = writePacket(directory, packet, request);
      verifyPacket();
      verifyRequest();
    }});
    return {directory: path.relative(root, result.directory).split(path.sep).join('/'), status: 'needs_review', mediaState: 'rendered', summary: plan.summary};
  }
  const directory = path.join(root, 'qc', 'review-plans', plan.id);
  assertNewDirectory(root, directory);
  fs.mkdirSync(path.dirname(directory), {recursive: true});
  const lock = `${directory}.review.lock`;
  if (!isWithin(root, resolvedPath(lock))) throw new Error('Review lock escapes project');
  const token = randomUUID();
  const handle = fs.openSync(lock, 'wx');
  fs.writeFileSync(handle, JSON.stringify({token, pid: process.pid})); fs.closeSync(handle);
  let staging;
  try {
    assertNewDirectory(root, directory);
    staging = fs.mkdtempSync(path.join(path.dirname(directory), '.review-plan-'));
    const verifyPacket = writePacket(staging, packetFor(plan, storyboard, sources, null, requestFileSha256), request);
    if (hashJson(snapshotSources(root)) !== hashJson(sources)) throw new Error('Sources changed while planning; create a fresh review plan');
    verifyRequest();
    verifyPacket();
    assertNewDirectory(root, directory);
    fs.renameSync(staging, directory); staging = null;
    return {directory: path.relative(root, directory).split(path.sep).join('/'), status: 'needs_review', mediaState: 'not_rendered', summary: plan.summary};
  } finally {
    if (staging) fs.rmSync(staging, {recursive: true, force: true});
    if (JSON.parse(fs.readFileSync(lock, 'utf8')).token !== token) throw new Error('Review lock ownership changed; refusing cleanup');
    fs.unlinkSync(lock);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [root, mode, requestFile, ...extra] = process.argv.slice(2);
    if (!root || !['plan', 'render'].includes(mode) || !requestFile || extra.length) throw new Error('Usage: node review-pack.mjs <project> <plan|render> <project-relative-request.json>');
    const request = JSON.parse(fs.readFileSync(projectFile(root, requestFile), 'utf8'));
    const result = await createReviewPack(root, request, {mode, requestFile, onPlan: summary => console.error(`Review plan: ${summary.windows} windows + ${summary.stills} stills; ${summary.totalPreviewSeconds}s summed preview duration${summary.overlappingWindows ? ' (overlapping windows retained)' : ''}. ${mode === 'plan' ? 'No rendering requested.' : 'Rendering previews only; not final delivery.'}`)});
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
