#!/usr/bin/env node
// Browser-free diagnostics. This does NOT measure rasterization, encoding or FPS.
// Usage: node tests/benchmarks/render-chain.mjs <frozen-checkout> <dependency-project> <new-results-directory>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const script = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(script), '../..');

if (process.argv[2] === '--worker') {
  const [kind, module, project, cache] = process.argv.slice(3);
  if (kind === 'snapshot') {
    const {snapshotSources} = await import(pathToFileURL(module));
    const start = performance.now(), hashes = snapshotSources(project);
    console.log(JSON.stringify({ms: performance.now() - start, maxRssKiB: process.resourceUsage().maxRSS, hashes}));
  } else if (kind === 'bundle') {
    const {bundle} = createRequire(path.join(project, 'package.json'))('@remotion/bundler');
    const output = fs.mkdtempSync(path.join(path.dirname(project), 'bundle-'));
    try {
      const start = performance.now();
      await bundle({entryPoint: path.join(project, 'src/index.ts'), rootDir: project, outDir: output, enableCaching: cache === 'true'});
      console.log(JSON.stringify({ms: performance.now() - start, maxRssKiB: process.resourceUsage().maxRSS}));
    } finally {fs.rmSync(output, {recursive: true, force: true});}
  } else throw new Error('Unknown worker mode');
} else {
  if (process.argv.length !== 5) throw new Error('Usage: node tests/benchmarks/render-chain.mjs <frozen-checkout> <dependency-project> <new-results-directory>');
  const source = fs.realpathSync(process.argv[2]), deps = fs.realpathSync(process.argv[3]), output = path.resolve(process.argv[4]);
  fs.mkdirSync(output); // Never replace an earlier report.
  const work = fs.mkdtempSync(path.join(output, 'work-')), project = path.join(work, 'project');
  fs.mkdirSync(project);
  try {
    for (const name of ['src', 'public', 'package.json', 'package-lock.json', 'tsconfig.json']) {
      fs.cpSync(path.join(source, 'template', name), path.join(project, name), {recursive: true});
    }
    fs.mkdirSync(path.join(project, 'node_modules'));
    for (const name of fs.readdirSync(path.join(deps, 'node_modules'))) {
      if (name !== '.cache') fs.symlinkSync(path.join(deps, 'node_modules', name), path.join(project, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir');
    }
    const execute = (kind, module, cache = false) => {
      const run = spawnSync(process.execPath, [script, '--worker', kind, module, project, String(cache)], {encoding: 'utf8'});
      if (run.status !== 0) throw new Error(run.stderr || run.stdout || run.error?.message);
      return JSON.parse(run.stdout.trim().split('\n').at(-1));
    };
    const bundleRows = [];
    for (const [cacheState, enabled, count] of [['disabled', false, 3], ['empty-cache', true, 1], ['warm-cache', true, 3]]) {
      for (let repetition = 0; repetition < count; repetition++) bundleRows.push({cacheState, repetition, ...execute('bundle', '', enabled)});
    }
    fs.mkdirSync(path.join(project, 'script'));
    fs.writeFileSync(path.join(project, 'script/storyboard.json'), '{"shots":[{"component":"src/Main.tsx"}]}\n');
    const snapshotRows = [], modules = {baseline: path.join(source, 'scripts/runtime-lib.mjs'), candidate: path.join(repo, 'scripts/runtime-lib.mjs')};
    let expected;
    for (let repetition = 0; repetition < 5; repetition++) {
      for (const variant of repetition % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
        const {hashes, ...row} = execute('snapshot', modules[variant]);
        const serialized = JSON.stringify(hashes);
        if (expected && expected !== serialized) throw new Error('Snapshot digests differ');
        expected = serialized;
        snapshotRows.push({variant, repetition, files: Object.keys(hashes).length, ...row});
      }
    }
    const {tsLoader} = await import('../helpers/load-ts.mjs');
    const load = tsLoader(file => fs.readFileSync(path.join(source, path.relative(repo, file)), 'utf8'));
    const {starsAt, STAR_DEFAULT} = load('template/src/common/StarField.tsx');
    const {RisoPaper, InkPlate} = load('template/src/common/riso/index.ts');
    const require = createRequire(path.join(deps, 'package.json'));
    const React = require('react'), {renderToStaticMarkup} = require('react-dom/server'), h = React.createElement;
    const {generatedFiles} = await import(pathToFileURL(path.join(source, 'scripts/style-catalog.mjs')));
    const cases = {
      catalog: {calls: 100, run: () => [...generatedFiles().values()].reduce((sum, value) => sum + value.length, 0)},
      stars: {calls: 3600, run: i => starsAt(i % 360, STAR_DEFAULT).length},
      risoStaticMarkup: {calls: 600, run: i => renderToStaticMarkup(h(RisoPaper, {id: 'bench', width: 1280, height: 720},
        h(InkPlate, {id: 'cyan', width: 1280, height: 720, ink: '#0078BF', frame: i % 120, reveal: {startFrame: 0, endFrame: 90}},
          h('circle', {cx: 640, cy: 360, r: 180, fill: 'white'})))).length},
    };
    const pureRows = [];
    for (const [workload, {calls, run}] of Object.entries(cases)) {
      for (let i = 0; i < calls; i++) run(i);
      for (let repetition = 0; repetition < 5; repetition++) {
        const start = performance.now();
        let checksum = 0;
        for (let i = 0; i < calls; i++) checksum += run(i);
        const ms = performance.now() - start;
        pureRows.push({workload, repetition, calls, ms, perCallMs: ms / calls, checksum});
      }
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({node: process.version, platform: process.platform,
      cpu: os.cpus()[0]?.model, source, deps, snapshotDigestsEqual: true,
      scope: 'Fresh workers for bundle and snapshot; uncontrolled OS cache. Pure cases use one warmup batch and five measured batches. No browser or video encoding. Cache experiment does not change render.mjs defaults.',
      bundleRows, snapshotRows, pureRows}, null, 2) + '\n');
    console.log(path.join(output, 'results.json'));
  } finally {fs.rmSync(work, {recursive: true, force: true});}
}
