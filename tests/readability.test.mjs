import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditReadability, parseCliArgs, probeReadability } from '../scripts/probe_readability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(root, 'scripts/probe_readability.mjs');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-readability-'));
after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

function fixture() {
  const dir = fs.mkdtempSync(path.join(sandbox, 'case-'));
  const video = path.join(dir, 'video with spaces.mp4');
  fs.writeFileSync(video, 'Mock video bytes: only injected tools may read this fixture.');
  return { dir, video, out: path.join(dir, 'review') };
}

const goodManifest = () => ({ schemaVersion: 1, width: 1920, height: 1080, elements: [
  { id: 'title', type: 'text', text: 'Test title', fontSize: 48, x: 120, y: 120, width: 800, height: 80 },
  { id: 'diagram', type: 'graphic', x: 120, y: 300, width: 800, height: 300 }
] });
function manifestFile(dir, manifest = goodManifest()) {
  const file = path.join(dir, 'elements.json');
  fs.writeFileSync(file, JSON.stringify(manifest));
  return file;
}

function mockTools({ metadata = { streams: [{ width: 1920, height: 1080, duration: '3' }] }, probeResult, extraction } = {}) {
  const calls = [];
  let extractionIndex = 0;
  return {
    calls,
    run(tool, args) {
      calls.push({ tool, args });
      if (tool === 'ffprobe') return probeResult ?? { status: 0, stdout: JSON.stringify(metadata), stderr: '' };
      assert.equal(tool, 'ffmpeg');
      const result = extraction?.(args, extractionIndex++);
      if (result) return result;
      fs.writeFileSync(args.at(-1), 'Mock non-empty extracted image; not visual evidence.');
      return { status: 0, stdout: '', stderr: '' };
    }
  };
}

function runMock(config = {}, options = {}) {
  const files = fixture();
  const tools = mockTools(config);
  const report = probeReadability(files.video, { out: files.out, ...options }, { run: tools.run });
  return { ...files, ...tools, report };
}

test('legacy audit signature keeps v5 scale and safezone behavior', () => {
  const result = auditReadability({ width: 1080, height: 1920, mobileWidth: 480, safeBottom: 170,
    elements: [{ text: '历史的转折点', fontSize: 52, y: 1450, height: 60 }] });
  assert.equal(result.status, 'passed');
  assert.equal(result.mobileHeight, 853);
  assert.equal(result.unreadables.length, 0);
  assert.equal(result.safezoneViolations.length, 0);
  assert.equal(result.boundsStatus, 'not_performed', 'legacy callers without x/width cannot certify full bounds');
});

test('audit checks source-width-scaled font sizes and does not invent graphic font sizes', () => {
  const result = auditReadability({ elements: [
    { id: 'small', type: 'text', text: 'Small', fontSize: 47.99, y: 0, height: 40 },
    { id: 'threshold', text: 'Just enough', fontSize: 48, y: 0, height: 60 },
    { id: 'graphic', type: 'graphic', y: 50, height: 50 }
  ] });
  assert.equal(result.status, 'failed');
  assert.equal(result.textElementsAudited, 2);
  assert.equal(result.unreadables.length, 1);
  assert.equal(result.unreadables[0].id, 'small');
  assert.equal(result.unreadables[0].recommendedMin, 48);
  assert.ok(result.unreadables[0].scaledFontSize < 12, 'reported measurement must not round up to a passing size');
  const graphicOnly = auditReadability({ elements: [{ type: 'graphic', y: 0, height: 10 }] });
  assert.equal(graphicOnly.status, 'passed');
  assert.equal(graphicOnly.fontSizeStatus, 'not_performed');
});

