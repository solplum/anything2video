#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOSTS = Object.freeze(['universal', 'claude-code', 'codex', 'workbuddy', 'minimax-code', 'zcode', 'doubao-work']);
const directories = ['recipes', 'reference', 'styles', 'template', 'scripts', 'gallery', 'audio-engine', 'LICENSE-THIRDPARTY'];
const individual = ['LICENSE', 'docs/adapters.md', 'docs/optimization-v3.md', 'docs/optimization-v3.1.md', 'docs/optimization-v3.6.md', 'docs/optimization-v3.7.md', 'docs/style-system-round1.md'];
// Only reviewed, redistributable examples are included. Arbitrary working
// projects under examples/ remain excluded, as do their render/cache folders.
const publicExamples = ['examples/engraving', 'examples/line-art-teaching'];
const excluded = /^(?:\.git|\.venv|node_modules|\.Codex|\.mimosa|\.zcode|__pycache__|\.pytest_cache|audio|renders|stills|fin_frames|out|dist|build.*|tests|examples|cache|\.cache|.*-cache|secrets?|credentials?|\..*stills|\.verify.*|\.probe.*|\.render-bundle.*)$/i;
const privateFile = /(?:^\.env(?:\..*)?$|^(?:secrets?|credentials?)(?:\..*)?$|^\.(?:npmrc|pypirc|netrc|git-credentials)$|\.(?:log|pyc|pem|key|p12|pfx)$|(?:^|[._-])worker-report(?:[._-]|$))/i;
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exists = file => {try {fs.lstatSync(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}};
const canonical = file => {
  const suffix = [];
  let current = path.resolve(file);
  while (!exists(current)) {suffix.unshift(path.basename(current)); current = path.dirname(current);}
  return path.resolve(fs.realpathSync.native(current), ...suffix);
};
const comparable = file => process.platform === 'win32' ? file.toLowerCase() : file;
const contains = (parent, child) => {
  const relative = path.relative(comparable(parent), comparable(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

export function assertDisjoint(source, target) {
  const from = canonical(source), to = canonical(target);
  if (contains(from, to) || contains(to, from)) throw new Error('Source and target must not overlap, including aliases and ancestors');
  return to;
}

export function frontmatterOf(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Missing YAML frontmatter');
  return match[1];
}

export function declaredVersion(frontmatter) {
  const block = frontmatter.match(/^metadata:\s*\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$))*)/m)?.[1];
  const nested = block?.match(/^  version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)["']?\s*$/m)?.[1];
  return nested ?? frontmatter.match(/^version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?)["']?\s*$/m)?.[1];
}

export const versionOf = source => {
  const value = declaredVersion(frontmatterOf(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8')));
  if (!value) throw new Error('SKILL.md must declare a version');
  return value;
};

export function collectCoreFiles(source, {includeSamples = true} = {}) {
  const root = canonical(source);
  const files = [];
  function walk(relative) {
    const absolute = path.join(root, ...relative.split('/'));
    const stat = fs.lstatSync(absolute);
    if ((stat.isDirectory() && excluded.test(path.basename(relative))) || (stat.isFile() && privateFile.test(path.basename(relative)))) return;
    if (stat.isSymbolicLink()) throw new Error(`Package inputs cannot contain symbolic links: ${relative}`);
    if (!contains(root, fs.realpathSync.native(absolute))) throw new Error(`Package input escapes source: ${relative}`);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolute).sort()) walk(`${relative}/${child}`);
    } else if (stat.isFile()) files.push(relative);
    else throw new Error(`Unsupported package input: ${relative}`);
  }
  for (const relative of [...directories, ...individual]) {
    if (!exists(path.join(root, ...relative.split('/')))) throw new Error(`Missing shared package input: ${relative}`);
    walk(relative);
  }
  for (const relative of publicExamples) {
    if (exists(path.join(root, ...relative.split('/')))) walk(relative);
  }
  if (includeSamples && exists(path.join(root, 'samples'))) walk('samples');
  return files.sort();
}

export function validateSkill(source) {
  const skillFile = path.join(source, 'SKILL.md');
  if (!exists(skillFile)) throw new Error(`Missing SKILL.md in ${source}`);
  if (fs.lstatSync(skillFile).isSymbolicLink()) throw new Error(`SKILL.md must not be a symbolic link: ${skillFile}`);
  const text = fs.readFileSync(skillFile, 'utf8');
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) throw new Error('Missing YAML frontmatter in SKILL.md');
  const frontmatter = frontmatterOf(text);
  if (!/^name:\s*anything2video\s*$/m.test(frontmatter)) throw new Error('Skill name must be anything2video');
  const version = declaredVersion(frontmatter);
  if (!version) throw new Error('Skill must declare a version');
  if (!/^description:\s*\S/m.test(frontmatter)) throw new Error('Skill must declare a description');
  return {version, text, frontmatter};
}

export function verifyPackage(target) {
  const targetDir = canonical(target);
  if (!exists(targetDir) || !fs.statSync(targetDir).isDirectory()) throw new Error(`Target is not a valid directory: ${target}`);
  const skill = validateSkill(targetDir);
  for (const required of ['reference/production-contract.md', 'reference/environment-capabilities.md', 'scripts/init.mjs', 'scripts/install.mjs', 'template/src/config.ts', 'LICENSE']) {
    const full = path.join(targetDir, ...required.split('/'));
    if (!exists(full)) throw new Error(`Package incomplete, missing: ${required}`);
  }
  return {name: 'anything2video', version: skill.version};
}

export function buildPackage(destination, {source = SOURCE_ROOT, overwrite = false, includeSamples = true} = {}) {
  const target = assertDisjoint(source, destination);
  if (exists(target)) {
    if (!fs.statSync(target).isDirectory()) throw new Error('Target must be a directory');
    if (!overwrite && fs.readdirSync(target).length > 0) throw new Error(`Target directory is not empty: ${target}. Use overwrite: true to replace.`);
    if (overwrite) fs.rmSync(target, {recursive: true});
  }
  fs.mkdirSync(target, {recursive: true});
  const skill = validateSkill(source);
  const files = collectCoreFiles(source, {includeSamples});
  for (const relative of files) {
    const from = path.join(source, ...relative.split('/'));
    const to = path.join(target, ...relative.split('/'));
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.copyFileSync(from, to);
  }
  for (const extra of ['SKILL.md', 'README.md', 'LICENSE']) {
    const from = path.join(source, extra);
    if (exists(from)) {
      const to = path.join(target, extra);
      fs.copyFileSync(from, to);
    }
  }
  verifyPackage(target);
  return target;
}

// Backward compatibility helper
export function buildEditions(output, {source = SOURCE_ROOT, overwrite = false} = {}) {
  const destination = assertDisjoint(source, output);
  if (exists(destination) && !fs.statSync(destination).isDirectory()) throw new Error('Output must be a directory');
  const target = path.join(destination, 'anything2video');
  buildPackage(target, {source, overwrite, includeSamples: true});
  return [target];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite');
  const positional = args.filter(arg => !arg.startsWith('--'));
  const output = positional[0] ?? path.join(path.dirname(SOURCE_ROOT), 'anything2video-dist');
  const result = buildPackage(path.join(output, 'anything2video'), {overwrite});
  console.log(`Built unified anything2video package at ${result}`);
}
