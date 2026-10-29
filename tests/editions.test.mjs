import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertDisjoint, buildPackage, collectCoreFiles, verifyPackage} from '../scripts/build-editions.mjs';
import {isOptionalSampleMedia, presentOptionalSamples, readPackageManifest} from '../scripts/package-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-unified-'));
  t.after(() => {
    const resolved = fs.realpathSync.native(dir);
    const relative = path.relative(fs.realpathSync.native(os.tmpdir()), resolved);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'cleanup stays within temporary directory');
    fs.rmSync(resolved, {recursive: true, force: true});
  });
  return dir;
};

const write = (rootDir, relative, content) => {
  const file = path.join(rootDir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
};

function fixture(temp) {
  const source = path.join(temp, 'source');
  write(
    source,
    'SKILL.md',
    `---
name: anything2video
description: A shared video skill.
version: "5.0.0"
author: "solplum"
metadata:
  version: "5.0.0"
  descriptions:
    zh-Hans: "测试描述"
  displayNames:
    zh-Hans: "anything2video"
---
`
  );
  write(source, 'LICENSE', 'Fixture license\n');
  write(source, 'assets/audio/ATTRIBUTION.md', 'Audio sources and rights\n');
  write(source, 'LICENSE-THIRDPARTY/MIT-fixture.txt', 'Third-party notice\n');
  write(source, 'README.md', '# anything2video fixture\n\n[Play](samples/sample.mp4)\n');
  write(source, 'docs/adapters.md', 'Installation and verification\n');
  write(source, 'docs/getting-started.md', 'First project and troubleshooting\n');
  write(source, 'docs/package-profiles.md', 'Core/full and optional-sample-videos\n');
  write(source, 'docs/optimization-v3.md', 'Measured v3 results and limitations\n');
  write(source, 'docs/optimization-v3.1.md', 'Six-edition expansion and desktop boundaries\n');
  write(source, 'docs/optimization-v3.6.md', 'huashu absorption record\n');
  write(source, 'docs/optimization-v3.7.md', 'release contract repair record\n');
  write(source, 'docs/style-system-round1.md', 'Style catalog and reuse contract\n');
  write(source, 'gallery/README.md', 'Motion card gallery\n');
  write(source, 'audio-engine/README.md', 'Programmatic score vendor\n');
  write(source, 'recipes/explainer.md', 'A complete recipe\n');
  write(source, 'reference/production-contract.md', 'Shared production contract\n');
  write(source, 'reference/environment-capabilities.md', 'Runtime environment capabilities\n');
  write(source, 'styles/README.md', 'Shared styles\n');
  write(source, 'samples/README.md', 'Visual preview origins and disclosures\n');
  write(source, 'samples/manifest.json', '{"schemaVersion":1,"samples":[{"path":"sample.mp4"}]}');
  write(source, 'samples/sample.mp4', 'Fixture media');
  write(source, 'samples/posters/sample.jpg', 'Fixture poster');
  for (const file of ['index.html', 'all.html']) write(source, `samples/${file}`, '<div class="filters">Search</div><div class="variant" id="sample"><video controls preload="none" src="sample.mp4" poster="posters/sample.jpg" aria-label="Fixture"></video></div>');
  write(source, 'styles/fixture/SPEC.md', '[Preview](../../samples/sample.mp4)\n');
  write(source, 'template/src/config.ts', "export const CONFIG = {slug: 'demo'};\n");
  write(source, 'template/package.json', '{"name":"fixture","private":true}');
  write(source, 'template/node_modules/secret.txt', 'cached dependency');
  write(source, 'template/.verify2_bundle/cached.js', 'cached render');
  write(source, 'template/audio/cache/generated.wav', 'generated audio');
  write(source, 'reference/.cache/private.md', 'cache');
  write(source, 'template/tests/private.test.mjs', 'not distributed');
  write(source, 'reference/.env', 'secret');
  write(source, 'reference/research-worker-report.md', 'transient review');
  write(source, 'examples/private.md', 'not distributed');
  write(source, 'examples/engraving/README.md', 'Redistributable example\n');
  write(source, 'examples/engraving/renders/private.mp4', 'not distributed');
  write(source, 'styles/building-label.md', 'A legitimate style reference');
  for (const file of fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.mjs'))) {
    write(source, `scripts/${file}`, fs.readFileSync(path.join(root, 'scripts', file)));
  }
  return source;
}

const invoke = (source, ...args) => execFileSync(process.execPath, [path.join(source, 'scripts/install.mjs'), ...args], {encoding: 'utf8'});
const failed = (script, ...args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});

