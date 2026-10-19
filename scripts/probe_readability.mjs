#!/usr/bin/env node
/**
 * Export mobile-size review frames and audit explicitly declared element geometry.
 * This is not OCR, a motion analyzer, or a certificate of rendered readability.
 *
 * node scripts/probe_readability.mjs film.mp4 --elements elements.json --json
 *
 * Manifest schema v1 (coordinates and font sizes are source-video pixels):
 * {"schemaVersion":1,"width":1920,"height":1080,"elements":[
 *   {"id":"title","type":"text","text":"Title","fontSize":64,
 *    "x":120,"y":120,"width":800,"height":90,"isSubtitle":false},
 *   {"id":"diagram","type":"graphic","x":120,"y":300,"width":800,"height":300}
 * ]}
 * Each entry is a declared visible state or conservative worst-case bound, not
 * evidence that every rendered element/frame was inventoried. Review the actual
 * video for missing elements, contrast, occlusion, reading time and motion.
 * Report schema v2: overall failed or needs_review; individual checks may be
 * passed, failed, not_performed or needs_review. No whole-video pass is issued.
 * Exit codes: 1 failed/invalid, 2 needs_review, 0 help (or future verified pass).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MIN_MOBILE_FONT = 12;
const MAX_SAMPLES = 10000;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function number(value, name, { integer = false, zero = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (zero ? value < 0 : value <= 0) || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${name} must be a finite ${zero ? 'non-negative' : 'positive'}${integer ? ' integer' : ' number'}`);
  }
  return value;
}

function finite(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
}

function checkElement(el, label, fullBounds = false) {
  if (!isObject(el)) throw new Error(`${label} must be an object`);
  const type = el.type ?? (el.text !== undefined || el.fontSize !== undefined ? 'text' : 'graphic');
  if (!['text', 'graphic'].includes(type)) throw new Error(`${label}.type must be text or graphic`);
  finite(el.y, `${label}.y`);
  number(el.height, `${label}.height`);
  if (fullBounds || el.x !== undefined) finite(el.x, `${label}.x`);
  if (fullBounds || el.width !== undefined) number(el.width, `${label}.width`);
  if (el.isSubtitle !== undefined && typeof el.isSubtitle !== 'boolean') throw new Error(`${label}.isSubtitle must be boolean`);
  if (el.isSubtitle && type !== 'text') throw new Error(`${label}: only text may be marked isSubtitle`);
  if (type === 'text') number(el.fontSize, `${label}.fontSize`);
  return type;
}

/** Legacy direct callers may omit x/width/type; supplied dimensions are validated. */
export function auditReadability({
  width = 1920,
  height = 1080,
  mobileWidth = 480,
  safeBottom = 170,
  elements = []
} = {}) {
  number(width, 'width', { integer: true });
  number(height, 'height', { integer: true });
  number(mobileWidth, 'mobileWidth', { integer: true });
  number(safeBottom, 'safeBottom', { zero: true });
  if (safeBottom > height) throw new Error('safeBottom cannot exceed video height');
  if (!Array.isArray(elements)) throw new Error('elements must be an array');
  const scale = mobileWidth / width;
  const safezoneViolations = [];
  const unreadables = [];
  const boundsViolations = [];
  let textElements = 0;
  let fullBoundsElements = 0;

  for (const [index, el] of elements.entries()) {
    const type = checkElement(el, `elements[${index}]`);
    if (el.x !== undefined && el.width !== undefined) fullBoundsElements++;
    const bottom = el.y + el.height;
    const right = el.x !== undefined && el.width !== undefined ? el.x + el.width : null;
    if (el.y < 0 || bottom > height || (el.x !== undefined && el.x < 0) || (right !== null && right > width)) {
      boundsViolations.push({ id: el.id, text: el.text, x: el.x, y: el.y, width: el.width, height: el.height, right, bottom, canvas: { width, height } });
    }
    const horizontallyVisible = el.x === undefined || el.width === undefined || (el.x < width && el.x + el.width > 0);
    const intersectsBand = safeBottom > 0 && horizontallyVisible && el.y < height && bottom > height - safeBottom;
    if (intersectsBand && !el.isSubtitle) {
      safezoneViolations.push({ id: el.id, text: el.text, y: el.y, bottom, limit: height - safeBottom });
    }
    if (type === 'text') {
      textElements++;
      const scaledFontSize = el.fontSize * scale;
      if (scaledFontSize < MIN_MOBILE_FONT) {
        unreadables.push({ id: el.id, text: el.text, fontSize: el.fontSize,
          scaledFontSize,
          recommendedMin: Math.ceil(MIN_MOBILE_FONT / scale) });
      }
    }
  }
  return {
    status: elements.length === 0 ? 'not_performed' : safezoneViolations.length || unreadables.length || boundsViolations.length ? 'failed' : 'passed',
    scope: 'Declared font sizes, viewport bounds and subtitle-band geometry only; not rendered readability',
    width, height, mobileWidth, mobileHeight: Math.round(height * scale), scale, safeBottom,
    elementsAudited: elements.length, textElementsAudited: textElements, fullBoundsElementsAudited: fullBoundsElements,
    fontSizeStatus: textElements === 0 ? 'not_performed' : unreadables.length ? 'failed' : 'passed',
    subtitleBandStatus: elements.length === 0 ? 'not_performed' : safezoneViolations.length ? 'failed' : 'passed',
    boundsStatus: boundsViolations.length ? 'failed' : fullBoundsElements > 0 && fullBoundsElements === elements.length ? 'passed' : 'not_performed',
    safezoneViolations, unreadables, boundsViolations
  };
}

