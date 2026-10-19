import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectCoreFiles} from '../scripts/build-editions.mjs';

// 真实源一致性门禁：校验统一 SKILL.md 超集元数据、核心文件清单与缓存防污染
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => fs.readFileSync(path.join(root, ...file.split('/')), 'utf8');
const frontmatter = text => text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
const declaredVersion = text => {
  const block = frontmatter(text).match(/^metadata:\s*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m)?.[1] ?? '';
  const nested = block.match(/^  version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)["']?\s*$/m)?.[1];
  return nested ?? frontmatter(text).match(/^version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)["']?\s*$/m)?.[1];
};

test('unified skill entry declares superset metadata and correct identity', () => {
  const skill = read('SKILL.md');
  const version = declaredVersion(skill);
  assert.match(version, /^\d+\.\d+\.\d+$/, 'SKILL.md must declare a semver version');
  assert.match(frontmatter(skill), /^name:\s*anything2video\s*$/m);
  assert.match(frontmatter(skill), /^author:\s*\S+/m);
  assert.match(frontmatter(skill), /zh-Hans:/);
  assert.match(frontmatter(skill), /displayNames:/);
  assert.equal(fs.existsSync(path.join(root, 'hosts')), false, 'legacy hosts directory must be removed in unified architecture');
  assert.ok(fs.existsSync(path.join(root, 'reference', 'environment-capabilities.md')), 'reference/environment-capabilities.md must exist');
});

test('core inventory walks the real tree including gallery, audio-engine and samples', () => {
  const files = collectCoreFiles(root);
  assert.ok(files.length > 500, `inventory unexpectedly small: ${files.length}`);
  for (const anchor of [
    'gallery/README.md',
    'audio-engine/README.md',
    'samples/manifest.json',
    'docs/optimization-v3.7.md',
    'template/scripts/mix_sfx.py',
    'reference/production-contract.md',
    'reference/environment-capabilities.md',
    'scripts/build-editions.mjs',
    'LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt',
    'styles/engraving/UPSTREAM.md',
    'styles/shared/paint/strokes.ts',
    'examples/engraving/prepare.mjs',
    'examples/engraving/README.md',
    'docs/style-system-round1.md',
    'docs/getting-started.md',
    'assets/audio/ATTRIBUTION.md',
  ]) {
    assert.ok(files.includes(anchor), `core inventory missing ${anchor}`);
  }
  for (const absent of ['docs/audit.md', 'docs/optimization-v2.md', 'template/tests', 'hosts']) {
    assert.equal(files.some(file => file === absent || file.startsWith(`${absent}/`)), false, `${absent} must stay out of the package inventory`);
  }
});

test('sample manifest entries exist with matching sha256 and posters', () => {
  const manifest = JSON.parse(read('samples/manifest.json'));
  assert.ok(Array.isArray(manifest.samples) && manifest.samples.length >= 19, 'bundle pool must have at least 19 samples');
  for (const sample of manifest.samples) {
    const media = path.join(root, 'samples', ...sample.path.split('/'));
    assert.ok(fs.existsSync(media), `missing sample media: ${sample.path}`);
    assert.equal(sha256(media), sample.sha256, `sha mismatch: ${sample.path}`);
    const poster = path.join(root, 'samples', 'posters', sample.path.replace(/\.mp4$/, '.jpg'));
    assert.ok(fs.existsSync(poster), `missing poster for ${sample.path}`);
  }
});

test('no python or pytest caches are committed into the skill tree', () => {
  const offenders = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.venv') continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__' || entry.name === '.pytest_cache') offenders.push(path.relative(root, full));
        else walk(full);
      }
    }
  };
  walk(root);
  assert.deepEqual(offenders, [], `runtime caches must not be committed: ${offenders.join(', ')}`);
});

test('README and getting-started links resolve in both checkout and distribution', () => {
  const packaged = new Set([...collectCoreFiles(root), 'README.md', 'SKILL.md', 'LICENSE']);
  for (const doc of ['README.md', 'docs/getting-started.md']) {
    const targets = [...read(doc).matchAll(/\]\(([^)]+)\)/g), ...read(doc).matchAll(/(?:src|href)="([^"]+)"/g)];
    for (const [, target] of targets) {
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
      const relative = decodeURIComponent(target.split('#')[0]);
      if (!relative) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(doc), relative));
      const full = path.join(root, ...resolved.split('/'));
      assert.ok(fs.existsSync(full), `${doc}: missing target ${target}`);
      const included = fs.statSync(full).isDirectory()
        ? [...packaged].some(file => file.startsWith(`${resolved}/`))
        : packaged.has(resolved);
      assert.ok(included, `${doc}: target missing from distribution: ${target}`);
    }
  }
});
