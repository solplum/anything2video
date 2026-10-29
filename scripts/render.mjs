#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {checkPlan} from './check-plan.mjs';
import {isRecord, isWithin, projectFile, resolvedPath, sha256File, snapshotSources} from './runtime-lib.mjs';

export function renderOptions(cfg, args = [], env = process.env) {
  if (!isRecord(cfg) || ![cfg.width, cfg.height, cfg.fps, cfg.totalFrames].every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid project dimensions / timing');
  if (!/^[A-Za-z0-9_-]+$/.test(cfg.slug ?? '')) throw new Error('Invalid slug');
  const overwrite = args.includes('--overwrite');
  const positionals = args.filter(arg => arg !== '--overwrite');
  if (positionals.some(arg => arg.startsWith('--'))) throw new Error('Unknown render option');
  const [mode = 'video', value, start] = positionals;
  if (!['video', 'preview', 'stills'].includes(mode)) throw new Error('Mode must be video, preview or stills');
  const limit = mode === 'preview' ? 3 : mode === 'stills' ? 2 : 1;
  if (positionals.length > limit) throw new Error('Too many render arguments');
  const version = env.VER || 'v1';
  if (!/^[A-Za-z0-9_-]+$/.test(version)) throw new Error('Invalid version');
  const concurrency = Number(env.A2V_CONCURRENCY ?? 3);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be 1..32');
  let frames = {from: 1, to: cfg.totalFrames};
  let stills = [];
  if (mode === 'preview') {
    const seconds = Number(value ?? 12);
    const from = Number(start ?? 1);
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Preview seconds must be positive');
    if (!Number.isInteger(from) || from < 1 || from > cfg.totalFrames) throw new Error('Preview startFrame must be one-based within the film');
    frames = {from, to: Math.min(cfg.totalFrames, from + Math.max(1, Math.round(seconds * cfg.fps)) - 1)};
  } else if (mode === 'stills') {
    stills = (value ?? '1').split(',').map(Number);
    if (stills.some(n => !Number.isInteger(n) || n < 1 || n > cfg.totalFrames)) throw new Error('Still frames are one-based inclusive');
    if (new Set(stills).size !== stills.length) throw new Error('Duplicate still frames');
    frames = {from: Math.min(...stills), to: Math.max(...stills)};
  }
  return {mode, overwrite, version, concurrency, frames, stills};
}

export function assertOutput(root, file, overwrite) {
  const base = fs.realpathSync(root);
  const parent = path.dirname(file);
  if (!isWithin(base, resolvedPath(file)) || !isWithin(base, resolvedPath(parent))) throw new Error(`Output escapes project: ${file}`);
  try {if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Unsafe output symlink: ${file}`);}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  if (fs.existsSync(file)) {
    if (!isWithin(base, fs.realpathSync(file)) || fs.lstatSync(file).isSymbolicLink() || !fs.statSync(file).isFile()) throw new Error(`Unsafe output: ${file}`);
    if (!overwrite) throw new Error(`Output exists; use --overwrite explicitly: ${file}`);
  }
}

// Inputs and output IDs are intentionally not filenames. No caller-supplied path is
// interpolated into a batch output, and a batch can never overwrite a prior review.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
export function validateBatchRequest(cfg, request) {
  renderOptions(cfg, [], {});
  if (!isRecord(request) || request.schemaVersion !== 1) throw new Error('Batch schemaVersion must be 1');
  if (typeof request.id !== 'string' || !SAFE_ID.test(request.id)) throw new Error('Invalid batch id');
  const keys = ['schemaVersion', 'id', 'windows', 'stills', 'allowOverlap'];
  if (Object.keys(request).some(key => !keys.includes(key))) throw new Error('Unknown batch field');
  if (request.allowOverlap !== undefined && typeof request.allowOverlap !== 'boolean') throw new Error('allowOverlap must be boolean');
  const windows = request.windows === undefined ? [] : request.windows, stills = request.stills === undefined ? [] : request.stills;
  if (!Array.isArray(windows) || !Array.isArray(stills) || !windows.length && !stills.length) throw new Error('Batch needs windows and/or stills arrays, with at least one item');
  const ids = new Set(), frames = new Set();
  const identity = (item, keys) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !SAFE_ID.test(item.id)) throw new Error('Invalid batch item id');
    const id = item.id.toLowerCase();
    if (ids.has(id)) throw new Error(`Duplicate batch item id: ${item.id}`);
    ids.add(id);
    if (Object.keys(item).some(key => !keys.includes(key))) throw new Error(`Unknown batch item field: ${item.id}`);
  };
  const frame = value => Number.isInteger(value) && value >= 1 && value <= cfg.totalFrames;
  const normalizedWindows = windows.map(item => {
    identity(item, ['id', 'from', 'to']);
    if (!frame(item.from) || !frame(item.to) || item.from > item.to) throw new Error(`Invalid inclusive preview range: ${item.id}`);
    return {id: item.id, from: item.from, to: item.to};
  });
  const normalizedStills = stills.map(item => {
    identity(item, ['id', 'frame']);
    if (!frame(item.frame)) throw new Error(`Invalid one-based still frame: ${item.id}`);
    if (frames.has(item.frame)) throw new Error(`Duplicate still frame: ${item.frame}`);
    frames.add(item.frame);
    return {id: item.id, frame: item.frame};
  });
  const sorted = [...normalizedWindows].sort((a, b) => a.from - b.from);
  if (!request.allowOverlap) for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].from <= sorted[index - 1].to) throw new Error('Overlapping preview windows require explicit allowOverlap: true');
  }
  return {schemaVersion: 1, id: request.id, allowOverlap: request.allowOverlap ?? false, windows: normalizedWindows, stills: normalizedStills};
}

function readConfig(root) {
  const bytes = fs.readFileSync(projectFile(root, 'project.json'));
  return {cfg: JSON.parse(bytes.toString('utf8')), cfgHash: createHash('sha256').update(bytes).digest('hex')};
}

function assertSources(root, expected) {
  if (JSON.stringify(snapshotSources(root)) !== JSON.stringify(expected)) throw new Error('Sources changed during rendering; output requires a fresh render');
}

function claimLock(root, output, token) {
  const file = output + '.render.lock';
  if (fs.existsSync(file)) throw new Error(`Render lock exists: ${file}. Inspect its PID; preserve a live render's lock.`);
  assertOutput(root, file, false);
  let handle;
  try {handle = fs.openSync(file, 'wx');}
  catch (error) {if (error.code === 'EEXIST') throw new Error(`Render already owns this output: ${file}`); throw error;}
  try {fs.writeFileSync(handle, JSON.stringify({token, pid: process.pid, startedAt: new Date().toISOString()}));}
  finally {fs.closeSync(handle);}
  return file;
}

function releaseLock(root, file, token) {
  if (fs.lstatSync(file).isSymbolicLink() || !isWithin(root, fs.realpathSync(file)) || JSON.parse(fs.readFileSync(file, 'utf8')).token !== token) throw new Error('Refusing unsafe render-lock cleanup');
  fs.rmSync(file);
}

// One fresh bundle and one browser per invocation, shared only within that invocation.
// Snapshot before the gates and recheck after each stage: edits while validating or
// bundling must not become an apparently validated render of different inputs.
async function withRenderSession(root, cfg, cfgHash, env, produce) {
  const started = performance.now();
  const metrics = {planChecks: 0, typechecks: 0, bundles: 0, browserOpens: 0, compositionSelections: 0, bundleMs: 0, sessionMs: 0};
  let sourceHashes;
  try {sourceHashes = snapshotSources(root);}
  catch (error) {
    const failedPlan = checkPlan(root);
    if (!failedPlan.pass) throw new Error(`Storyboard gate failed:\n${failedPlan.errors.join('\n')}`);
    throw error;
  }
  if (sourceHashes['project.json'] !== cfgHash) throw new Error('Sources changed after project configuration was read; output requires a fresh render');
  const plan = checkPlan(root);
  metrics.planChecks++;
  if (!plan.pass) throw new Error(`Storyboard gate failed:\n${plan.errors.join('\n')}`);
  const req = createRequire(projectFile(root, 'package.json'));
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!fs.existsSync(tsc) || !fs.statSync(tsc).isFile()) throw new Error('Project-local TypeScript is missing; install project dependencies');
  const types = spawnSync(process.execPath, [tsc, '--noEmit'], {cwd: root, encoding: 'utf8'});
  metrics.typechecks++;
  if (types.status !== 0) throw new Error(`TypeScript gate failed:\n${types.stdout || types.stderr || types.error?.message || 'unknown error'}`);
  assertSources(root, sourceHashes);
  const {bundle} = req('@remotion/bundler');
  const {openBrowser, selectComposition, renderMedia, renderStill} = req('@remotion/renderer');
  let bundleDir, browser;
  try {
    bundleDir = fs.mkdtempSync(path.join(root, '.render-bundle-'));
    const bundleStart = performance.now();
    const serveUrl = await bundle({entryPoint: projectFile(root, 'src/index.ts'), rootDir: root, outDir: bundleDir, enableCaching: false});
    metrics.bundleMs = performance.now() - bundleStart;
    metrics.bundles++;
    assertSources(root, sourceHashes);
    const browserExecutable = env.BROWSER_EXECUTABLE || undefined;
    browser = await openBrowser('chrome', {browserExecutable});
    metrics.browserOpens++;
    const shared = {serveUrl, browserExecutable, puppeteerInstance: browser};
    const composition = await selectComposition({...shared, id: cfg.composition ?? 'Video'});
    metrics.compositionSelections++;
    if (composition.width !== cfg.width || composition.height !== cfg.height || composition.fps !== cfg.fps || composition.durationInFrames !== cfg.totalFrames) throw new Error('Composition does not match project.json; refusing misleading delivery');
    assertSources(root, sourceHashes);
    const value = await produce({shared, composition, renderMedia, renderStill, sourceHashes, metrics});
    assertSources(root, sourceHashes);
    return {value, sourceHashes, metrics};
  } finally {
    try {if (browser) await browser.close({silent: true});}
    finally {
      if (bundleDir && fs.existsSync(bundleDir)) {
        const actual = fs.realpathSync(bundleDir);
        if (!isWithin(root, actual) || fs.lstatSync(bundleDir).isSymbolicLink() || !path.basename(actual).startsWith('.render-bundle-')) throw new Error('Refusing unsafe bundle cleanup');
        fs.rmSync(actual, {recursive: true, force: true});
      }
      metrics.sessionMs = performance.now() - started;
    }
  }
}

async function renderItem(root, cfg, job, output, options, session) {
  const {shared, composition, renderMedia, renderStill, sourceHashes} = session;
  assertSources(root, sourceHashes);
  let ffprobe = null;
  if (job.mode === 'stills') {
    // The only one-based -> zero-based conversion for a selected still.
    await renderStill({...shared, composition, output, frame: job.frames.from - 1});
  } else {
    let lastPct = -1;
    // The only one-based -> zero-based conversion for a selected video window.
    await renderMedia({...shared, composition, codec: 'h264', crf: 18, pixelFormat: 'yuv420p', outputLocation: output, concurrency: options.concurrency,
      frameRange: [job.frames.from - 1, job.frames.to - 1], onProgress: ({progress}) => {
        const pct = Math.floor(progress * 100);
        if (pct % 10 === 0 && pct !== lastPct) {console.log(`Render ${pct}%`); lastPct = pct;}
      }});
    const probe = spawnSync('ffprobe', ['-v', 'error', ...(options.verifyOutput ? ['-count_frames'] : []), '-show_streams', '-show_format', '-of', 'json', output], {encoding: 'utf8'});
    if (probe.status !== 0) throw new Error(probe.stderr || probe.error?.message || 'ffprobe failed');
    ffprobe = JSON.parse(probe.stdout);
    const video = ffprobe.streams?.filter(stream => stream.codec_type === 'video');
    const rate = value => {const [num, den = '1'] = String(value).split('/').map(Number); return num / den;};
    if (options.verifyOutput && (video?.length !== 1 || video[0].width !== cfg.width || video[0].height !== cfg.height ||
        rate(video[0].avg_frame_rate) !== cfg.fps || Number(video[0].nb_read_frames) !== job.frames.to - job.frames.from + 1)) {
      throw new Error('Rendered video does not match requested dimensions, fps or frame count');
    }
  }
  assertSources(root, sourceHashes);
  return {schemaVersion: 1, mediaSha256: sha256File(output), sourceHashes, mode: job.mode, frames: job.frames,
    renderedAt: new Date().toISOString(), ffprobe, visualReview: 'not_performed', audioReview: 'not_performed',
    ...(job.mode !== 'video' ? {status: 'needs_review', draft: true} : {})};
}

// Batch parent directories reject even in-project aliases: two lexical review paths
// must not address the same place. Existing files, directories and dangling links fail.
function assertFreshBatchDirectory(root, directory) {
  const relative = path.relative(root, directory);
  if (!isWithin(root, directory) || !relative) throw new Error('Batch directory escapes project');
  let cursor = root;
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error(`Unsafe batch directory symlink: ${cursor}`);
      if (cursor === directory) throw new Error(`Batch output already exists; choose a new id: ${directory}`);
      if (!stat.isDirectory()) throw new Error(`Batch parent is not a directory: ${cursor}`);
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
}

export async function renderBatch(root, request, env = process.env, hooks = {}) {
  root = fs.realpathSync(root);
  const {cfg, cfgHash} = readConfig(root);
  const normalized = validateBatchRequest(cfg, request);
  const options = {...renderOptions(cfg, [], env), verifyOutput: true};
  let inputRequest;
  if (hooks.requestFile !== undefined) {
    const file = projectFile(root, hooks.requestFile);
    const bytes = fs.readFileSync(file);
    const onDisk = validateBatchRequest(cfg, JSON.parse(bytes.toString('utf8')));
    if (JSON.stringify(onDisk) !== JSON.stringify(normalized)) throw new Error('Batch request file does not match supplied request');
    inputRequest = {path: hooks.requestFile, sha256: createHash('sha256').update(bytes).digest('hex')};
  }
  const assertRequest = () => {
    if (inputRequest && sha256File(projectFile(root, inputRequest.path)) !== inputRequest.sha256) throw new Error('Batch request changed during rendering; choose a new id and rerender');
  };
  const directory = path.join(root, 'renders', 'reviews', normalized.id);
  assertFreshBatchDirectory(root, directory);
  fs.mkdirSync(path.dirname(directory), {recursive: true});
  assertFreshBatchDirectory(root, directory);
  const token = randomUUID();
  const lock = claimLock(root, directory, token);
  let staging;
  try {
    assertFreshBatchDirectory(root, directory);
    staging = fs.mkdtempSync(path.join(path.dirname(directory), `.render-${token}-`));
    const jobs = [
      ...normalized.windows.map(item => ({id: item.id, mode: 'preview', frames: {from: item.from, to: item.to}, filename: `${item.id}.mp4`})),
      ...normalized.stills.map(item => ({id: item.id, mode: 'stills', frames: {from: item.frame, to: item.frame}, filename: `${item.id}.png`})),
    ];
    const {value: items, sourceHashes, metrics} = await withRenderSession(root, cfg, cfgHash, env, async session => {
      const items = [];
      for (const job of jobs) {
        const output = path.join(staging, job.filename);
        const evidence = await renderItem(root, cfg, job, output, options, session);
        const sidecar = output + '.delivery.json';
        fs.writeFileSync(sidecar, JSON.stringify(evidence, null, 2) + '\n', {flag: 'wx'});
        const media = path.relative(root, path.join(directory, job.filename)).split(path.sep).join('/');
        items.push({id: job.id, mode: job.mode, media, frames: job.frames, mediaSha256: evidence.mediaSha256,
          delivery: media + '.delivery.json', deliverySha256: sha256File(sidecar)});
      }
      return items;
    });
    const manifest = {schemaVersion: 1, kind: 'batch-preview', status: 'needs_review', draft: true, id: normalized.id,
      createdAt: new Date().toISOString(), dimensions: {width: cfg.width, height: cfg.height, fps: cfg.fps, totalFrames: cfg.totalFrames},
      sourceHashes, request: normalized, ...(inputRequest ? {inputRequest} : {}), items, metrics, visualReview: 'not_performed', audioReview: 'not_performed',
      note: 'Selected draft windows and stills only. Not full-film playback, final QC, or automatic semantic action detection. Source or media changes invalidate review.'};
    const manifestFile = path.join(staging, 'batch.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
    const manifestHash = sha256File(manifestFile);
    if (hooks.finalize) await hooks.finalize({directory: staging, manifest: structuredClone(manifest)});
    assertSources(root, sourceHashes);
    assertRequest();
    assertOutput(root, manifestFile, true);
    if (sha256File(manifestFile) !== manifestHash) throw new Error('Batch manifest changed before publication');
    // Recheck every artifact after a packet hook, before atomic directory publication.
    for (const item of items) {
      const media = path.join(staging, path.basename(item.media));
      assertOutput(root, media, true);
      assertOutput(root, media + '.delivery.json', true);
      if (sha256File(media) !== item.mediaSha256 || sha256File(media + '.delivery.json') !== item.deliverySha256) throw new Error('Batch media/evidence changed before publication');
    }
    // The packet layer may bind an additional request file or resolved cue input.
    // Keep the last verification synchronous: there is no awaited gap to publication.
    const verified = hooks.verifyInputs?.();
    if (verified && typeof verified.then === 'function') {
      // Reject async hooks without leaving a rejected promise unobserved.
      Promise.resolve(verified).catch(() => {});
      throw new Error('verifyInputs must be synchronous');
    }
    assertFreshBatchDirectory(root, directory);
    fs.renameSync(staging, directory);
    staging = undefined;
    return {directory, outputs: items.map(item => path.join(root, item.media)), manifest};
  } finally {
    try {
      if (staging && fs.existsSync(staging)) {
        if (fs.lstatSync(staging).isSymbolicLink() || !isWithin(root, fs.realpathSync(staging)) || !path.basename(staging).startsWith(`.render-${token}-`)) throw new Error('Refusing unsafe batch cleanup');
        fs.rmSync(staging, {recursive: true, force: true});
      }
    } finally {releaseLock(root, lock, token);}
  }
}

export async function renderProject(root, args = [], env = process.env) {
  root = fs.realpathSync(root);
  if (args[0] === 'batch') {
    if (args.length !== 2) throw new Error('Usage: render.mjs <project> batch <project-relative-request.json> (fresh id; no overwrite)');
    return renderBatch(root, JSON.parse(fs.readFileSync(projectFile(root, args[1]), 'utf8')), env, {requestFile: args[1]});
  }
  const {cfg, cfgHash} = readConfig(root);
  const options = renderOptions(cfg, args, env);
  const jobs = options.mode === 'stills'
    ? options.stills.map(frame => ({mode: 'stills', frames: {from: frame, to: frame}, output: path.join(root, 'stills', `frame-${frame}.png`)}))
    : [{mode: options.mode, frames: options.frames, output: path.join(root, 'renders', `${cfg.slug}_${options.mode === 'preview' ? 'preview' : options.version}.mp4`)}];
  const outputs = jobs.map(job => job.output);
  for (const output of outputs) {
    assertOutput(root, output, options.overwrite);
    assertOutput(root, output + '.delivery.json', options.overwrite);
  }
  const locks = [], staged = new Set();
  const token = randomUUID();
  try {
    for (const output of outputs) {
      fs.mkdirSync(path.dirname(output), {recursive: true});
      locks.push(claimLock(root, output, token));
      assertOutput(root, output, options.overwrite);
      assertOutput(root, output + '.delivery.json', options.overwrite);
    }
    await withRenderSession(root, cfg, cfgHash, env, async session => {
      for (const [index, job] of jobs.entries()) {
        const {output} = job;
        const temporary = path.join(path.dirname(output), `.render-${token}-${index}${path.extname(output)}`);
        assertOutput(root, temporary, false);
        staged.add(temporary);
        const evidence = await renderItem(root, cfg, job, temporary, options, session);
        assertOutput(root, output, options.overwrite);
        assertOutput(root, output + '.delivery.json', options.overwrite);
        const sidecar = temporary + '.delivery.json';
        staged.add(sidecar);
        fs.writeFileSync(sidecar, JSON.stringify(evidence, null, 2), {flag: 'wx'});
        fs.renameSync(temporary, output);
        staged.delete(temporary);
        fs.renameSync(sidecar, output + '.delivery.json');
        staged.delete(sidecar);
        console.log(output);
      }
    });
    return outputs;
  } finally {
    for (const file of staged) {
      if (!isWithin(root, path.resolve(file)) || !path.basename(file).startsWith(`.render-${token}-`)) throw new Error('Refusing unsafe staged-file cleanup');
      fs.rmSync(file, {force: true});
    }
    for (const file of locks) releaseLock(root, file, token);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await renderProject(path.resolve(process.argv[2] ?? '.'), process.argv.slice(3));
    if (!Array.isArray(result)) console.log(result.directory);
  }
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
