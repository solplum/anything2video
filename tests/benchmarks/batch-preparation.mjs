#!/usr/bin/env node
// Browser-free preparation diagnostic: NEVER rendering throughput or FPS.
// node measure.mjs REPOSITORY NEW_RESULTS_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const script = fileURLToPath(import.meta.url);
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = (root, prefix = '') => fs.readdirSync(path.join(root, prefix), {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry => entry.isDirectory() ? files(root,path.join(prefix,entry.name)) : [path.join(prefix,entry.name)]);
if (process.argv[2] === '--worker') {
  const [project, output] = process.argv.slice(3);
  const require = createRequire(path.join(project, 'package.json'));
  const start = performance.now();
  const typeStart = performance.now();
  const tsc = spawnSync(process.execPath,[path.join(project,'node_modules/typescript/bin/tsc'),'--noEmit'], {cwd:project,encoding:'utf8'});
  if (tsc.status !== 0) throw new Error(tsc.stderr || tsc.stdout || tsc.error?.message);
  const typecheckMs = performance.now()-typeStart;
  const {bundle} = require('@remotion/bundler');
  const bundleStart = performance.now();
  await bundle({entryPoint:path.join(project,'src/index.ts'),rootDir:project,outDir:output,enableCaching:false});
  const bundleMs = performance.now()-bundleStart;
  const preparationWorkerMs = performance.now()-start;
  const outputFiles = files(output);
  console.log(JSON.stringify({typecheckMs,bundleMs,stageSumMs:typecheckMs+bundleMs,preparationWorkerMs,maxRssKiB:process.resourceUsage().maxRSS,outputFiles:outputFiles.length,outputBytes:outputFiles.reduce((sum,f)=>sum+fs.statSync(path.join(output,f)).size,0),outputDigest:createHash('sha256').update(JSON.stringify(outputFiles.map(f=>[f,hash(path.join(output,f))]))).digest('hex')}));
} else {
  if (process.argv.length !== 4) throw new Error('Usage: node measure.mjs REPOSITORY NEW_RESULTS_DIRECTORY');
  const repo=fs.realpathSync(process.argv[2]), destination=path.resolve(process.argv[3]);
  fs.mkdirSync(destination); // Refuse existing result paths.
  const project=path.join(destination,'frozen-project'); fs.mkdirSync(project);
  for (const name of ['src','public','package.json','package-lock.json','tsconfig.json']) fs.cpSync(path.join(repo,'template',name),path.join(project,name),{recursive:true});
  const inputFiles=files(project), inputHashes=Object.fromEntries(inputFiles.map(f=>[f,hash(path.join(project,f))]));
  fs.writeFileSync(path.join(destination,'input-hashes.json'),JSON.stringify(inputHashes,null,2)+'\n');
  fs.mkdirSync(path.join(project,'node_modules'));
  // Do not link node_modules wholesale: a private .cache must never touch source caches.
  for (const name of fs.readdirSync(path.join(repo,'template/node_modules'))) if(name!=='.cache') fs.symlinkSync(path.join(repo,'template/node_modules',name),path.join(project,'node_modules',name),'dir');
  const version=name=>JSON.parse(fs.readFileSync(path.join(repo,'template/node_modules',name,'package.json'),'utf8')).version;
  const execute=(label)=>{
    const output=path.join(destination,'bundles',label); fs.mkdirSync(output,{recursive:true});
    const started=performance.now();
    const result=spawnSync(process.execPath,[script,'--worker',project,output],{encoding:'utf8'});
    const wallMs=performance.now()-started;
    if(result.status!==0) throw new Error(result.stderr||result.stdout||result.error?.message);
    const row={label,wallMs,...JSON.parse(result.stdout.trim().split('\n').at(-1))};
    fs.appendFileSync(path.join(destination,'rows.jsonl'),JSON.stringify(row)+'\n');
    console.log(JSON.stringify(row));
    return row;
  };
  const startedAt=new Date().toISOString();
  const warmup=execute('warmup-unmeasured');
  const groups=[];
  for(let repetition=0;repetition<3;repetition++) {
    for(const variant of (repetition%2?['batch1','separate3']:['separate3','batch1'])) {
      const runs=[];
      for(let item=0;item<(variant==='batch1'?1:3);item++) runs.push(execute(`r${repetition}-${variant}-${item}`));
      const sum=key=>runs.reduce((v,r)=>v+r[key],0);
      groups.push({repetition,variant,preparations:runs.length,typecheckMs:sum('typecheckMs'),bundleMs:sum('bundleMs'),stageSumMs:sum('stageSumMs'),preparationWorkerMs:sum('preparationWorkerMs'),wallMs:sum('wallMs'),runs});
    }
  }
  const postHashes=Object.fromEntries(inputFiles.map(f=>[f,hash(path.join(project,f))]));
  if(JSON.stringify(inputHashes)!==JSON.stringify(postHashes)) throw new Error('Frozen inputs changed');
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const stats=variant=>Object.fromEntries(['typecheckMs','bundleMs','stageSumMs','preparationWorkerMs','wallMs'].map(key=>[key,median(groups.filter(g=>g.variant===variant).map(g=>g[key]))]));
  const medians={separate3:stats('separate3'),batch1:stats('batch1')};
  const summary={stageSumSavedMs:medians.separate3.stageSumMs-medians.batch1.stageSumMs,stageSumReductionPercent:100*(1-medians.batch1.stageSumMs/medians.separate3.stageSumMs),bundleSavedMs:medians.separate3.bundleMs-medians.batch1.bundleMs};
  const result={schemaVersion:1,startedAt,finishedAt:new Date().toISOString(),sourceCommit:spawnSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).stdout.trim(),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,remotion:version('@remotion/bundler'),typescript:version('typescript'),inputFileCount:inputFiles.length,inputBytes:inputFiles.reduce((s,f)=>s+fs.statSync(path.join(project,f)).size,0),inputManifestSha256:hash(path.join(destination,'input-hashes.json')),inputsUnchanged:true,scope:'Preparation only. Each preparation invokes actual local TypeScript --noEmit followed by official @remotion/bundler with enableCaching:false. Three separate preparations versus one preparation for a hypothetical 3-item batch; actual renderBatch session counts are independently instrumented by tests. No production render path, browser, composition selection, rasterization, video encoding, review packet, source snapshot, gate timing, rendering FPS or end-to-end render time is measured.',method:'Same frozen template source and dependency versions, same machine. One unmeasured worker warmup. Three paired repetitions, alternating group order AB/BA/AB. Fresh process and output directory for each preparation. Private node_modules directory excludes shared .cache; caching disabled. OS filesystem cache uncontrolled and likely warm, not disk-cold. Stage sum excludes module import, process startup, output hashing, cleanup; wall includes output hashing. Worker maxRSS excludes tsc child peak. Coordinated no CPU-heavy project tests during measurements; host-wide load not instrumented.',warmup,groups,medians,summary};
  fs.writeFileSync(path.join(destination,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({result:path.join(destination,'results.json'),medians,summary}));
}
