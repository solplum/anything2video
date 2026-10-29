import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {finalizeOptions, prepareDelivery, assertDeliveryTargets} from '../scripts/finalize_delivery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-finalize-'));
const write = (base, file, value) => {
  const target = path.join(base, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
  return target;
};
const fixture = () => {
  const base = fs.mkdtempSync(path.join(sandbox, 'project-'));
  write(base, 'project.json', {slug: 'film'});
  write(base, 'renders/film_v1.mp4', 'Synthetic test bytes, not rendered media');
  return base;
};
after(() => fs.rmSync(sandbox, {recursive: true, force: true}));

test('delivery CLI accepts documented values and rejects malformed flags and stems', () => {
  assert.deepEqual(finalizeOptions(['/project', 'renders/film_v1.mp4']), {rootArg: '/project', renderArg: 'renders/film_v1.mp4', target: -16, stem: null});
  assert.equal(finalizeOptions(['/project', 'renders/film_v1.mp4', '--stem', '成片-v2', '--lufs', '-18']).target, -18);
  for (const options of [
    ['--unknown'], ['--stem'], ['--lufs'], ['--stem', 'ok', '--stem', 'other'], ['extra'],
    ['--lufs', 'NaN'], ['--lufs', '-41'], ['--lufs', '-4'],
    ...['../outside', '..\\outside', '/outside', 'C:\\outside', 'C:outside', '.', '..', '', ' ', 'leading ', 'nul\0name'].map(stem => ['--stem', stem]),
  ]) assert.throws(() => finalizeOptions(['/project', 'renders/film_v1.mp4', ...options]), JSON.stringify(options));
});

test('delivery preflight contains media and outputs and preserves existing files', () => {
  const base = fixture();
  const prepared = prepareDelivery(base, 'renders/film_v1.mp4');
  assert.equal(prepared.render, path.join(base, 'renders/film_v1.mp4'));
  assert.equal(prepared.targets[0], 'film_v1-master.mp4');
  assert.equal(prepareDelivery(base, prepared.render, '成片').targets[0], '成片-master.mp4');
  const outside = write(sandbox, 'outside.mp4', 'outside');
  assert.throws(() => prepareDelivery(base, outside), /Outside project/);
  assert.throws(() => prepareDelivery(base, 'renders/film_v1.mp4', '../outside'), /filename/);
  const prior = write(base, 'delivery/film_v1-master.mp4', 'prior media');
  assert.throws(() => prepareDelivery(base, 'renders/film_v1.mp4'), /拒绝覆盖/);
  assert.equal(fs.readFileSync(prior, 'utf8'), 'prior media');
});

test('delivery preflight rejects escaping directory links, source links and dangling output links', () => {
  const external = fs.mkdtempSync(path.join(sandbox, 'external-'));
  write(external, 'film.mp4', 'outside');
  const base = fixture();
  fs.symlinkSync(external, path.join(base, 'delivery'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => prepareDelivery(base, 'renders/film_v1.mp4'), /escapes project/);
  fs.symlinkSync(path.join(external, 'film.mp4'), path.join(base, 'renders/linked.mp4'));
  assert.throws(() => prepareDelivery(base, 'renders/linked.mp4'), /outside file/);
  const other = fixture();
  fs.mkdirSync(path.join(other, 'delivery'));
  fs.symlinkSync(path.join(other, 'missing'), path.join(other, 'delivery/film_v1-master.mp4'));
  assert.throws(() => prepareDelivery(other, 'renders/film_v1.mp4'), /symlink/);
  assert.equal(fs.readdirSync(external).length, 1);
});

test('delivery target recheck rejects a file created after preflight', () => {
  const base = fixture();
  const prepared = prepareDelivery(base, 'renders/film_v1.mp4');
  const prior = write(base, 'delivery/film_v1-share.mp4', 'another process output');
  assert.throws(() => assertDeliveryTargets(prepared.root, prepared.outDir, prepared.targets), /拒绝覆盖/);
  assert.equal(fs.readFileSync(prior, 'utf8'), 'another process output');
});

// Fake command fixtures test error handling only, never media quality or playback.
const fakeTools = path.join(sandbox, 'fake-tools');
write(fakeTools, 'ffprobe', `#!${process.execPath}\nconsole.log(JSON.stringify({streams:[{codec_type:'video'},{codec_type:'audio'}],format:{duration:'3'}}));\n`);
write(fakeTools, 'ffmpeg', `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const filter = args[args.indexOf('-af') + 1] || '';
const videoFilter = args[args.indexOf('-vf') + 1] || '';
const input = args[args.indexOf('-i') + 1] || '';
const operation = filter.includes('print_format=json') ? (input.endsWith('-master.mp4') || input.endsWith('-share.mp4') ? 'remeasure' : 'measure') : videoFilter.startsWith('blackdetect=') ? 'black' : videoFilter.startsWith('freezedetect=') ? 'freeze' : 'other';
if (filter.includes('print_format=json')) console.error(JSON.stringify({input_i:'-16',input_tp:'-1.5',input_lra:'2',input_thresh:'-26',offset:'0'}));
if (operation === process.env.A2V_TEST_FAIL) {console.error('synthetic command failure'); process.exit(1);}
const output = args.at(-1);
if (output !== '-') fs.writeFileSync(output, 'Synthetic output fixture; no real encoding');
`);
for (const executable of ['ffprobe', 'ffmpeg']) fs.chmodSync(path.join(fakeTools, executable), 0o755);

test('failed loudness measurement and black/freeze detectors cannot publish a verified report', () => {
  for (const operation of ['measure', 'remeasure', 'black', 'freeze']) {
    const base = fixture();
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/finalize_delivery.mjs'), base, 'renders/film_v1.mp4'], {
      encoding: 'utf8', env: {...process.env, PATH: `${fakeTools}${path.delimiter}${process.env.PATH}`, A2V_TEST_FAIL: operation},
    });
    assert.equal(result.status, 1, `${operation}: ${result.stdout} ${result.stderr}`);
    assert.match(result.stderr, /finalize_delivery:/);
    assert.ok(!fs.existsSync(path.join(base, 'delivery')), operation);
    assert.ok(!fs.readdirSync(base).some(name => name.startsWith('.finalize-')), operation);
  }
});