function validateManifest(manifest) {
  if (!isObject(manifest) || manifest.schemaVersion !== 1) throw new Error('Element manifest must be an object with schemaVersion: 1');
  number(manifest.width, 'manifest.width', { integer: true });
  number(manifest.height, 'manifest.height', { integer: true });
  if (!Array.isArray(manifest.elements)) throw new Error('manifest.elements must be an array');
  const ids = new Set();
  for (const [index, el] of manifest.elements.entries()) {
    const label = `manifest.elements[${index}]`;
    const type = checkElement(el, label, true);
    if (typeof el.id !== 'string' || !el.id.trim() || ids.has(el.id)) throw new Error(`${label}.id must be a unique non-empty string`);
    ids.add(el.id);
    if (!['text', 'graphic'].includes(el.type)) throw new Error(`${label}.type is required (text or graphic)`);
    if (type === 'text' && (typeof el.text !== 'string' || !el.text.trim())) throw new Error(`${label}.text must be a non-empty string`);
  }
  return manifest;
}

function regularFile(file, label) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) throw new Error(`${label} must be a non-empty regular file: ${file}`);
}

function processError(proc, tool) {
  if (proc?.error) return `${tool}: ${proc.error.message}`;
  if (proc?.signal) return `${tool} terminated by ${proc.signal}`;
  if (proc?.status !== 0) return `${tool} exited ${proc?.status ?? 'without status'}: ${String(proc?.stderr || '').trim().slice(0, 2000)}`;
  return null;
}

