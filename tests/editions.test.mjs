import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertDisjoint, buildPackage, collectCoreFiles, verifyPackage} from '../scripts/build-editions.mjs';

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
  write(source, 'README.md', '# anything2video fixture\n');
  write(source, 'docs/adapters.md', 'Installation and verification\n');
  write(source, 'docs/getting-started.md', 'First project and troubleshooting\n');
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
  write(source, 'samples/manifest.json', '{"schemaVersion":1,"samples":[]}');
  write(source, 'samples/sample.mp4', 'Fixture media');
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