test('subtitle exemptions only affect the band, not tiny subtitle text', () => {
  const result = auditReadability({ elements: [
    { id: 'boundary', type: 'graphic', y: 900, height: 10 },
    { id: 'incursion', type: 'graphic', y: 900, height: 11 },
    { id: 'subtitle', text: 'Subtitle', fontSize: 16, y: 960, height: 50, isSubtitle: true },
    { id: 'offscreen', type: 'graphic', x: 2000, width: 100, y: 960, height: 50 },
    { id: 'below', type: 'graphic', y: 1080, height: 50 }
  ] });
  assert.deepEqual(result.safezoneViolations.map(item => item.id), ['incursion']);
  assert.deepEqual(result.unreadables.map(item => item.id), ['subtitle']);
  assert.equal(auditReadability({ safeBottom: 0, elements: [{ type: 'graphic', y: 1000, height: 80 }] }).subtitleBandStatus, 'passed');
});

test('viewport overflow is a failed bounds check, including exempt subtitles', () => {
  const result = auditReadability({ elements: [
    { id: 'left', type: 'graphic', x: -1, y: 0, width: 100, height: 100 },
    { id: 'top', type: 'graphic', x: 0, y: -1, width: 100, height: 100 },
    { id: 'right', type: 'graphic', x: 1900, y: 0, width: 30, height: 100 },
    { id: 'subtitle', text: 'Clipped subtitle', fontSize: 48, x: 0, y: 1060, width: 500, height: 40, isSubtitle: true },
    { id: 'edge', type: 'graphic', x: 1820, y: 0, width: 100, height: 100 }
  ] });
  assert.equal(result.status, 'failed');
  assert.equal(result.boundsStatus, 'failed');
  assert.deepEqual(result.boundsViolations.map(item => item.id), ['left', 'top', 'right', 'subtitle']);
  assert.equal(result.safezoneViolations.length, 0);
  assert.equal(result.unreadables.length, 0);
});

test('empty/invalid element data cannot produce a vacuous pass or fabricated fonts/bounds', () => {
  assert.equal(auditReadability().status, 'not_performed');
  for (const options of [
    { width: 0 }, { height: NaN }, { mobileWidth: 0 }, { safeBottom: 2000 },
    { elements: null }, { elements: [null] },
    { elements: [{ text: 'No font', y: 0, height: 10 }] },
    { elements: [{ text: 'No bounds', fontSize: 60 }] },
    { elements: [{ type: 'graphic', y: 0, height: 5, isSubtitle: true }] }
  ]) assert.throws(() => auditReadability(options));
});

test('thumbnail-only success remains needs_review and explicitly skips element, OCR and motion audits', () => {
  const { report } = runMock();
  assert.equal(report.schemaVersion, 2);
  assert.equal(report.status, 'needs_review');
  assert.equal(report.passed, false);
  assert.equal(report.checks.metadata.status, 'passed');
  assert.equal(report.checks.thumbnails.status, 'passed');
  assert.equal(report.checks.elementAudit.status, 'not_performed');
  assert.equal(report.checks.ocr.status, 'not_performed');
  assert.equal(report.checks.motionAnalysis.status, 'not_performed');
  assert.equal(report.checks.visualReview.status, 'needs_review');
  assert.deepEqual(report.generatedStills.map(item => item.time), [0, 2]);
  assert.equal(report.mobileStandard.subtitleBandHeightPx, 170);
});

test('valid manifest reaches auditReadability while overall review remains pending', () => {
  const files = fixture();
  const tools = mockTools();
  const report = probeReadability(files.video, { out: files.out, elements: manifestFile(files.dir) }, { run: tools.run });
  assert.equal(report.checks.elementAudit.status, 'passed');
  assert.equal(report.checks.elementAudit.elementsAudited, 2);
  assert.equal(report.checks.elementAudit.fontSizeStatus, 'passed');
  assert.equal(report.status, 'needs_review');
  assert.equal(report.passed, false);
});

test('manifest tiny text and graphic band incursions are actual failures with evidence frames', () => {
  const files = fixture();
  const manifest = goodManifest();
  manifest.elements[0].fontSize = 20;
  manifest.elements[1].y = 800;
  const tools = mockTools();
  const report = probeReadability(files.video, { out: files.out, elements: manifestFile(files.dir, manifest) }, { run: tools.run });
  assert.equal(report.status, 'failed');
  assert.equal(report.passed, false);
  assert.equal(report.checks.elementAudit.status, 'failed');
  assert.equal(report.checks.elementAudit.unreadables[0].id, 'title');
  assert.equal(report.checks.elementAudit.safezoneViolations[0].id, 'diagram');
  assert.equal(report.samplesGenerated, 2);
  assert.ok(report.errors.some(error => error.check === 'elementAudit'));
});

