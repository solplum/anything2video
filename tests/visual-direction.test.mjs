import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkPlan} from '../scripts/check-plan.mjs';
import {checkVisualDirection, VISUAL_DIRECTION_LIMITS} from '../scripts/visual-direction-lib.mjs';
import {isWithin, sha256File} from '../scripts/runtime-lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-visual-direction-'));
const manifestPath = 'script/visual-direction.json';
const project = {status: 'production', width: 16, height: 16, fps: 2, totalFrames: 2, visualDirection: manifestPath};
const write = (base, relative, value) => {
  const file = path.join(base, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  return file;
};
const read = (base, relative) => JSON.parse(fs.readFileSync(path.join(base, relative), 'utf8'));
const edit = (base, relative, mutation) => {const value = read(base, relative); mutation(value); write(base, relative, value);};
const ffmpeg = args => {
  const result = spawnSync('ffmpeg', ['-v', 'error', ...args], {encoding: 'utf8', windowsHide: true});
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'ffmpeg');
};
// Real tiny media fixtures; their existence says nothing about artistic acceptance.
const mp4 = path.join(sandbox, 'fixture.mp4');
ffmpeg(['-f', 'lavfi', '-i', 'color=c=red:size=16x16:rate=2', '-frames:v', '2', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1', mp4]);
ffmpeg(['-f', 'lavfi', '-i', 'color=c=blue:size=16x16:rate=2', '-frames:v', '2', '-an', '-c:v', 'libvpx-vp9', '-threads', '1', path.join(sandbox, 'fixture.webm')]);
for (const format of ['png', 'jpg']) ffmpeg(['-i', mp4, '-frames:v', '1', '-threads', '1', path.join(sandbox, `fixture.${format}`)]);
const media = Object.fromEntries(['png', 'jpg', 'mp4', 'webm'].map(format => [format, fs.readFileSync(path.join(sandbox, `fixture.${format}`))]));

function fixture({mode = 'compare', status = 'production'} = {}) {
  const base = fs.mkdtempSync(path.join(sandbox, 'project-'));
  write(base, 'project.json', {...project, status});
  write(base, 'script/storyboard.json', {shots: [{id: 'S1', from: 1, to: 2, group: 'G1', component: 'src/Shot.tsx', action: 'build', purpose: 'Test evidence integrity'}]});
  write(base, 'src/Shot.tsx', 'export const Shot = () => null;');
  const candidates = [
    {id: 'editorial', treatment: {composition: 'Asymmetric editorial grid', typography: 'Serif headline with sans labels', palette: 'Warm paper and charcoal', motion: 'Sequential typographic build'}},
    {id: 'spatial', treatment: {composition: 'Depth-led spatial stage', typography: 'Monospaced oversized numerals', palette: 'Cool blue and white', motion: 'Continuous tracking camera'}},
  ].slice(0, mode === 'reuse' ? 1 : 2).map((candidate, index) => ({
    ...candidate,
    evidence: [
      ...['opening', 'middle', 'ending'].map((position, frameIndex) => ({kind: 'keyframe', position, format: frameIndex === 1 ? 'jpg' : 'png'})),
      {kind: 'motion', position: 'middle', format: index === 0 ? 'mp4' : 'webm'},
    ].map(({format, ...evidence}) => {
      const relative = `renders/directions/${candidate.id}-${evidence.position}.${format}`;
      const file = write(base, relative, media[format]);
      return {...evidence, path: relative, sha256: sha256File(file)};
    }),
  }));
  write(base, manifestPath, {schemaVersion: 1, mode, selectedCandidate: 'editorial', rationale: 'The editorial treatment supports measured reading and clear hierarchy.', ...(mode === 'reuse' ? {reuseReason: 'Continue the approved editorial series; these renders check the new content.'} : {}), candidates});
  return base;
}

function rejects(mutation, expected) {
  const base = fixture();
  mutation(base);
  let result;
  assert.doesNotThrow(() => {result = checkPlan(base);});
  assert.equal(result.pass, false, JSON.stringify(result));
  assert.equal(result.visualDirection.status, 'failed');
  assert.ok(result.errors.some(error => expected.test(error)), JSON.stringify(result.errors));
  return result;
}

after(() => {
  const resolved = fs.realpathSync(sandbox);
  assert.ok(isWithin(fs.realpathSync(os.tmpdir()), resolved));
  assert.ok(path.basename(resolved).startsWith('a2v-visual-direction-'));
  fs.rmSync(resolved, {recursive: true, force: true});
});

test('compare validates recorded PNG/JPEG and MP4/WebM evidence without claiming visual acceptance', () => {
  const result = checkPlan(fixture());
  assert.equal(result.pass, true, JSON.stringify(result.errors));
  assert.deepEqual(result.visualDirection.errors, []);
  assert.equal(result.visualDirection.status, 'passed');
  assert.equal(result.visualDirection.scope, 'recorded_evidence_only');
  assert.match(result.visualDirection.note, /does not prove.*visual quality.*viewed/);
  assert.match(result.note, /not visual acceptance/);
});

test('reuse permits one candidate with rationale, reuse reason and rendered regression evidence', () => {
  const base = fixture({mode: 'reuse'});
  assert.equal(checkPlan(base).pass, true);
  edit(base, manifestPath, value => {delete value.reuseReason;});
  assert.ok(checkPlan(base).errors.some(error => /reuseReason/.test(error)));
  edit(base, manifestPath, value => {value.reuseReason = 'Same approved direction'; value.candidates[0].evidence = [];});
  assert.equal(checkPlan(base).pass, false);
});

test('legacy production without visualDirection remains valid and reports not performed', () => {
  const base = fixture();
  edit(base, 'project.json', value => {delete value.visualDirection;});
  fs.unlinkSync(path.join(base, manifestPath));
  const result = checkPlan(base);
  assert.equal(result.pass, true);
  assert.equal(result.visualDirection.status, 'not_performed');
  assert.equal(result.visualDirection.reason, 'not_configured');
});

test('draft can bootstrap with a safe missing or incomplete manifest without claiming selection passed', () => {
  const base = fixture({status: 'draft'});
  fs.unlinkSync(path.join(base, manifestPath));
  for (const value of [undefined, {}, {schemaVersion: 1, mode: 'compare', candidates: []}]) {
    if (value !== undefined) write(base, manifestPath, value);
    const result = checkPlan(base);
    assert.equal(result.pass, true, JSON.stringify(result.errors));
    assert.equal(result.visualDirection.status, 'not_performed');
    assert.equal(result.visualDirection.reason, 'draft');
  }
  edit(base, 'project.json', value => {value.status = 'production';});
  assert.equal(checkPlan(base).pass, false);
});

test('existing malformed draft JSON fails; malformed production JSON returns diagnostics without throwing', () => {
  for (const status of ['draft', 'production']) {
    const base = fixture({status});
    write(base, manifestPath, '{broken');
    assert.doesNotThrow(() => {
      const result = checkPlan(base);
      assert.equal(result.pass, false);
      assert.match(result.errors.join('\n'), /cannot read manifest/);
    });
  }
  for (const value of [null, [], true, 8, 'text', {}, {candidates: [null]}, {candidates: [{id: 'test', evidence: [null]}]}]) {
    const base = fixture();
    write(base, manifestPath, JSON.stringify(value));
    assert.doesNotThrow(() => assert.equal(checkPlan(base).pass, false));
  }
});

test('missing production manifest fails and an omitted status cannot bypass evidence checking', () => {
  rejects(base => fs.unlinkSync(path.join(base, manifestPath)), /cannot read manifest/);
  rejects(base => {
    edit(base, 'project.json', value => {delete value.status;});
    write(base, manifestPath, {});
  }, /schemaVersion/);
});

test('manifest version, mode, rationale and selected candidate are validated', () => {
  for (const [key, value, expected] of [
    ['schemaVersion', 2, /schemaVersion/], ['mode', 'skip', /mode must/], ['rationale', ' ', /rationale/],
    ['selectedCandidate', '', /selectedCandidate/], ['selectedCandidate', 'unknown', /does not name a candidate/],
  ]) rejects(base => edit(base, manifestPath, manifest => {manifest[key] = value;}), expected);
  rejects(base => edit(base, manifestPath, value => {value.candidates.pop();}), /at least two candidates/);
  rejects(base => edit(base, manifestPath, value => {value.mode = 'reuse'; value.reuseReason = 'Reuse';}), /exactly one candidate/);
});

test('candidate IDs and complete bounded treatment descriptions are required', () => {
  for (const id of ['', 'has spaces', 'editorial', 'a'.repeat(65)]) rejects(base => edit(base, manifestPath, value => {value.candidates[1].id = id;}), /missing\/invalid\/duplicate id/);
  for (const field of ['composition', 'typography', 'palette', 'motion']) rejects(base => edit(base, manifestPath, value => {delete value.candidates[0].treatment[field];}), /treatment requires/);
  rejects(base => edit(base, manifestPath, value => {value.candidates[0].treatment.composition = 'x'.repeat(8001);}), /treatment requires/);
});

test('recolor-only and normalized relabeling fail; all four treatment declarations must differ', () => {
  rejects(base => edit(base, manifestPath, value => {
    value.candidates[1].treatment = {...value.candidates[0].treatment, palette: 'Another palette'};
  }), /distinct composition.*recolor-only/);
  for (const field of ['composition', 'typography', 'palette', 'motion']) rejects(base => edit(base, manifestPath, value => {
    value.candidates[1].treatment[field] = `  ${value.candidates[0].treatment[field].toUpperCase().replaceAll(' ', '  ')}  `;
  }), new RegExp(`distinct ${field}`));
});

test('every candidate needs valid opening, middle, ending keyframes and motion', () => {
  for (const index of [0, 1, 2, 3]) rejects(base => edit(base, manifestPath, value => {value.candidates[1].evidence.splice(index, 1);}), /missing valid .*evidence/);
  rejects(base => edit(base, manifestPath, value => {value.candidates[0].evidence[0].position = 'intro';}), /position must/);
  rejects(base => edit(base, manifestPath, value => {value.candidates[0].evidence[0].kind = 'notes';}), /kind must/);
});

test('stale and malformed hashes fail while uppercase SHA256 is accepted', () => {
  rejects(base => fs.appendFileSync(path.join(base, read(base, manifestPath).candidates[0].evidence[0].path), 'changed'), /stale evidence hash/);
  for (const hash of ['', 'x'.repeat(64), null, 5]) rejects(base => edit(base, manifestPath, value => {value.candidates[0].evidence[0].sha256 = hash;}), /requires a full SHA256/);
  const base = fixture();
  edit(base, manifestPath, value => {value.candidates[0].evidence[0].sha256 = value.candidates[0].evidence[0].sha256.toUpperCase();});
  assert.equal(checkPlan(base).pass, true);
});

test('missing, empty, textual and wrong-kind media cannot stand in for renders', () => {
  rejects(base => fs.unlinkSync(path.join(base, read(base, manifestPath).candidates[0].evidence[0].path)), /missing\/invalid\/outside media/);
  for (const body of ['', 'A prose review relabeled as a PNG', '\x89PNG\r\n\x1a\n']) rejects(base => edit(base, manifestPath, value => {
    const evidence = value.candidates[0].evidence[0];
    const file = write(base, evidence.path, body);
    evidence.sha256 = sha256File(file);
  }), /nonempty|signature does not match/);
  rejects(base => edit(base, manifestPath, value => {
    const evidence = value.candidates[0].evidence[3];
    const file = write(base, evidence.path, media.png);
    evidence.sha256 = sha256File(file);
  }), /signature does not match motion/);
});

test('three evidence positions cannot reuse the same file, including path aliases', () => {
  rejects(base => edit(base, manifestPath, value => {
    const evidence = value.candidates[0].evidence;
    evidence[1] = {...evidence[0], position: 'middle', path: evidence[0].path.replace('/directions/', '/directions/../directions/')};
  }), /Duplicate media reference/);
});

test('identical comparison evidence collections fail even with renamed files or reordered evidence', () => {
  rejects(base => edit(base, manifestPath, value => {
    value.candidates[1].evidence = value.candidates[0].evidence.map((evidence, index) => {
      const relative = `renders/renamed-${index}${path.extname(evidence.path)}`;
      write(base, relative, fs.readFileSync(path.join(base, evidence.path)));
      return {...evidence, path: relative};
    }).reverse();
  }), /identical evidence collections/);
  // The valid fixture deliberately shares static frames, but has a different motion clip.
  assert.equal(checkPlan(fixture()).pass, true);
});

test('relative path types and lexical escapes are rejected even in draft', () => {
  for (const status of ['draft', 'production']) for (const reference of [null, 3, {}, '', '/tmp/direction.json', '../direction.json', 'C:\\direction.json', 'script/not-json.txt', 'script/\0bad.json']) {
    const base = fixture({status});
    edit(base, 'project.json', value => {value.visualDirection = reference;});
    assert.equal(checkPlan(base).pass, false, JSON.stringify({status, reference}));
  }
  rejects(base => edit(base, manifestPath, value => {value.candidates[0].evidence[0].path = '../fixture.png';}), /Outside project/);
});

test('manifest and evidence symlink escapes fail, including missing draft targets', () => {
  for (const status of ['draft', 'production']) {
    const base = fixture({status});
    fs.symlinkSync(sandbox, path.join(base, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    edit(base, 'project.json', value => {value.visualDirection = 'external/not-yet-created.json';});
    assert.match(checkPlan(base).errors.join('\n'), /Outside project/);
  }
  rejects(base => {
    fs.symlinkSync(sandbox, path.join(base, 'external'), process.platform === 'win32' ? 'junction' : 'dir');
    edit(base, manifestPath, value => {value.candidates[0].evidence[0].path = 'external/fixture.png';});
  }, /Missing\/outside file/);
});

test('draft rejects missing manifest beneath a file and dangling manifest symlinks', () => {
  const base = fixture({status: 'draft'});
  write(base, 'blocked', 'A file cannot contain a manifest');
  edit(base, 'project.json', value => {value.visualDirection = 'blocked/direction.json';});
  assert.equal(checkPlan(base).pass, false);
  fs.symlinkSync(path.join(sandbox, 'does-not-exist.json'), path.join(base, 'dangling.json'));
  edit(base, 'project.json', value => {value.visualDirection = 'dangling.json';});
  assert.equal(checkPlan(base).pass, false);
});

test('bounded input sizes reject oversized manifests, candidate lists, evidence and media', () => {
  rejects(base => write(base, manifestPath, ' '.repeat(VISUAL_DIRECTION_LIMITS.manifestBytes + 1)), /Manifest exceeds/);
  rejects(base => edit(base, manifestPath, value => {value.candidates = Array(VISUAL_DIRECTION_LIMITS.candidates + 1).fill(value.candidates[0]);}), /candidates must contain/);
  rejects(base => edit(base, manifestPath, value => {value.candidates[0].evidence = Array(VISUAL_DIRECTION_LIMITS.evidencePerCandidate + 1).fill(value.candidates[0].evidence[0]);}), /evidence must contain/);
  rejects(base => fs.truncateSync(path.join(base, read(base, manifestPath).candidates[0].evidence[0].path), VISUAL_DIRECTION_LIMITS.mediaBytes + 1), /at most 256 MiB/);
});

test('CLI reports failed visual direction evidence with exit code 1', () => {
  const base = fixture();
  edit(base, manifestPath, value => {value.selectedCandidate = 'missing';});
  const command = spawnSync(process.execPath, [path.join(repo, 'scripts/check-plan.mjs'), base], {encoding: 'utf8'});
  assert.equal(command.status, 1);
  assert.equal(JSON.parse(command.stdout).visualDirection.status, 'failed');
});

test('standalone helper handles missing or malformed project objects', () => {
  for (const value of [null, [], false, 1, undefined]) assert.equal(checkVisualDirection(sandbox, value).status, 'not_performed');
  assert.equal(checkVisualDirection('/nonexistent/a2v-project', project).status, 'failed');
});