test('unified package builds cleanly and excludes caches and private files', t => {
  const temp = temporary(t), source = fixture(temp), output = path.join(temp, 'dist', 'anything2video');
  const target = buildPackage(output, {source});
  assert.equal(target, fs.realpathSync.native(output));
  const metadata = verifyPackage(target);
  assert.equal(metadata.name, 'anything2video');
  assert.equal(metadata.version, '5.0.0');

  for (const relative of [
    'examples/private.md',
    'examples/engraving/renders',
    'tests',
    'template/tests',
    'template/node_modules',
    'template/.verify2_bundle',
    'template/audio',
    'reference/.cache',
    'reference/.env',
    'reference/research-worker-report.md',
  ]) {
    assert.equal(fs.existsSync(path.join(target, relative)), false, relative);
  }
  assert.ok(fs.existsSync(path.join(target, 'styles/building-label.md')));
  assert.ok(fs.existsSync(path.join(target, 'LICENSE-THIRDPARTY/MIT-fixture.txt')));
  assert.ok(fs.existsSync(path.join(target, 'examples/engraving/README.md')));
  assert.ok(fs.existsSync(path.join(target, 'docs/style-system-round1.md')));
  assert.ok(fs.existsSync(path.join(target, 'docs/getting-started.md')));
  assert.ok(fs.existsSync(path.join(target, 'assets/audio/ATTRIBUTION.md')));
  assert.equal(fs.readFileSync(path.join(target, 'samples/sample.mp4'), 'utf8'), 'Fixture media');
  for (const relative of [
    'scripts/init.mjs',
    'scripts/install.mjs',
    'scripts/build-editions.mjs',
    'template/src/config.ts',
    'reference/production-contract.md',
    'reference/environment-capabilities.md',
    'LICENSE',
  ]) {
    assert.ok(fs.existsSync(path.join(target, relative)), relative);
  }
});

test('a relocated offline package initializes and installs cleanly', t => {
  const temp = temporary(t), source = fixture(temp);
  const built = buildPackage(path.join(temp, 'offline-pkg', 'anything2video'), {source});
  const project = path.join(temp, 'film');
  execFileSync(process.execPath, [path.join(built, 'scripts/init.mjs'), project, 'offline-film']);
  assert.ok(fs.readFileSync(path.join(project, 'src/config.ts'), 'utf8').includes('offline-film'));

  const installRoot = path.join(temp, 'host');
  assert.ok(invoke(built, 'claude', installRoot).includes('Installed complete unified package'));
  const installed = path.join(installRoot, '.claude/skills/anything2video');
  verifyPackage(installed);
});

test('universal installer supports all platform discovery directories and aliases', t => {
  const temp = temporary(t), source = fixture(temp);
  for (const [host, folder] of [
    ['claude', '.claude'],
    ['claude-code', '.claude'],
    ['zcode', '.agents'],
    ['codex', '.agents'],
    ['universal', '.agents'],
    ['minimax', '.minimax'],
    ['minimax-code', '.minimax'],
    ['workbuddy', '.workbuddy'],
    ['codebuddy', '.codebuddy'],
  ]) {
    const projectRoot = path.join(temp, `host-${host}`);
    invoke(source, host, projectRoot);
    const target = path.join(projectRoot, folder, 'skills', 'anything2video');
    verifyPackage(target);
    // Preserves existing installation on subsequent install without overwrite
    assert.notEqual(failed(path.join(source, 'scripts/install.mjs'), host, projectRoot).status, 0);
  }
});