function execute(run, tool, args) {
  try {
    return run(tool, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    return { error, status: null };
  }
}

function positiveMetadata(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readMetadata(stdout) {
  let json;
  try { json = JSON.parse(stdout); } catch { throw new Error('ffprobe returned invalid JSON'); }
  const stream = json?.streams?.[0];
  if (!isObject(stream)) throw new Error('ffprobe returned no video stream');
  const width = positiveMetadata(stream.width);
  const height = positiveMetadata(stream.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error('ffprobe video width/height must be positive integers');
  const streamDuration = positiveMetadata(stream.duration);
  const duration = streamDuration ?? positiveMetadata(json.format?.duration);
  if (duration === null) throw new Error('ffprobe returned no finite positive stream or container duration');
  // A coded-pixel manifest cannot be silently compared with a rotated/anamorphic display.
  const rotations = [stream.tags?.rotate, ...(stream.side_data_list || []).map(item => item.rotation)].filter(value => value !== undefined);
  if (rotations.some(value => !Number.isFinite(Number(value)) || Number(value) % 360 !== 0)) {
    throw new Error('Rotated video is unsupported; normalize its orientation before supplying pixel bounds');
  }
  const sar = stream.sample_aspect_ratio;
  if (sar && sar !== 'N/A' && sar !== '0:1') {
    const parts = String(sar).split(':').map(Number);
    if (parts.length !== 2 || !parts.every(value => Number.isFinite(value) && value > 0) || parts[0] !== parts[1]) {
      throw new Error('Non-square or invalid sample aspect ratio is unsupported; normalize the video before supplying pixel bounds');
    }
  }
  return { width, height, duration, durationSource: streamDuration === null ? 'format.duration' : 'stream.duration' };
}

function emptyReport(videoFile) {
  return {
    schemaVersion: 2,
    video: typeof videoFile === 'string' ? path.basename(videoFile) : null,
    status: 'failed', passed: false,
    dimensions: null, duration: null, mobileStandard: null,
    sampleRateSeconds: null, samplesRequested: 0, samplesGenerated: 0,
    generatedStills: [], sampleFailures: [], outputDirectory: null,
    checks: {
      input: { status: 'not_performed' },
      metadata: { status: 'not_performed' },
      thumbnails: { status: 'not_performed' },
      elementAudit: { status: 'not_performed', reason: 'No element manifest supplied' },
      visualReview: { status: 'not_performed', reason: 'No rendered review has been performed by this tool' },
      ocr: { status: 'not_performed', reason: 'OCR is not implemented' },
      motionAnalysis: { status: 'not_performed', reason: 'Still extraction does not analyze motion or hold duration' }
    },
    errors: [],
    limitations: [
      'Manifest bounds and font sizes are declarations, not measurements of rendered pixels or complete frame coverage.',
      'Declared bounds checks do not detect pixel-level clipping, contrast, occlusion, reading time or overall visual quality.',
      'Inspect generated mobile-size stills and play the actual video; sampling can miss brief defects.'
    ]
  };
}

function fail(report, check, error) {
  const message = error instanceof Error ? error.message : String(error);
  report.checks[check] = { status: 'failed', error: message };
  report.errors.push({ check, message });
  report.status = 'failed';
  return report;
}

/** The optional third argument injects process execution for deterministic tests. */
export function probeReadability(videoFile, options = {}, { run = spawnSync } = {}) {
  const report = emptyReport(videoFile);
  let videoPath, manifest, mobileWidth, sampleRate, safeBottom, outDir;
  try {
    if (typeof videoFile !== 'string' || !videoFile.trim()) throw new Error('A video file path is required');
    if (!isObject(options)) throw new Error('options must be an object');
    videoPath = path.resolve(videoFile);
    regularFile(videoPath, 'Video');
    mobileWidth = number(options.mobileWidth ?? 480, 'mobileWidth', { integer: true });
    sampleRate = number(options.sampleRate ?? 2, 'sampleRate');
    if (options.safeBottom !== undefined) safeBottom = number(options.safeBottom, 'safeBottom', { zero: true });
    if (options.out !== undefined && (typeof options.out !== 'string' || !options.out.trim())) throw new Error('out must be a non-empty directory path');
    outDir = path.resolve(options.out ?? 'qc/readability');
    if (options.elements !== undefined) {
      if (typeof options.elements !== 'string' || !options.elements.trim()) throw new Error('elements must be a manifest file path');
      const manifestPath = path.resolve(options.elements);
      regularFile(manifestPath, 'Element manifest');
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (err) { throw new Error(`Cannot parse element manifest: ${err.message}`); }
      manifest = validateManifest(parsed);
      report.elementManifest = manifestPath;
    }
    report.sampleRateSeconds = sampleRate;
    report.checks.input = { status: 'passed' };
  } catch (error) { return fail(report, 'input', error); }

  const probe = execute(run, 'ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height,duration,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation:format=duration',
    '-of', 'json', videoPath
  ]);
  const probeError = processError(probe, 'ffprobe');
  if (probeError) return fail(report, 'metadata', probeError);
  let meta;
  try { meta = readMetadata(probe.stdout); } catch (error) { return fail(report, 'metadata', error); }
  report.dimensions = { width: meta.width, height: meta.height };
  report.duration = meta.duration;
  report.checks.metadata = { status: 'passed', durationSource: meta.durationSource };
  safeBottom ??= Math.round(meta.height * 170 / 1080);
  report.mobileStandard = {
    displayWidth: mobileWidth,
    recommendedMinFontSizePx: Math.ceil(MIN_MOBILE_FONT * meta.width / mobileWidth),
    effectiveMinFontSize480Px: mobileWidth === 480 ? MIN_MOBILE_FONT : null,
    effectiveMinFontSizePx: MIN_MOBILE_FONT,
    subtitleBandHeightPx: safeBottom
  };
  if (safeBottom > meta.height) return fail(report, 'input', 'safeBottom cannot exceed video height');
  if (manifest && (manifest.width !== meta.width || manifest.height !== meta.height)) {
    return fail(report, 'input', `Element manifest dimensions ${manifest.width}x${manifest.height} do not match video ${meta.width}x${meta.height}`);
  }
  if (manifest) report.checks.elementAudit = auditReadability({ ...meta, mobileWidth, safeBottom, elements: manifest.elements });
  if (report.checks.elementAudit.status === 'failed') report.errors.push({ check: 'elementAudit', message: 'Declared elements fail mobile font sizing, viewport bounds or subtitle-band clearance' });

  const count = Math.ceil(meta.duration / sampleRate);
  if (!Number.isSafeInteger(count) || count > MAX_SAMPLES) return fail(report, 'input', `Sampling would exceed ${MAX_SAMPLES} frames; increase --sample-rate`);
  const sampleTimes = Array.from({ length: count }, (_, index) => index * sampleRate).filter(time => time < meta.duration);
  report.samplesRequested = sampleTimes.length;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    // Fresh paths ensure that an old successful run cannot hide a failed extraction.
    report.outputDirectory = fs.mkdtempSync(path.join(outDir, 'run-'));
  } catch (error) { return fail(report, 'thumbnails', error); }

  for (const [index, time] of sampleTimes.entries()) {
    const file = path.join(report.outputDirectory, `check_${mobileWidth}w_${String(index).padStart(5, '0')}_t${time.toFixed(6)}s.jpg`);
    const proc = execute(run, 'ffmpeg', [
      '-v', 'error', '-nostdin', '-y', '-ss', String(time), '-i', videoPath,
      '-map', '0:v:0', '-frames:v', '1', '-vf', `scale=${mobileWidth}:-2`, '-q:v', '3', file
    ]);
    let error = processError(proc, 'ffmpeg');
    if (!error) {
      try { regularFile(file, 'Extracted still'); } catch (err) { error = err.message; }
    }
    if (error) report.sampleFailures.push({ time, file, error });
    else report.generatedStills.push({ time, file });
  }
  report.samplesGenerated = report.generatedStills.length;
  report.checks.thumbnails = {
    status: report.sampleFailures.length ? 'failed' : 'passed',
    requested: report.samplesRequested, generated: report.samplesGenerated, failed: report.sampleFailures.length,
    scope: 'Extraction only; images have not been visually reviewed'
  };
  if (report.sampleFailures.length) report.errors.push({ check: 'thumbnails', message: `${report.sampleFailures.length} of ${report.samplesRequested} frame extractions failed; see sampleFailures` });
  report.checks.visualReview = report.samplesGenerated
    ? { status: 'needs_review', reason: 'Review the extracted frames at their mobile display size and play the video; this tool cannot perform human visual acceptance' }
    : { status: 'not_performed', reason: 'No review frames were generated' };
  report.status = report.errors.length ? 'failed' : 'needs_review';
  return report;
}

export function parseCliArgs(args) {
  const options = {};
  let videoFile;
  const seen = new Set();
  const valueOptions = { '--out': 'out', '--elements': 'elements', '--sample-rate': 'sampleRate', '--mobile-width': 'mobileWidth', '--safe-bottom': 'safeBottom' };
  let positionalOnly = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!positionalOnly && arg === '--') { positionalOnly = true; continue; }
    if (!positionalOnly && arg.startsWith('-')) {
      if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
      seen.add(arg);
      if (arg === '--json') { options.json = true; continue; }
      if (arg === '--help' || arg === '-h') { options.help = true; continue; }
      const key = valueOptions[arg];
      if (!key) throw new Error(`Unknown option: ${arg}`);
      const value = args[++index];
      if (value === undefined || !value.trim() || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[key] = ['sampleRate', 'mobileWidth', 'safeBottom'].includes(key) ? Number(value) : value;
      if (key === 'sampleRate' || key === 'mobileWidth' || key === 'safeBottom') {
        number(options[key], arg, { integer: key === 'mobileWidth', zero: key === 'safeBottom' });
      }
    } else {
      if (videoFile !== undefined) throw new Error(`Unexpected positional argument: ${arg}`);
      videoFile = arg;
    }
  }
  if (!options.help && !videoFile) throw new Error('A video file path is required');
  return { videoFile, options };
}

