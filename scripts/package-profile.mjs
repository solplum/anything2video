import fs from 'node:fs';
import path from 'node:path';

export const PACKAGE_PROFILES = Object.freeze(['core', 'full']);
export const PACKAGE_MANIFEST = 'package-manifest.json';
// This first-stage split removes preview media only, never runtime assets or examples.
export const isOptionalSampleMedia = relative => /^samples\/.*\.mp4$/i.test(relative);

export function readPackageManifest(source) {
  const file = path.join(source, PACKAGE_MANIFEST);
  let stat;
  try {stat = fs.lstatSync(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  if (!stat.isFile()) throw new Error(`Invalid ${PACKAGE_MANIFEST}: expected a regular file`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!manifest || typeof manifest !== 'object') throw new Error(`Invalid ${PACKAGE_MANIFEST}`);
  const safeEntry = entry => entry && typeof entry.path === 'string' && !/[\\:]/.test(entry.path)
    && !entry.path.startsWith('/') && entry.path.split('/').every(part => part && part !== '.' && part !== '..')
    && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && /^[a-f0-9]{64}$/.test(entry.sha256);
  if (manifest.schemaVersion !== 1 || manifest.name !== 'anything2video' || !PACKAGE_PROFILES.includes(manifest.profile)
      || !Array.isArray(manifest.files) || !manifest.files.every(safeEntry)
      || new Set(manifest.files.map(entry => entry.path)).size !== manifest.files.length
      || manifest.files.some(entry => entry.path === PACKAGE_MANIFEST || (manifest.profile === 'core' && isOptionalSampleMedia(entry.path)))
      || !Array.isArray(manifest.omittedSampleMedia) || !manifest.omittedSampleMedia.every(entry => safeEntry(entry) && isOptionalSampleMedia(entry.path))
      || new Set(manifest.omittedSampleMedia.map(entry => entry.path)).size !== manifest.omittedSampleMedia.length
      || (manifest.profile === 'full' && manifest.omittedSampleMedia.length !== 0)
      || manifest.sampleMedia !== (manifest.profile === 'core' ? 'omitted' : 'included')
      || manifest.payloadBytes !== manifest.files.reduce((sum, entry) => sum + entry.bytes, 0)
      || manifest.omittedSampleMediaBytes !== manifest.omittedSampleMedia.reduce((sum, entry) => sum + entry.bytes, 0)) {
    throw new Error(`Invalid ${PACKAGE_MANIFEST}`);
  }
  return manifest;
}

export function resolvePackageProfile(source, {profile, includeSamples} = {}) {
  if (includeSamples !== undefined && typeof includeSamples !== 'boolean') throw new Error('includeSamples must be boolean');
  const legacyProfile = includeSamples === undefined ? undefined : includeSamples ? 'full' : 'core';
  if (profile && legacyProfile && profile !== legacyProfile) throw new Error('Conflicting profile and includeSamples options');
  const sourceProfile = readPackageManifest(source)?.profile ?? 'full';
  const selected = profile ?? legacyProfile ?? sourceProfile;
  if (!PACKAGE_PROFILES.includes(selected)) throw new Error(`Unknown package profile: ${selected}. Choose core or full.`);
  if (selected === 'full' && sourceProfile === 'core') {
    throw new Error('Full sample media is not present in this core package. Build or install --profile full from a complete checkout/full package.');
  }
  return selected;
}

// Derive an honest offline presentation without changing catalog IDs, provenance,
// original media names, source links, filtering, deep links, or runtime assets.
export function presentOptionalSamples(relative, content, profile) {
  if (profile !== 'core') return content;
  const guide = path.posix.relative(path.posix.dirname(relative), 'docs/package-profiles.md') + '#optional-sample-videos';
  if (/^samples\/(?:index|all)\.html$/.test(relative)) {
    content = content.replace(/<video\b([^>]*)>[\s\S]*?<\/video>/g, (original, attributes) => {
      const src = attributes.match(/\bsrc="([^"]+)"/)?.[1];
      const poster = attributes.match(/\bposter="([^"]+)"/)?.[1];
      if (!src || !poster || !isOptionalSampleMedia(path.posix.join('samples', src))) return original;
      const label = attributes.match(/\baria-label="([^"]+)"/)?.[1] ?? '历史配方样片';
      return `<div class="optional-preview" data-optional-media="${src}"><img src="${poster}" alt="${label}缩略图" style="width:100%;max-height:520px;display:block;object-fit:contain"><p style="padding:0 18px">可选视频未安装 · <a href="${guide}">安装完整样片</a></p></div>`;
    });
    if (!content.includes('id="package-profile"')) content = content.replace('<div class="filters">', `<p id="package-profile">core 安装：全部风格与缩略图可浏览；样片 MP4 未安装，不影响创作。<a href="${guide}">如何获取视频</a></p>\n<div class="filters">`);
  } else if (relative.endsWith('.md')) {
    content = content.replace(/\]\(([^)]+)\)/g, (original, destination) => {
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(destination)) return original;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), destination.split('#')[0]));
      return isOptionalSampleMedia(resolved) ? `](${guide})` : original;
    });
    if (['README.md', 'samples/README.md'].includes(relative) && !content.includes('<!-- package-profile:core -->')) {
      const notice = `<!-- package-profile:core -->\n> **core 安装**：完整风格、缩略图与来源记录均保留；可选样片 MP4 未安装。未安装样片的视频链接指向[完整样片安装说明](${guide})，不会尝试打开缺失视频。\n\n`;
      content = content.replace(/^(# [^\n]+\n\n)/, `$1${notice}`);
    }
  }
  return content;
}