test('MiniMax data directory is explicit and invalid flag combinations fail', t => {
  const temp = temporary(t), source = fixture(temp), dataDir = path.join(temp, 'actual app data');
  invoke(source, 'minimax-code', '--data-dir', dataDir);
  verifyPackage(path.join(dataDir, 'skills/anything2video'));
  for (const args of [
    ['codex', '--data-dir', dataDir],
    ['minimax', '--data-dir'],
    ['minimax', path.join(temp, 'project'), '--data-dir', dataDir],
  ]) {
    assert.notEqual(failed(path.join(source, 'scripts/install.mjs'), ...args).status, 0);
  }
});

test('desktop export creates complete package for Doubao Work or manual import', t => {
  const temp = temporary(t), source = fixture(temp);
  const exportRoot = path.join(temp, 'desktop-export');
  assert.ok(invoke(source, 'doubao', '--export-dir', exportRoot).includes('Exported complete unified package'));
  verifyPackage(path.join(exportRoot, 'anything2video'));
  assert.notEqual(failed(path.join(source, 'scripts/install.mjs'), 'doubao').status, 0, 'Doubao without export-dir fails');
});

test('symlink install mode links directly to source', t => {
  const temp = temporary(t), source = fixture(temp);
  const projectRoot = path.join(temp, 'symlink-host');
  invoke(source, '--symlink', 'claude', projectRoot);
  const target = path.join(projectRoot, '.claude/skills/anything2video');
  assert.ok(fs.lstatSync(target).isSymbolicLink());
  verifyPackage(target);
});

test('source and destination ancestors, descendants and realpath aliases cannot overlap', t => {
  const temp = temporary(t), source = fixture(temp);
  for (const target of [source, path.join(source, 'dist'), temp]) {
    assert.throws(() => buildPackage(target, {source}), /overlap/);
  }
  const alias = path.join(temp, 'source-alias');
  fs.symlinkSync(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => assertDisjoint(source, path.join(alias, 'new-package')), /overlap/);
});

