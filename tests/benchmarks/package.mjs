#!/usr/bin/env node
// Compare package implementations against one frozen source tree. No downloads,
// privileged cache flushing, benchmark thresholds, or persistent digest caches.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

const script = fileURLToPath(import.meta.url);
if (process.argv[2] === '--worker') {
  const [mode, module, source, destination, profile] = process.argv.slice(3);
  const {buildPackage, verifyPackage, collectCoreFiles} = await import(pathToFileURL(module));
  const start = performance.now();
  let result;
  if (mode === 'build') result = buildPackage(destination, {source, profile});
  else if (mode === 'verify') result = verifyPackage(destination);
  else if (mode === 'collect') result = collectCoreFiles(source, {profile});
  else throw new Error(`Unknown benchmark mode: ${mode}`);
  console.log(JSON.stringify({mode, profile, ms: performance.now() - start,
    maxRssKiB: process.resourceUsage().maxRSS, count: Array.isArray(result) ? result.length : undefined}));
} else {
  const args = process.argv.slice(2);
  const options = {};
  while (args.length) {
    const name = args.shift();
    if (!['--source', '--baseline', '--candidate', '--work-dir', '--output', '--runs'].includes(name) || options[name] || !args[0]) {
      throw new Error('Usage: node tests/benchmarks/package.mjs --source <frozen-tree> --baseline <build-editions.mjs> --candidate <build-editions.mjs> --output <results.json> [--work-dir <existing-dir>] [--runs 5]');
    }
    options[name] = args.shift();
  }
  for (const name of ['--source', '--baseline', '--candidate', '--output']) if (!options[name]) throw new Error(`Missing ${name}`);
  const source = fs.realpathSync(options['--source']);
  const variants = Object.fromEntries(['baseline', 'candidate'].map(name => [name, fs.realpathSync(options[`--${name}`])]));
  const runs = Number(options['--runs'] ?? 5);
  if (!Number.isInteger(runs) || runs < 1 || runs > 100) throw new Error('--runs must be 1..100');
  const work = fs.mkdtempSync(path.join(fs.realpathSync(options['--work-dir'] ?? os.tmpdir()), 'a2v-package-bench-'));
  const results = [];
  const manifests = new Map();
  try {
    for (const profile of ['core', 'full']) {
      for (let repetition = 0; repetition < runs; repetition++) {
        const order = repetition % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
        for (const variant of order) {
          const destination = path.join(work, `${profile}-${variant}`);
          for (const mode of ['build', 'verify', 'collect']) {
            const run = spawnSync(process.execPath, [script, '--worker', mode, variants[variant], source, destination, profile], {encoding: 'utf8'});
            if (run.status !== 0) throw new Error(run.stderr || run.stdout || run.error?.message);
            const row = {variant, repetition, ...JSON.parse(run.stdout)};
            results.push(row);
            console.log(JSON.stringify(row));
          }
          const manifest = fs.readFileSync(path.join(destination, 'package-manifest.json'), 'utf8');
          if (manifests.has(profile) && manifests.get(profile) !== manifest) throw new Error(`Non-identical ${profile} manifest across implementations/repetitions`);
          manifests.set(profile, manifest);
          fs.rmSync(destination, {recursive: true});
        }
      }
    }
    fs.writeFileSync(options['--output'], JSON.stringify({node: process.version, platform: process.platform, arch: process.arch,
      cpus: os.cpus().length, source, variants, runs, identicalManifests: true,
      cache: 'Every measured task is a fresh Node process; source filesystem cache is uncontrolled, not OS-cold. Fresh build destinations. No process/JIT warmup. Module import and cleanup excluded from elapsed time; peak RSS covers the whole worker.',
      results}, null, 2) + '\n', {flag: 'wx'});
  } finally {fs.rmSync(work, {recursive: true, force: true});}
}
