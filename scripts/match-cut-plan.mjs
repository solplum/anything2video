#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {checkPlan} from './check-plan.mjs';
import {projectFile} from './runtime-lib.mjs';
import {matchCutReviewRequest, MATCH_CUT_MODE} from './editing-mode-lib.mjs';

export function inspectMatchCut(root, {reviewRequest = false} = {}) {
  const checked = checkPlan(root);
  if (!checked.pass) throw new Error(`Storyboard gate failed: ${checked.errors.join('; ')}`);
  if (checked.editingMode.mode !== MATCH_CUT_MODE) throw new Error('This project has not selected editingMode=match-cut-beat-relay');
  const project = JSON.parse(fs.readFileSync(projectFile(root, 'project.json'), 'utf8'));
  const plan = JSON.parse(fs.readFileSync(projectFile(root, 'script/storyboard.json'), 'utf8'));
  if (reviewRequest) return matchCutReviewRequest(project, plan, checked.editingMode.cuts);
  return {pass: true, ...checked.editingMode, musicKind: plan.matchCut.music.kind, note: 'Only declared geometry/action/timing and grid hash checked; no media rendered, watched or heard. Use the existing review-pack and final QC workflow.'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [root, flag, ...extra] = process.argv.slice(2);
    if (!root || (flag !== undefined && flag !== '--review-request') || extra.length) throw new Error('Usage: node match-cut-plan.mjs <project> [--review-request]');
    console.log(JSON.stringify(inspectMatchCut(path.resolve(root), {reviewRequest: flag === '--review-request'}), null, 2));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
