#!/usr/bin/env node
/**
 * 矢量线条与机械刻线闭合度门禁（移植自 Anatomy line-ends.mjs，MIT）
 * 
 * 检查 SVG 图元中所有装饰性刻线、剖面线、焊缝、加强筋是否精确落在其他边缘或轮廓线上，
 * 严禁粗制滥造的孤立“浮空线头”（floating line ends）。
 * 
 * 用法：
 *   node scripts/probe_line_ends.mjs <file.svg | file.html> [--tolerance 2.0] [--out qc/line-ends.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const numbers = (text) => (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);

function parseSubpaths(d) {
  const subpaths = [];
  let curStart = null;
  let curEnd = null;

  const commands = d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g);
  let x = 0, y = 0;

  for (const [, cmd, argsStr] of commands) {
    const v = numbers(argsStr);
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();

    if (C === 'Z') {
      if (curStart && curEnd) {
        subpaths.push({ start: curStart, end: curEnd, closed: true, d });
        curStart = null;
        curEnd = null;
      }
      continue;
    }

    if (C === 'M') {
      if (curStart && curEnd) {
        subpaths.push({ start: curStart, end: curEnd, closed: false, d });
      }
      for (let i = 0; i + 1 < v.length; i += 2) {
        const nx = rel ? x + v[i] : v[i];
        const ny = rel ? y + v[i + 1] : v[i + 1];
        if (i === 0) {
          curStart = [nx, ny];
          curEnd = [nx, ny];
          x = nx; y = ny;
        } else {
          curEnd = [nx, ny];
          x = nx; y = ny;
        }
      }
      continue;
    }

    if (C === 'L') {
      for (let i = 0; i + 1 < v.length; i += 2) {
        const nx = rel ? x + v[i] : v[i];
        const ny = rel ? y + v[i + 1] : v[i + 1];
        curEnd = [nx, ny];
        x = nx; y = ny;
      }
    }
  }

  if (curStart && curEnd) {
    subpaths.push({ start: curStart, end: curEnd, closed: false, d });
  }

  return subpaths;
}

export function auditSvgLineEnds(svgText, tol = 2.0) {
  const pathMatches = svgText.matchAll(/<path\b([^>]*)\/?>/gi);
  const allPoints = [];
  const openEnds = [];

  for (const match of pathMatches) {
    const attrs = match[1] || '';
    const dMatch = attrs.match(/\bd=["']([^"']*)["']/i);
    if (!dMatch) continue;
    const d = dMatch[1];

    if (attrs.includes('data-free="true"') || attrs.includes('class="iso-halo"')) {
      continue;
    }

    const subs = parseSubpaths(d);
    for (const sub of subs) {
      allPoints.push(sub.start);
      allPoints.push(sub.end);
      if (!sub.closed) {
        openEnds.push({ pt: sub.start, which: 'start', d });
        openEnds.push({ pt: sub.end, which: 'end', d });
      }
    }
  }

  const floating = openEnds.filter(({ pt }) => {
    let matches = 0;
    for (const other of allPoints) {
      const dist = Math.hypot(pt[0] - other[0], pt[1] - other[1]);
      if (dist <= tol) {
        matches++;
      }
    }
    return matches <= 1;
  });

  return {
    totalOpenEnds: openEnds.length,
    floatingCount: floating.length,
    floating,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(`用法: node scripts/probe_line_ends.mjs <file.svg|file.html> [--tolerance 2.0] [--out qc/line-ends.json]`);
    process.exit(argv.length ? 0 : 1);
  }

  const file = argv[0];
  const take = (flag, fallback) => {
    const at = argv.indexOf(flag);
    if (at < 0) return fallback;
    const val = argv[at + 1];
    argv.splice(at, 2);
    return val;
  };

  const tolerance = Number(take('--tolerance', 2.0));
  const outFile = take('--out', null);

  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`);
    process.exit(1);
  }
  const content = fs.readFileSync(file, 'utf8');
  const result = auditSvgLineEnds(content, tolerance);
  console.log(`Line ends audit: ${result.floatingCount} floating ends found out of ${result.totalOpenEnds} open ends.`);

  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  }

  if (result.floatingCount > 0) {
    for (const f of result.floating.slice(0, 5)) {
      console.warn(`  Floating ${f.which} at (${f.pt[0].toFixed(1)}, ${f.pt[1].toFixed(1)}): ${f.d.slice(0, 40)}...`);
    }
    process.exit(1);
  } else {
    console.log(`Audit passed: All vector line ends resolve to vertices or boundaries.`);
    process.exit(0);
  }
}