test('empty manifest has no auditable elements and is not a pass', () => {
  const files = fixture();
  const manifest = { ...goodManifest(), elements: [] };
  const tools = mockTools();
  const report = probeReadability(files.video, { out: files.out, elements: manifestFile(files.dir, manifest) }, { run: tools.run });
  assert.equal(report.checks.elementAudit.status, 'not_performed');
  assert.equal(report.status, 'needs_review');
});

test('invalid manifests fail input before any tools are run', () => {
  const mutations = [
    manifest => { delete manifest.schemaVersion; },
    manifest => { manifest.schemaVersion = 2; },
    manifest => { manifest.width = '1920'; },
    manifest => { manifest.elements = {}; },
    manifest => { delete manifest.elements[0].x; },
    manifest => { delete manifest.elements[0].width; },
    manifest => { delete manifest.elements[0].fontSize; },
    manifest => { manifest.elements[0].fontSize = 0; },
    manifest => { manifest.elements[0].fontSize = '64'; },
    manifest => { delete manifest.elements[0].type; },
    manifest => { manifest.elements[0].text = ''; },
    manifest => { manifest.elements[0].isSubtitle = 'false'; },
    manifest => { manifest.elements[1].id = manifest.elements[0].id; },
    manifest => { manifest.elements[1].isSubtitle = true; }
  ];
  for (const mutate of mutations) {
    const files = fixture();
    const manifest = goodManifest();
    mutate(manifest);
    const tools = mockTools();
    const report = probeReadability(files.video, { out: files.out, elements: manifestFile(files.dir, manifest) }, { run: tools.run });
    assert.equal(report.status, 'failed', JSON.stringify(manifest));
    assert.equal(report.checks.input.status, 'failed');
    assert.equal(tools.calls.length, 0);
  }
});

test('malformed or missing manifest cannot fall back to an empty audit', () => {
  const files = fixture();
  const bad = path.join(files.dir, 'bad.json');
  fs.writeFileSync(bad, '{broken');
  for (const elements of [bad, path.join(files.dir, 'missing.json')]) {
    const tools = mockTools();
    const report = probeReadability(files.video, { elements, out: files.out }, { run: tools.run });
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.input.status, 'failed');
    assert.equal(tools.calls.length, 0);
  }
});

test('manifest resolution mismatch and impossible bottom band fail without extracting frames', () => {
  const files = fixture();
  const manifest = goodManifest();
  manifest.width = 1080;
  for (const options of [{ elements: manifestFile(files.dir, manifest) }, { safeBottom: 1081 }]) {
    const tools = mockTools();
    const report = probeReadability(files.video, { out: files.out, ...options }, { run: tools.run });
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.input.status, 'failed');
    assert.equal(report.checks.metadata.status, 'passed');
    assert.equal(tools.calls.length, 1);
    assert.equal(report.samplesGenerated, 0);
  }
});

test('missing tool, nonzero exit, signal and invalid ffprobe JSON preserve failures without metadata defaults', () => {
  for (const probeResult of [
    { status: null, error: new Error('spawn ffprobe ENOENT') },
    { status: 1, stderr: 'Invalid data found when processing input' },
    { status: null, signal: 'SIGTERM' },
    { status: 0, stdout: 'not json' }
  ]) {
    const { report, calls } = runMock({ probeResult });
    assert.equal(report.status, 'failed');
    assert.equal(report.passed, false);
    assert.equal(report.dimensions, null);
    assert.equal(report.duration, null);
    assert.equal(report.mobileStandard, null);
    assert.equal(report.checks.metadata.status, 'failed');
    assert.equal(report.checks.thumbnails.status, 'not_performed');
    assert.equal(calls.length, 1);
    assert.ok(report.errors[0].message.length > 0);
  }
});

