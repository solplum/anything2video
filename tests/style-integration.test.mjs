import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {collectCoreFiles} from '../scripts/build-editions.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');

test('integration retains all prototype renderer and media fingerprints', () => {
  const lighttable = read('examples/lighttable/verification.json');
  for (const [file, expected] of Object.entries(lighttable.sourceSha256)) assert.equal(hash(file), expected, file);
  for (const file of lighttable.media) assert.equal(hash(file.path), file.sha256, file.path);
  const choice = read('examples/choice-quest/render-evidence.json');
  assert.equal(hash('styles/choice-quest/scene.mjs'), choice.source);
  for (const file of choice.proofs) {
    assert.ok(file.repositoryPath && !file.repositoryPath.includes('..'));
    assert.equal(hash(file.repositoryPath), file.sha256, file.repositoryPath);
  }
  const transit = read('examples/transit-story/render-evidence.json');
  assert.equal(hash('styles/transit-story/scene.mjs'), transit.source);
  for (const file of transit.proofs) {
    assert.ok(file.repositoryPath && !file.repositoryPath.includes('..'));
    assert.equal(hash(file.repositoryPath), file.sha256, file.repositoryPath);
  }
  const porcelain = read('examples/porcelain-reveal/render-evidence.json');
  assert.equal(hash('styles/porcelain-reveal/scene.mjs'), porcelain.sourceSha256);
  for (const file of porcelain.proofs) {
    assert.ok(file.repositoryPath && !file.repositoryPath.includes('..'));
    assert.equal(hash(file.repositoryPath), file.sha256, file.repositoryPath);
  }
  const card = read('examples/card-conflict/render-evidence.json');
  const cardVerification = read('examples/card-conflict/verification.json');
  const rendered = read('tests/fixtures/card-conflict-rendered-source.json');
  for (const [file, expected] of Object.entries(cardVerification.deliveredSourceHashes)) assert.equal(hash(file), expected, file);
  assert.deepEqual(card.sourceHashes, rendered.renderedSourceHashes);
  assert.equal(card.deliveredSourceBridge.sceneSha256, hash('styles/card-conflict/scene.mjs'));
  assert.equal(card.deliveredSourceBridge.frames, 3840);
  assert.notEqual(card.sourceHashes['scene.mjs'], card.deliveredSourceBridge.sceneSha256, 'retain actual rendered-source identity');
  for (const file of card.proofs) {
    assert.ok(file.repositoryPath && !file.repositoryPath.includes('..'));
    assert.equal(hash(file.repositoryPath), file.sha256, file.repositoryPath);
  }
  const manifest = read('samples/manifest.json');
  assert.equal(manifest.samples.find(s => s.styleId === 'card-conflict').inputSha256, card.sourceHashes['scene.mjs']);
  for (const id of ['lighttable', 'choice-quest', 'transit-story', 'porcelain-reveal', 'card-conflict']) {
    const sample = manifest.samples.find(s => s.styleId === id);
    assert.equal(hash('samples/' + sample.path), sample.sha256, id);
    assert.equal(sample.runtimeSkin, false);
    assert.equal(sample.audio, 'none');
  }
});

test('real packaging collector includes all reviewed example trees and browsing docs', () => {
  // This is an explicit small fixture, not full-distribution build certification.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-integration-package-'));
  const write = relative => {const file = path.join(tmp, relative);fs.mkdirSync(path.dirname(file), {recursive:true});fs.writeFileSync(file, 'fixture');};
  for (const dir of ['recipes', 'reference', 'styles', 'template', 'scripts', 'gallery', 'audio-engine', 'LICENSE-THIRDPARTY']) fs.mkdirSync(path.join(tmp, dir), {recursive:true});
  for (const file of ['LICENSE', 'assets/audio/ATTRIBUTION.md', 'docs/adapters.md', 'docs/getting-started.md', 'docs/package-profiles.md', 'docs/optimization-v3.md', 'docs/optimization-v3.1.md', 'docs/optimization-v3.6.md', 'docs/optimization-v3.7.md', 'docs/style-system-round1.md', 'docs/style-browsing.md']) write(file);
  const shared = ['docs/style-browsing.md', 'reference/workflows/catalog.json', 'scripts/production-routes.mjs'];
  for (const id of ['lighttable', 'choice-quest', 'transit-story', 'porcelain-reveal', 'card-conflict']) shared.push(`styles/${id}/scene.mjs`, `styles/${id}/kit.tsx`, `examples/${id}/Root.tsx`, `examples/${id}/prepare.mjs`, `samples/posters/${id}-sample.jpg`);
  shared.push('examples/lighttable/portrait.mp4', 'examples/choice-quest/wait.mp4', 'examples/transit-story/portrait.mp4', 'examples/porcelain-reveal/portrait.mp4', 'examples/card-conflict/counterfactual.mp4', 'examples/card-conflict/greenhouse.mp4', 'examples/card-conflict/no-captions.mp4');
  const optional = ['samples/lighttable-sample.mp4', 'samples/choice-quest-sample.mp4', 'samples/transit-story-sample.mp4', 'samples/porcelain-reveal-sample.mp4', 'samples/card-conflict-sample.mp4'];
  for (const file of [...shared, ...optional, 'examples/lighttable/__pycache__/bad.pyc', 'examples/choice-quest/.env', 'examples/private-work/secret.txt']) write(file);
  try {
    const full = collectCoreFiles(tmp, {profile:'full'}), core = collectCoreFiles(tmp, {profile:'core'});
    for (const file of shared) {assert.ok(full.includes(file), file);assert.ok(core.includes(file), file);}
    for (const file of optional) {assert.ok(full.includes(file), file);assert.ok(!core.includes(file), file);}
    for (const files of [full, core]) assert.ok(!files.some(file => /__pycache__|\.env|secret/.test(file)));
  } finally {fs.rmSync(tmp, {recursive:true, force:true});}
});