test('real FFmpeg delivery smoke publishes decodable master/share and measured reports', () => {
  const base = fixture();
  const media = path.join(base, 'renders/film_v1.mp4');
  const generated = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=10:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=3', '-af', 'volume=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ac', '2', '-shortest', media], {encoding: 'utf8'});
  assert.equal(generated.status, 0, generated.stderr);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/finalize_delivery.mjs'), base, 'renders/film_v1.mp4'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(base, 'delivery/film_v1-delivery-report.json'), 'utf8'));
  assert.equal(report.status, 'verified');
  assert.equal(report.loudness_passed, true);
  assert.equal(report.decode, 'passed');
  assert.equal(report.source, 'film_v1.mp4');
  for (const label of ['master', 'share']) {
    assert.ok(Math.abs(report.loudness[label].input_i + 16) <= 0.5);
    assert.ok(report.loudness[label].input_tp <= -1);
    assert.ok(fs.statSync(path.join(base, 'delivery', report.loudness[label].file)).size > 0);
  }
  assert.ok(fs.statSync(path.join(base, 'delivery/film_v1-contact-sheet.png')).size > 0);
  assert.ok(!fs.readdirSync(base).some(name => name.startsWith('.finalize-')));
  const repeated = spawnSync(process.execPath, [path.join(root, 'scripts/finalize_delivery.mjs'), base, 'renders/film_v1.mp4'], {encoding: 'utf8'});
  assert.equal(repeated.status, 1);
  assert.match(repeated.stderr, /拒绝覆盖/);
});