function printHelp() {
  console.log(`Usage: node scripts/probe_readability.mjs <video.mp4> [options]
  --elements <json>     Schema v1 element manifest (source-pixel dimensions/bounds)
  --out <dir>           Parent directory for a fresh run folder (default: qc/readability)
  --sample-rate <sec>   Positive interval between samples, starting at 0 (default: 2)
  --mobile-width <px>   Positive integer review width (default: 480)
  --safe-bottom <px>    Reserved bottom band in source pixels (default: height * 170/1080)
  --json               Print report schema v2, including failures
  --help, -h           Show help

Manifest: {"schemaVersion":1,"width":1920,"height":1080,"elements":[
  {"id":"title","type":"text","text":"Title","fontSize":64,
   "x":120,"y":120,"width":800,"height":90,"isSubtitle":false}]}
Use type "graphic" for non-text foreground elements (no fontSize required).
Dimensions must match the video. Bounds are declarations, not OCR measurements.
Square-pixel, unrotated video only; at most ${MAX_SAMPLES} samples per run.
Exit 1: failed/invalid; exit 2: needs_review; exit 0: help.
Successful thumbnails and geometry checks never certify whole-video readability.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let report;
  let json = args.includes('--json');
  try {
    const parsed = parseCliArgs(args);
    if (parsed.options.help) { printHelp(); process.exit(0); }
    json = parsed.options.json;
    report = probeReadability(parsed.videoFile, parsed.options);
  } catch (error) { report = fail(emptyReport(null), 'input', error); }
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Readability probe: ${report.status}`);
    if (report.dimensions) console.log(`  Video: ${report.video} (${report.dimensions.width}x${report.dimensions.height}, ${report.duration}s)`);
    console.log(`  Mobile review stills: ${report.samplesGenerated}/${report.samplesRequested}${report.outputDirectory ? ` in ${report.outputDirectory}` : ''}`);
    console.log(`  Declared element audit: ${report.checks.elementAudit.status}`);
    for (const error of report.errors) console.error(`  ${error.check}: ${error.message}`);
    if (report.status === 'needs_review') console.log('  Visual/playback review required; no OCR or motion-analysis pass was performed.');
  }
  process.exitCode = report.status === 'failed' ? 1 : report.status === 'passed' ? 0 : 2;
}
