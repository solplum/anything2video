import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isRecord, isWithin, nonempty, projectFile, resolvedPath} from './runtime-lib.mjs';

const MiB = 1024 * 1024;
export const VISUAL_DIRECTION_LIMITS = Object.freeze({manifestBytes: MiB, candidates: 12, evidencePerCandidate: 24, mediaBytes: 256 * MiB, totalMediaBytes: 1024 * MiB});
const FIELDS = ['composition', 'typography', 'palette', 'motion'];
const POSITIONS = ['opening', 'middle', 'ending'];
const HASH = /^[a-f0-9]{64}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const description = value => nonempty(value) && value.length <= 8000;
const normalized = value => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const NOTE = 'Checks recorded evidence, media signatures and distinct declared treatments only. It does not prove decodability, source freshness, visual quality, visual distinction, or that anyone viewed the media.';

function relativePath(value) {
  if (!nonempty(value) || value.length > 1024 || value.includes('\0') || value.includes('\\') || path.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) throw new Error('Expected a project-relative file path (forward slashes, at most 1024 characters)');
}

// A missing draft manifest is allowed, but its existing ancestors must still be safe.
function manifestPath(root, relative) {
  relativePath(relative);
  if (path.extname(relative).toLowerCase() !== '.json') throw new Error('visualDirection must reference a .json file');
  const base = fs.realpathSync(root);
  const lexical = path.resolve(base, relative);
  if (lexical === base || !isWithin(base, lexical)) throw new Error(`Outside project: ${relative}`);
  const actual = resolvedPath(lexical);
  if (!isWithin(base, actual)) throw new Error(`Outside project: ${relative}`);
  if (!fs.existsSync(actual)) {
    let ancestor = path.dirname(actual);
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    if (!fs.statSync(ancestor).isDirectory()) throw new Error('Manifest parent must be a directory');
  }
  return actual;
}

// Deliberately a signature check, not a decoder or a claim that a render was watched.
function mediaKind(header, tail, size) {
  if (size >= 45 && header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && header.readUInt32BE(8) === 13 && header.toString('ascii', 12, 16) === 'IHDR' && header.readUInt32BE(16) > 0 && header.readUInt32BE(20) > 0 && tail.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) return 'keyframe';
  if (size >= 16 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff && tail[tail.length - 2] === 0xff && tail[tail.length - 1] === 0xd9) return 'keyframe';
  if (size >= 24 && header.toString('ascii', 4, 8) === 'ftyp') {
    const boxSize = header.readUInt32BE(0);
    if (boxSize >= 16 && boxSize <= header.length && boxSize < size && boxSize % 4 === 0) {
      const brands = [header.toString('ascii', 8, 12)];
      for (let offset = 16; offset < boxSize; offset += 4) brands.push(header.toString('ascii', offset, offset + 4));
      if (brands.some(brand => /^(?:isom|iso[2-9]|mp4[12]|avc1|dash|M4V )$/.test(brand))) return 'motion';
    }
  }
  // EBML header, WebM DocType element, and a Segment marker; Matroska is not WebM.
  if (size >= 32 && header.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')) && header.subarray(0, 4096).includes(Buffer.from('4282847765626d', 'hex')) && header.includes(Buffer.from('18538067', 'hex'))) return 'motion';
  return null;
}

function inspectMedia(file, bytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const hash = createHash('sha256');
    const chunk = Buffer.alloc(Math.min(MiB, bytes));
    const header = Buffer.alloc(Math.min(64 * 1024, bytes));
    const tail = Buffer.alloc(Math.min(16, bytes));
    let offset = 0;
    while (offset < bytes) {
      const read = fs.readSync(fd, chunk, 0, Math.min(chunk.length, bytes - offset), offset);
      if (read === 0) throw new Error('Media changed while checking');
      hash.update(chunk.subarray(0, read));
      if (offset < header.length) chunk.copy(header, offset, 0, Math.min(read, header.length - offset));
      offset += read;
    }
    if (fs.fstatSync(fd).size !== bytes || fs.readSync(fd, tail, 0, tail.length, bytes - tail.length) !== tail.length) throw new Error('Media changed while checking');
    return {sha256: hash.digest('hex'), kind: mediaKind(header, tail, bytes)};
  } finally {fs.closeSync(fd);}
}