test('ffprobe missing/invalid dimensions, stream or duration are never invented', () => {
  for (const metadata of [
    {}, { streams: [] }, { streams: [{}] },
    { streams: [{ width: 0, height: 1080, duration: '3' }] },
    { streams: [{ width: 1920, height: 1080.5, duration: '3' }] },
    { streams: [{ width: 1920, height: 1080 }] },
    { streams: [{ width: 1920, height: 1080, duration: 'N/A' }] },
    { streams: [{ width: 1920, height: 1080, duration: '10junk' }] },
    { streams: [{ width: 1920, height: 1080, duration: 0 }] },
    { streams: [{ width: 1920, height: 1080, duration: -10 }] }
  ]) {
    const { report, calls } = runMock({ metadata });
    assert.equal(report.status, 'failed', JSON.stringify(metadata));
    assert.equal(report.checks.metadata.status, 'failed');
    assert.equal(calls.length, 1);
  }
});

test('real container duration is an explicit fallback when stream duration is unavailable', () => {
  const { report } = runMock({ metadata: { streams: [{ width: 1080, height: 1920, duration: 'N/A' }], format: { duration: '0.2' } } });
  assert.equal(report.duration, 0.2);
  assert.deepEqual(report.dimensions, { width: 1080, height: 1920 });
  assert.equal(report.checks.metadata.durationSource, 'format.duration');
  assert.equal(report.mobileStandard.recommendedMinFontSizePx, 27);
  assert.equal(report.samplesGenerated, 1);
  assert.equal(report.generatedStills[0].time, 0);
});

test('rotated or anamorphic media is rejected rather than using wrong source-pixel geometry', () => {
  for (const fields of [
    { tags: { rotate: '90' } },
    { side_data_list: [{ rotation: -90 }] },
    { sample_aspect_ratio: '4:3' }
  ]) {
    const { report, calls } = runMock({ metadata: { streams: [{ width: 1920, height: 1080, duration: '3', ...fields }] } });
    assert.equal(report.checks.metadata.status, 'failed');
    assert.equal(calls.length, 1);
  }
});

test('every failed ffmpeg sample remains visible and cannot turn into success', () => {
  for (const result of [
    { status: 1, stderr: 'decoder failed' },
    { status: null, error: new Error('spawn ffmpeg ENOENT') },
    { status: null, signal: 'SIGKILL' },
    { status: 0 } // A successful exit without a file is still a failure.
  ]) {
    const { report } = runMock({ extraction: () => result });
    assert.equal(report.status, 'failed');
    assert.equal(report.passed, false);
    assert.equal(report.samplesGenerated, 0);
    assert.equal(report.sampleFailures.length, 2);
    assert.equal(report.checks.thumbnails.status, 'failed');
    assert.equal(report.checks.visualReview.status, 'not_performed');
  }
});

test('partial ffmpeg failure retains useful frames but fails the run', () => {
  const { report } = runMock({ extraction: (args, index) => index === 1 ? { status: 1, stderr: 'failed second sample' } : null }, { sampleRate: 1 });
  assert.equal(report.status, 'failed');
  assert.equal(report.samplesRequested, 3);
  assert.equal(report.samplesGenerated, 2);
  assert.equal(report.sampleFailures.length, 1);
  assert.equal(report.sampleFailures[0].time, 1);
  assert.deepEqual(report.generatedStills.map(item => item.time), [0, 2]);
  assert.equal(report.checks.visualReview.status, 'needs_review');
});

test('empty outputs and old artifacts cannot masquerade as a successful fresh extraction', () => {
  const files = fixture();
  const firstTools = mockTools();
  const first = probeReadability(files.video, { out: files.out }, { run: firstTools.run });
  const secondTools = mockTools({ extraction: () => ({ status: 0 }) });
  const second = probeReadability(files.video, { out: files.out }, { run: secondTools.run });
  assert.notEqual(second.outputDirectory, first.outputDirectory);
  assert.equal(second.status, 'failed');
  assert.equal(second.samplesGenerated, 0);
  assert.ok(fs.existsSync(first.generatedStills[0].file));
  const empty = runMock({ extraction: args => { fs.writeFileSync(args.at(-1), ''); return { status: 0 }; } }).report;
  assert.equal(empty.status, 'failed');
  assert.equal(empty.samplesGenerated, 0);
});

