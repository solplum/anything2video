#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {renderBatch} from './render.mjs';
import {isRecord, isWithin, projectFile} from './runtime-lib.mjs';

const SAFE_STEM = value => String(value).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
const BUILTIN_ANCHOR = /^(?:C\d+|S\d+(?:\.end)?)$/;
const ESCAPE = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Extract {id: frame} map from src/common/anchors.ts literal export without running tsc. */
export function parseAnchorsTs(text) {
  const result = {};
  if (typeof text !== 'string' || !text.trim()) return result;
  const blockMatch = text.match(/ANCHOR_FRAMES[^=]*=\s*\{([\s\S]*?)\}/);
  if (!blockMatch) return result;
  for (const line of blockMatch[1].split(/\r?\n/)) {
    const match = line.match(/^\s*["']([^"']+)["']\s*:\s*(\d+)\s*,?\s*$/);
    if (match) result[match[1]] = Number(match[2]);
  }
  return result;
}

/** Build deterministic semantic-sync entries and a deduplicated renderBatch stills request. */
export function buildSemanticSyncPlan(timeline, anchorsMap = {}, cfg, opts = {}) {
  if (!isRecord(timeline) || !Array.isArray(timeline.sentences)) {
    throw new Error('timeline.json must contain a sentences array');
  }
  if (!isRecord(cfg) || !Number.isInteger(cfg.totalFrames) || cfg.totalFrames < 1) {
    throw new Error('project.json must contain positive integer totalFrames');
  }
  const totalFrames = cfg.totalFrames;
  const clamp = f => Math.max(1, Math.min(totalFrames, Math.round(f)));
  const entries = [];
  const usedIds = new Set();
  const uniqueId = base => {
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate.toLowerCase())) {
      candidate = `${base}-${suffix++}`;
    }
    usedIds.add(candidate.toLowerCase());
    return candidate;
  };

  for (const sent of timeline.sentences) {
    if (!sent || !Number.isInteger(sent.from) || !Number.isInteger(sent.to)) continue;
    const frame = clamp(Math.floor((sent.from + sent.to) / 2));
    entries.push({
      kind: '句中点',
      sourceId: String(sent.id ?? `S${entries.length + 1}`),
      frame,
      windowLabel: `f${sent.from}–f${sent.to}`,
      text: String(sent.text ?? ''),
    });
  }

  for (const [aid, rawFrame] of Object.entries(anchorsMap)) {
    if (BUILTIN_ANCHOR.test(aid) || !Number.isInteger(rawFrame) || rawFrame < 1) continue;
    const frame = clamp(rawFrame);
    const holder = timeline.sentences.find(s => Number.isInteger(s.from) && Number.isInteger(s.to) && s.from <= frame && frame <= s.to);
    entries.push({
      kind: '语义锚点',
      sourceId: `{#${aid}}`,
      frame,
      windowLabel: `f${frame}`,
      text: holder ? String(holder.text ?? '') : '（见 narration.txt）',
    });
  }

  if (entries.length === 0) {
    throw new Error('No sentences or semantic anchors found in timeline.json / anchors.ts');
  }

  const byFrame = new Map();
  const stills = [];
  for (const entry of entries) {
    let stillId = byFrame.get(entry.frame);
    if (!stillId) {
      stillId = uniqueId(SAFE_STEM(`${entry.kind === '语义锚点' ? 'anc' : 'sent'}-${entry.sourceId}-f${entry.frame}`));
      byFrame.set(entry.frame, stillId);
      stills.push({id: stillId, frame: entry.frame});
    }
    entry.stillId = stillId;
  }

  const batchId = opts.id || `semantic-sync-${Date.now().toString(36)}`;
  return {
    entries,
    batchRequest: {schemaVersion: 1, id: batchId, windows: [], stills},
  };
}

export function formatSemanticSyncMarkdown(root, batchDir, entries, timeline, opts = {}) {
  const fps = Number(timeline?.fps) || 30;
  const relBatch = path.relative(path.join(root, 'qc', 'semantic-sync'), batchDir).split(path.sep).join('/');
  const lines = [
    '# 音画语义对照抽帧表（semantic-sync）',
    '',
    `- 来源：\`script/timeline.json\`（engine: \`${timeline?.engine ?? 'unknown'}\`, anchor_source: \`${timeline?.anchor_source ?? 'unknown'}\`）`,
    '- 状态：`needs_review`（本脚本只按时间戳抽帧并生成对照表，不替代人眼核查）',
    `- 批次目录：\`${path.relative(root, batchDir).split(path.sep).join('/')}\``,
    '',
    '| 类型 | 锚点 / 句ID | 帧 (1起 / 秒) | 区间 | 对应旁白原文 | 截图 | 核对结果 |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const e of entries) {
    const sec = ((e.frame - 1) / fps).toFixed(2);
    const imgPath = `${relBatch}/${e.stillId}.png`;
    lines.push(
      `| ${e.kind} | \`${ESCAPE(e.sourceId)}\` | f${e.frame} (${sec}s) | ${ESCAPE(e.windowLabel)} | ${ESCAPE(e.text)} | [${e.stillId}.png](${encodeURI(imgPath)}) | [ ] 待核查 |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

export async function generateSemanticSyncPack(root, opts = {}, env = process.env) {
  root = fs.realpathSync(root);
  const cfg = JSON.parse(fs.readFileSync(projectFile(root, 'project.json'), 'utf8'));
  const timeline = JSON.parse(fs.readFileSync(projectFile(root, 'script/timeline.json'), 'utf8'));
  let anchorsMap = {};
  const anchorsRel = 'src/common/anchors.ts';
  if (fs.existsSync(path.join(root, anchorsRel))) {
    anchorsMap = parseAnchorsTs(fs.readFileSync(projectFile(root, anchorsRel), 'utf8'));
  }

  const plan = buildSemanticSyncPlan(timeline, anchorsMap, cfg, opts);
  const result = await renderBatch(root, plan.batchRequest, env);
  const outDir = path.join(root, 'qc', 'semantic-sync');
  if (!isWithin(root, path.resolve(outDir))) throw new Error('qc/semantic-sync escapes project');
  fs.mkdirSync(outDir, {recursive: true});
  const mdPath = path.join(outDir, 'index.md');
  const md = formatSemanticSyncMarkdown(root, result.directory, plan.entries, timeline, opts);
  fs.writeFileSync(mdPath, md, 'utf8');
  return {markdownPath: mdPath, batchDirectory: result.directory, entries: plan.entries, stillsCount: plan.batchRequest.stills.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let target = '.';
  let id;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && i + 1 < args.length) id = args[++i];
    else if (!args[i].startsWith('-')) target = args[i];
  }
  try {
    const res = await generateSemanticSyncPack(path.resolve(target), id ? {id} : {});
    console.log(`${res.markdownPath} (${res.entries.length} rows, ${res.stillsCount} unique stills)`);
  } catch (err) {
    console.error(`[semantic-sync-pack] ${err.message}`);
    process.exitCode = 1;
  }
}