/** Optional evidence contract. Only explicit drafts may defer selection and renders. */
export function checkVisualDirection(root, project) {
  const errors = [];
  const result = (status, reason) => ({status, scope: 'recorded_evidence_only', ...(reason ? {reason} : {}), errors, note: NOTE});
  if (!isRecord(project) || project.visualDirection === undefined) return result('not_performed', 'not_configured');
  let manifest;
  try {
    const file = manifestPath(root, project.visualDirection);
    if (project.status === 'draft' && !fs.existsSync(file)) return result('not_performed', 'draft');
    const existing = projectFile(root, project.visualDirection);
    if (fs.statSync(existing).size > VISUAL_DIRECTION_LIMITS.manifestBytes) throw new Error('Manifest exceeds 1 MiB limit');
    manifest = JSON.parse(fs.readFileSync(existing, 'utf8'));
  } catch (error) {
    errors.push(`Visual direction: cannot read manifest (${error.message})`);
    return result('failed');
  }
  if (project.status === 'draft') return result('not_performed', 'draft');
  if (!isRecord(manifest)) {
    errors.push('Visual direction: manifest must be an object');
    return result('failed');
  }
  if (manifest.schemaVersion !== 1) errors.push('Visual direction: schemaVersion must be 1');
  if (!['compare', 'reuse'].includes(manifest.mode)) errors.push("Visual direction: mode must be 'compare' or 'reuse'");
  if (!description(manifest.rationale)) errors.push('Visual direction: rationale must be nonempty text (at most 8000 characters)');
  if (manifest.mode === 'reuse' && !description(manifest.reuseReason)) errors.push('Visual direction: reuseReason must explain the approved direction being reused (at most 8000 characters)');
  if (!nonempty(manifest.selectedCandidate) || !ID.test(manifest.selectedCandidate)) errors.push('Visual direction: selectedCandidate must be a valid candidate id');
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length < 1 || manifest.candidates.length > VISUAL_DIRECTION_LIMITS.candidates) {
    errors.push(`Visual direction: candidates must contain 1..${VISUAL_DIRECTION_LIMITS.candidates} entries`);
    return result('failed');
  }
  if (manifest.mode === 'compare' && manifest.candidates.length < 2) errors.push('Visual direction: compare requires at least two candidates');
  if (manifest.mode === 'reuse' && manifest.candidates.length !== 1) errors.push('Visual direction: reuse requires exactly one candidate');
  const ids = new Set();
  const treatments = [];
  const collections = [];
  const inspected = new Map();
  let totalBytes = 0;
  for (const [index, candidate] of manifest.candidates.entries()) {
    const label = isRecord(candidate) && nonempty(candidate.id) ? candidate.id.slice(0, 64) : `#${index + 1}`;
    const prefix = `Visual direction candidate ${label}`;
    if (!isRecord(candidate)) {errors.push(`${prefix}: must be an object`); continue;}
    if (!nonempty(candidate.id) || !ID.test(candidate.id) || ids.has(candidate.id)) errors.push(`${prefix}: missing/invalid/duplicate id`);
    else ids.add(candidate.id);
    if (!isRecord(candidate.treatment) || !FIELDS.every(field => description(candidate.treatment[field]))) errors.push(`${prefix}: treatment requires composition, typography, palette and motion descriptions (at most 8000 characters each)`);
    else treatments.push({id: label, values: FIELDS.map(field => normalized(candidate.treatment[field]))});
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length < 1 || candidate.evidence.length > VISUAL_DIRECTION_LIMITS.evidencePerCandidate) {
      errors.push(`${prefix}: evidence must contain 1..${VISUAL_DIRECTION_LIMITS.evidencePerCandidate} media entries`);
      continue;
    }
    const positions = new Set();
    const files = new Set();
    const verifiedEvidence = [];
    let motion = false;
    for (const [evidenceIndex, evidence] of candidate.evidence.entries()) {
      const evidenceLabel = `${prefix} evidence #${evidenceIndex + 1}`;
      if (!isRecord(evidence)) {errors.push(`${evidenceLabel}: must be an object`); continue;}
      const validKind = ['keyframe', 'motion'].includes(evidence.kind);
      const validPosition = POSITIONS.includes(evidence.position);
      const validHash = nonempty(evidence.sha256) && HASH.test(evidence.sha256);
      if (!validKind) errors.push(`${evidenceLabel}: kind must be keyframe or motion`);
      if (!validPosition) errors.push(`${evidenceLabel}: position must be opening, middle or ending`);
      if (!validHash) errors.push(`${evidenceLabel}: requires a full SHA256`);
      try {
        relativePath(evidence.path);
        const file = projectFile(root, evidence.path);
        if (files.has(file)) throw new Error('Duplicate media reference; use separate rendered files for evidence positions');
        files.add(file);
        let actual = inspected.get(file);
        if (!actual) {
          const bytes = fs.statSync(file).size;
          if (bytes === 0 || bytes > VISUAL_DIRECTION_LIMITS.mediaBytes) throw new Error('Media must be nonempty and at most 256 MiB');
          totalBytes += bytes;
          if (totalBytes > VISUAL_DIRECTION_LIMITS.totalMediaBytes) throw new Error('Total media exceeds 1 GiB limit');
          actual = inspectMedia(file, bytes);
          inspected.set(file, actual);
        }
        if (!validHash || actual.sha256 !== evidence.sha256.toLowerCase()) errors.push(`${evidenceLabel}: stale evidence hash: ${evidence.path}`);
        if (!actual.kind || actual.kind !== evidence.kind) errors.push(`${evidenceLabel}: signature does not match ${validKind ? evidence.kind : 'a supported media kind'} (PNG/JPEG keyframe or MP4/WebM motion required)`);
        if (validHash && actual.sha256 === evidence.sha256.toLowerCase() && actual.kind === evidence.kind && validPosition) {
          verifiedEvidence.push(`${evidence.kind}:${evidence.position}:${actual.sha256}`);
          if (evidence.kind === 'keyframe') positions.add(evidence.position);
          if (evidence.kind === 'motion') motion = true;
        }
      } catch (error) {errors.push(`${evidenceLabel}: missing/invalid/outside media (${error.message})`);}
    }
    for (const position of POSITIONS) if (!positions.has(position)) errors.push(`${prefix}: missing valid ${position} keyframe evidence`);
    if (!motion) errors.push(`${prefix}: missing valid motion evidence`);
    if (verifiedEvidence.length === candidate.evidence.length) collections.push({id: label, fingerprint: verifiedEvidence.sort().join('|')});
  }
  if (!ids.has(manifest.selectedCandidate)) errors.push('Visual direction: selectedCandidate does not name a candidate');
  if (manifest.mode === 'compare') {
    for (let i = 0; i < treatments.length; i++) for (let j = i + 1; j < treatments.length; j++) {
      for (const [fieldIndex, field] of FIELDS.entries()) if (treatments[i].values[fieldIndex] === treatments[j].values[fieldIndex]) errors.push(`Visual direction: compare candidates ${treatments[i].id} and ${treatments[j].id} must declare distinct ${field}; recolor-only or relabeled treatments are insufficient`);
    }
    for (let i = 0; i < collections.length; i++) for (let j = i + 1; j < collections.length; j++) {
      if (collections[i].fingerprint === collections[j].fingerprint) errors.push(`Visual direction: compare candidates ${collections[i].id} and ${collections[j].id} have identical evidence collections; render the distinct treatments before choosing`);
    }
  }
  return result(errors.length ? 'failed' : 'passed');
}