test('sample intervals, mobile width, safe band and fine-grained unique filenames are honored', () => {
  const { report, calls } = runMock({ metadata: { streams: [{ width: 1920, height: 1080, duration: '0.05' }] } }, { sampleRate: 0.02, mobileWidth: 360, safeBottom: 200 });
  assert.deepEqual(report.generatedStills.map(item => item.time), [0, 0.02, 0.04]);
  assert.equal(new Set(report.generatedStills.map(item => item.file)).size, 3);
  assert.equal(report.mobileStandard.displayWidth, 360);
  assert.equal(report.mobileStandard.recommendedMinFontSizePx, 64);
  assert.equal(report.mobileStandard.subtitleBandHeightPx, 200);
  assert.equal(report.mobileStandard.effectiveMinFontSize480Px, null);
  for (const call of calls.filter(call => call.tool === 'ffmpeg')) {
    assert.equal(call.args[call.args.indexOf('-vf') + 1], 'scale=360:-2');
    assert.equal(call.args[call.args.indexOf('-map') + 1], '0:v:0', 'extract the exact stream audited by ffprobe');
  }
});

test('invalid options, missing video, empty file and directory inputs fail before tool execution', () => {
  const files = fixture();
  for (const options of [
    { sampleRate: 0 }, { sampleRate: -1 }, { sampleRate: NaN }, { sampleRate: Infinity },
    { sampleRate: '2' }, { mobileWidth: 0 }, { mobileWidth: 480.5 }, { safeBottom: -1 }, { out: '' }, { elements: {} }
  ]) {
    const tools = mockTools();
    const report = probeReadability(files.video, options, { run: tools.run });
    assert.equal(report.status, 'failed');
    assert.equal(report.checks.input.status, 'failed');
    assert.equal(tools.calls.length, 0);
  }
  const empty = path.join(files.dir, 'empty.mp4');
  fs.writeFileSync(empty, '');
  for (const video of [undefined, '', files.dir, empty, path.join(files.dir, 'missing.mp4')]) {
    const tools = mockTools();
    assert.equal(probeReadability(video, {}, { run: tools.run }).checks.input.status, 'failed');
    assert.equal(tools.calls.length, 0);
  }
});

test('unbounded sample counts and unusable output directories are explicit failures', () => {
  const tooMany = runMock({}, { sampleRate: 1e-100 });
  assert.equal(tooMany.report.status, 'failed');
  assert.match(tooMany.report.errors[0].message, /exceed 10000/);
  assert.equal(tooMany.calls.length, 1);
  const files = fixture();
  fs.writeFileSync(files.out, 'not a directory');
  const tools = mockTools();
  const report = probeReadability(files.video, { out: files.out }, { run: tools.run });
  assert.equal(report.checks.thumbnails.status, 'failed');
});

test('CLI parsing consumes option values, supports options before video and validates numbers', () => {
  assert.deepEqual(parseCliArgs(['--out', 'my frames', '--sample-rate', '0.25', '--elements', 'manifest.json', '--mobile-width', '360', '--safe-bottom', '0', 'film.mp4', '--json']), {
    videoFile: 'film.mp4', options: { out: 'my frames', sampleRate: 0.25, elements: 'manifest.json', mobileWidth: 360, safeBottom: 0, json: true }
  });
  assert.equal(parseCliArgs(['--', '-filename.mp4']).videoFile, '-filename.mp4');
  for (const args of [
    [], ['--json'], ['film.mp4', '--out'], ['film.mp4', '--elements', '--json'],
    ['film.mp4', '--sample-rate'], ['film.mp4', '--sample-rate', '0'], ['film.mp4', '--sample-rate', '-1'],
    ['film.mp4', '--sample-rate', 'NaN'], ['film.mp4', '--sample-rate', 'Infinity'],
    ['film.mp4', '--mobile-width', '2.5'], ['film.mp4', '--safe-bottom', '-2'],
    ['film.mp4', '--wat'], ['film.mp4', 'extra.png'], ['film.mp4', '--json', '--json']
  ]) assert.throws(() => parseCliArgs(args), undefined, JSON.stringify(args));
});

