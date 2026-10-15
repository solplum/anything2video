import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditSvgLineEnds } from '../scripts/probe_line_ends.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('line ends probe accurately detects floating vs resolved vector lines', () => {
  // 1. Closed triangle: 0 floating ends
  const closedTriangle = '<svg><path d="M 0 0 L 10 10 L 0 10 Z" /></svg>';
  const res1 = auditSvgLineEnds(closedTriangle, 1.0);
  assert.equal(res1.floatingCount, 0);

  // 2. Open segment with both ends floating: 2 floating ends
  const floatingLine = '<svg><path d="M 100 100 L 200 200" /></svg>';
  const res2 = auditSvgLineEnds(floatingLine, 1.0);
  assert.equal(res2.floatingCount, 2);

  // 3. Two connected segments sharing a vertex: 2 endpoints float, middle resolves
  const connected = '<svg><path d="M 0 0 L 50 50" /><path d="M 50 50 L 100 0" /></svg>';
  const res3 = auditSvgLineEnds(connected, 1.0);
  assert.equal(res3.floatingCount, 2); // (0,0) and (100,0) float; (50,50) matches

  // 4. Floating line with data-free="true" (e.g. printed ruler text or needle tip) is exempted
  const exemptedLine = '<svg><path data-free="true" d="M 100 100 L 200 200" /></svg>';
  const res4 = auditSvgLineEnds(exemptedLine, 1.0);
  assert.equal(res4.floatingCount, 0);
});

test('evals.json contains valid evaluation benchmarks', () => {
  const evalsPath = path.join(root, 'evals', 'evals.json');
  assert.ok(fs.existsSync(evalsPath), 'evals.json exists');
  const evalsData = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
  assert.equal(evalsData.skill_name, 'anything2video');
  assert.ok(Array.isArray(evalsData.evals));
  assert.ok(evalsData.evals.length >= 4);
  assert.ok(evalsData.evals.some(e => e.target_style === 'styles/isometric-anatomy'));
});

test('isometric-anatomy style specification and component exports exist', () => {
  const specPath = path.join(root, 'styles', 'isometric-anatomy', 'SPEC.md');
  const kitPath = path.join(root, 'styles', 'isometric-anatomy', 'anatomy.tsx');
  assert.ok(fs.existsSync(specPath), 'isometric-anatomy SPEC.md exists');
  assert.ok(fs.existsSync(kitPath), 'isometric-anatomy anatomy.tsx exists');
  const specContent = fs.readFileSync(specPath, 'utf8');
  assert.ok(specContent.includes('The object is the explanation'));
  assert.ok(specContent.includes('Dark Lab'));
});