test('linked package inputs are rejected instead of following external content', t => {
  const temp = temporary(t), source = fixture(temp), external = path.join(temp, 'external');
  write(external, 'secret.md', 'outside shared source');
  fs.symlinkSync(external, path.join(source, 'reference/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => collectCoreFiles(source), /symbolic links/);
});


test('core drops only optional sample MP4 and retains an honest complete preview shell', t => {
  const temp = temporary(t), source = fixture(temp);
  const full = collectCoreFiles(source, {profile: 'full'});
  const core = collectCoreFiles(source, {profile: 'core'});
  assert.deepEqual(core, full.filter(file => !isOptionalSampleMedia(file)));
  assert.deepEqual(collectCoreFiles(source, {includeSamples: false}), core, 'legacy option keeps gallery metadata now');
  const target = buildPackage(path.join(temp, 'core'), {source, profile: 'core'});
  assert.equal(verifyPackage(target).profile, 'core');
  assert.equal(fs.existsSync(path.join(target, 'samples/sample.mp4')), false);
  for (const file of ['samples/posters/sample.jpg', 'samples/manifest.json', 'samples/README.md', 'LICENSE-THIRDPARTY/MIT-fixture.txt', 'styles/fixture/SPEC.md']) assert.ok(fs.existsSync(path.join(target, file)), file);
  for (const file of ['samples/index.html', 'samples/all.html']) {
    const html = fs.readFileSync(path.join(target, file), 'utf8');
    assert.match(html, /id="sample"/);
    assert.match(html, /src="posters\/sample.jpg"/);
    assert.match(html, /可选视频未安装/);
    assert.match(html, /href="\.\.\/docs\/package-profiles.md#optional-sample-videos"/);
    assert.doesNotMatch(html, /<video|(?:src|href)="sample.mp4"/);
    assert.equal(presentOptionalSamples(file, html, 'core'), html, 'presentation is idempotent');
  }
  assert.match(fs.readFileSync(path.join(target, 'README.md'), 'utf8'), /\[Play\]\(docs\/package-profiles.md#optional-sample-videos\)/);
  assert.match(fs.readFileSync(path.join(target, 'styles/fixture/SPEC.md'), 'utf8'), /\[Preview\]\(\.\.\/\.\.\/docs\/package-profiles.md#optional-sample-videos\)/);
  const manifest = readPackageManifest(target);
  assert.equal(manifest.sampleMedia, 'omitted');
  assert.equal(manifest.omittedSampleMediaBytes, Buffer.byteLength('Fixture media'));
  assert.deepEqual(manifest.omittedSampleMedia.map(entry => entry.path), ['samples/sample.mp4']);
  assert.equal(manifest.files.some(entry => isOptionalSampleMedia(entry.path)), false);
  assert.equal(manifest.files.some(entry => /node_modules|cache|secret|worker-report/.test(entry.path)), false);
  assert.equal(manifest.payloadBytes, manifest.files.reduce((sum, entry) => sum + fs.statSync(path.join(target, entry.path)).size, 0));
});

test('relocated core installs and initializes offline, inheriting its profile without claiming full', t => {
  const temp = temporary(t), source = fixture(temp);
  const built = buildPackage(path.join(temp, 'core'), {source, profile: 'core'});
  const moved = path.join(temp, 'relocated', 'anything2video');
  fs.mkdirSync(path.dirname(moved)); fs.renameSync(built, moved);
  const hostRoot = path.join(temp, 'host');
  assert.match(invoke(moved, 'claude', hostRoot), /Installed core unified package/);
  const installed = path.join(hostRoot, '.claude/skills/anything2video');
  assert.equal(verifyPackage(installed).profile, 'core');
  assert.equal(readPackageManifest(installed).omittedSampleMediaBytes, Buffer.byteLength('Fixture media'));
  assert.equal(fs.readFileSync(path.join(installed, 'samples/index.html'), 'utf8'), fs.readFileSync(path.join(moved, 'samples/index.html'), 'utf8'));
  execFileSync(process.execPath, [path.join(installed, 'scripts/init.mjs'), path.join(temp, 'film'), 'core-film']);
  assert.match(fs.readFileSync(path.join(temp, 'film/src/config.ts'), 'utf8'), /core-film/);
  const rejected = path.join(temp, 'rejected');
  const result = failed(path.join(moved, 'scripts/install.mjs'), 'claude', rejected, '--profile', 'full');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /not present in this core package/);
  assert.equal(fs.existsSync(rejected), false, 'fail before creating an incomplete full install');
  assert.throws(() => buildPackage(path.join(temp, 'also-rejected'), {source: moved, profile: 'full'}), /not present/);
});

test('full package can produce core and profile selection never silently filters a symlink', t => {
  const temp = temporary(t), source = fixture(temp);
  const full = buildPackage(path.join(temp, 'full'), {source});
  assert.equal(verifyPackage(full).profile, 'full');
  assert.equal(readPackageManifest(full).omittedSampleMediaBytes, 0);
  const core = buildPackage(path.join(temp, 'core'), {source: full, profile: 'core'});
  assert.equal(readPackageManifest(core).omittedSampleMediaBytes, Buffer.byteLength('Fixture media'));
  const host = path.join(temp, 'host');
  const result = failed(path.join(source, 'scripts/install.mjs'), 'claude', host, '--profile', 'core', '--symlink');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /cannot filter resources/);
  assert.equal(fs.existsSync(host), false);
  invoke(core, 'claude', host, '--symlink');
  assert.ok(fs.lstatSync(path.join(host, '.claude/skills/anything2video')).isSymbolicLink());
});

test('invalid profiles, conflicting legacy options and unavailable full media fail before writing', t => {
  const temp = temporary(t), source = fixture(temp);
  for (const options of [{profile: 'tiny'}, {profile: 'core', includeSamples: true}, {includeSamples: 'false'}]) {
    assert.throws(() => buildPackage(path.join(temp, 'bad'), {source, ...options}), /profile|includeSamples/);
    assert.equal(fs.existsSync(path.join(temp, 'bad')), false);
  }
  for (const args of [['--profile'], ['--profile', 'tiny'], ['--profile', 'core', '--profile', 'full']]) {
    assert.notEqual(failed(path.join(source, 'scripts/install.mjs'), 'claude', path.join(temp, 'bad-host'), ...args).status, 0);
    assert.notEqual(failed(path.join(source, 'scripts/build-editions.mjs'), path.join(temp, 'bad-output'), ...args).status, 0);
  }
  fs.unlinkSync(path.join(source, 'samples/sample.mp4'));
  assert.throws(() => buildPackage(path.join(temp, 'missing'), {source, profile: 'full'}), /missing sample media/);
  assert.equal(fs.existsSync(path.join(temp, 'missing')), false);
});

test('package inventory detects altered files and refuses unsafe manifest paths', t => {
  const temp = temporary(t), source = fixture(temp);
  const core = buildPackage(path.join(temp, 'core'), {source, profile: 'core'});
  fs.appendFileSync(path.join(core, 'template/src/config.ts'), '// altered');
  assert.throws(() => verifyPackage(core), /Package file mismatch/);
  const file = path.join(core, 'package-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.files[0].path = '../outside';
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => verifyPackage(core), /Invalid package-manifest/);
});


test('package verification rejects linked manifests and inventory entries without following them', t => {
  const temp = temporary(t), source = fixture(temp);
  const target = buildPackage(path.join(temp, 'core'), {source, profile: 'core'});
  const original = path.join(target, 'template/src/config.ts');
  fs.unlinkSync(original);
  fs.symlinkSync(path.join(source, 'template/src/config.ts'), original);
  assert.throws(() => verifyPackage(target), /Package file mismatch/);
  const file = path.join(target, 'package-manifest.json');
  fs.renameSync(file, path.join(temp, 'manifest.json'));
  fs.symlinkSync(path.join(temp, 'manifest.json'), file);
  assert.throws(() => readPackageManifest(target), /expected a regular file/);
});


test('core verification rejects undeclared optional media and duplicate omission entries', t => {
  const temp = temporary(t), source = fixture(temp);
  const target = buildPackage(path.join(temp, 'core'), {source, profile: 'core'});
  write(target, 'samples/new.mp4', 'undeclared video');
  assert.throws(() => verifyPackage(target), /Unexpected optional media/);
  fs.unlinkSync(path.join(target, 'samples/new.mp4'));
  const file = path.join(target, 'package-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.omittedSampleMedia.push(manifest.omittedSampleMedia[0]);
  manifest.omittedSampleMediaBytes *= 2;
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => readPackageManifest(target), /Invalid package-manifest/);
});


test('bounded hashing preserves independent digests across empty, exact and partial chunks', t => {
  const temp = temporary(t), source = fixture(temp);
  const sizes = [0, 1, 1024 * 1024 - 1, 1024 * 1024, 1024 * 1024 + 1, 2 * 1024 * 1024 + 37];
  for (const size of sizes) {
    const bytes = Buffer.alloc(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 29 + 17) % 251;
    write(source, `template/public/hash-${size}.bin`, bytes);
  }
  write(source, 'samples/sample.mp4', Buffer.alloc(1024 * 1024 + 19, 173));
  for (const profile of ['core', 'full']) {
    const target = buildPackage(path.join(temp, profile), {source, profile});
    const manifest = readPackageManifest(target);
    for (const entry of [...manifest.files, ...manifest.omittedSampleMedia]) {
      const actual = fs.readFileSync(path.join(manifest.files.includes(entry) ? target : source, entry.path));
      assert.equal(entry.bytes, actual.length, entry.path);
      assert.equal(entry.sha256, crypto.createHash('sha256').update(actual).digest('hex'), entry.path);
    }
    const changed = path.join(target, `template/public/hash-${sizes.at(-1)}.bin`);
    const original = fs.readFileSync(changed);
    const altered = Buffer.from(original);
    altered[1024 * 1024 + 7] ^= 255;
    fs.writeFileSync(changed, altered);
    assert.throws(() => verifyPackage(target), /Package file mismatch/, 'same-size edits must invalidate every verification');
    fs.writeFileSync(changed, original);
    assert.equal(verifyPackage(target).profile, profile, 'no stale digest from earlier verification');
    fs.unlinkSync(changed);
    assert.throws(() => verifyPackage(target), /Package file mismatch/, 'missing inventory files still fail');
  }
});