test('CLI emits machine-readable failed input and genuine ffprobe failure with exit 1', () => {
  for (const args of [['--json', '--sample-rate', '0', 'anything.mp4'], ['--json', '--out'], ['--json', '/does/not/exist.mp4']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'failed');
    assert.equal(report.passed, false);
    assert.equal(report.checks.input.status, 'failed');
  }
  const files = fixture();
  const result = spawnSync(process.execPath, [script, files.video, '--json', '--out', files.out], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.checks.metadata.status, 'failed');
  assert.equal(report.dimensions, null);
  assert.equal(report.duration, null);
});

test('real ffmpeg fixture exercises CLI sampling, manifest checks and needs_review exit 2', () => {
  const files = fixture();
  const generated = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=10', '-t', '0.4', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', files.video], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr || generated.error?.message);
  const manifest = { schemaVersion: 1, width: 320, height: 180, elements: [
    { id: 'declared-label', type: 'text', text: 'Declared only, not rendered', fontSize: 12, x: 20, y: 20, width: 200, height: 20 }
  ] };
  const elements = manifestFile(files.dir, manifest);
  const result = spawnSync(process.execPath, [script, '--out', files.out, files.video, '--json', '--elements', elements, '--sample-rate', '0.1', '--mobile-width', '240', '--safe-bottom', '20'], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr); // 12 * 240 / 320 = 9px, below the real threshold.
  const failed = JSON.parse(result.stdout);
  assert.equal(failed.samplesGenerated, 4);
  assert.equal(failed.checks.elementAudit.status, 'failed');
  manifest.elements[0].fontSize = 16;
  manifestFile(files.dir, manifest);
  const okay = spawnSync(process.execPath, [script, files.video, '--json', '--out', files.out, '--elements', elements, '--sample-rate', '0.1', '--mobile-width', '240', '--safe-bottom', '20'], { encoding: 'utf8' });
  assert.equal(okay.status, 2, okay.stderr);
  const report = JSON.parse(okay.stdout);
  assert.equal(report.status, 'needs_review');
  assert.equal(report.passed, false);
  assert.equal(report.samplesRequested, 4);
  assert.equal(report.samplesGenerated, 4);
  assert.equal(report.checks.elementAudit.status, 'passed');
  assert.equal(report.checks.ocr.status, 'not_performed');
  for (const still of report.generatedStills) {
    const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', still.file], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr);
    assert.equal(JSON.parse(probe.stdout).streams[0].width, 240);
  }
});

test('real multistream extraction follows the probed first video, not ffmpeg automatic stream choice', () => {
  const files = fixture();
  const generated = spawnSync('ffmpeg', [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=blue:size=320x180:rate=10',
    '-f', 'lavfi', '-i', 'color=red:size=640x640:rate=10', '-t', '0.2',
    '-map', '0:v', '-map', '1:v', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', files.video
  ], { encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr || generated.error?.message);
  const report = probeReadability(files.video, { out: files.out, mobileWidth: 320 });
  assert.equal(report.status, 'needs_review', JSON.stringify(report.errors));
  assert.deepEqual(report.dimensions, { width: 320, height: 180 });
  assert.equal(report.samplesGenerated, 1);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', report.generatedStills[0].file], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout).streams[0], { width: 320, height: 180 });
});

test('CLI help documents real flags, review requirement and exits successfully', () => {
  const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const value of ['--elements', '--sample-rate', '--mobile-width', '--safe-bottom', 'needs_review', 'never certify']) assert.ok(result.stdout.includes(value));
});
