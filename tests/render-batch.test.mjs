// Orchestration tests: Remotion/browser APIs are deliberately synthetic. Video
// fixtures use FFmpeg, not browser rendering; these tests are not visual review.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {renderBatch, renderProject, validateBatchRequest} from '../scripts/render.mjs';
import {sha256File, snapshotSources} from '../scripts/runtime-lib.mjs';

const cfg = {width: 160, height: 90, fps: 24, totalFrames: 96, slug: 'film'};
const write = (root, name, value) => {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function fixture(t, settings = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a2v-render-batch-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  write(root, 'project.json', cfg);
  write(root, 'package.json', {name: 'synthetic-render-batch-fixture'});
  write(root, 'script/storyboard.json', {shots: [{id: 'A', from: 1, to: 96, group: 'G', component: 'src/A.tsx', action: 'fixture', purpose: 'unit test'}]});
  write(root, 'src/A.tsx', 'export const A = () => null;');
  write(root, 'src/index.ts', 'export {};');
  write(root, 'node_modules/typescript/bin/tsc', `const fs = require('node:fs'); fs.appendFileSync('events.log', JSON.stringify({event:'typecheck'})+'\\n'); ${settings.tsc ?? ''}`);
  write(root, 'node_modules/@remotion/bundler/package.json', {name: '@remotion/bundler', main: 'index.cjs'});
  write(root, 'node_modules/@remotion/bundler/index.cjs', `const fs = require('node:fs'), path = require('node:path'); const root = path.resolve(__dirname, '../../..'); exports.bundle = async ({outDir,enableCaching,rootDir}) => {if (enableCaching !== false || rootDir !== root) throw Error('fresh project-scoped bundle required'); fs.appendFileSync(path.join(root,'events.log'),JSON.stringify({event:'bundle',outDir})+'\\n'); ${settings.bundle ?? ''} return outDir;};`);
  write(root, 'node_modules/@remotion/renderer/package.json', {name: '@remotion/renderer', main: 'index.cjs'});
  write(root, 'node_modules/@remotion/renderer/index.cjs', `
    const fs = require('node:fs'), path = require('node:path'), {spawnSync} = require('node:child_process');
    const root = path.resolve(__dirname, '../../..'), cfg = ${JSON.stringify(cfg)};
    let count=0;
    const event = data => fs.appendFileSync(path.join(root,'events.log'), JSON.stringify(data)+'\\n');
    const browser = {close: async () => {event({event:'close'}); ${settings.close ?? ''}}};
    const shared = options => {if (options.puppeteerInstance !== browser) throw Error('browser not reused');};
    exports.openBrowser = async () => {event({event:'open'}); ${settings.open ?? ''} return browser;};
    exports.selectComposition = async options => {shared(options); event({event:'select'}); return {...cfg,durationInFrames:cfg.totalFrames,${settings.composition ?? ''}};};
    const before = () => {count++; ${settings.render ?? ''}};
    exports.renderStill = async options => {shared(options); event({event:'still',frame:options.frame}); before(); await new Promise(resolve => setTimeout(resolve, 5)); fs.writeFileSync(options.output,'SYNTHETIC still '+options.frame);};
    exports.renderMedia = async options => {shared(options); event({event:'media',frameRange:options.frameRange,composition:options.composition,codec:options.codec,crf:options.crf,pixelFormat:options.pixelFormat}); before();
      const frames = options.frameRange[1]-options.frameRange[0]+1;
      const run = spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=navy:size='+cfg.width+'x'+cfg.height+':rate='+cfg.fps,'-frames:v',String(frames${settings.extraFrames ?? ''}),'-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-y',options.outputLocation],{encoding:'utf8'});
      if (run.status!==0) throw Error(run.stderr || run.error?.message);};
  `);
  return root;
}
const events = root => fs.existsSync(path.join(root, 'events.log')) ? fs.readFileSync(path.join(root, 'events.log'), 'utf8').trim().split('\n').map(JSON.parse) : [];
const request = (id = 'r1') => ({schemaVersion: 1, id, windows: [], stills: [{id: 'last', frame: 96}, {id: 'first', frame: 1}]});
const clean = root => {
  assert.ok(!fs.readdirSync(root).some(name => name.startsWith('.render-bundle-')));
  const parent = path.join(root, 'renders/reviews');
  if (fs.existsSync(parent)) assert.ok(!fs.readdirSync(parent).some(name => name.startsWith('.render-') || name.endsWith('.render.lock')));
};
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).status === 0;

test('batch input rejects invalid ranges, IDs, duplicate selections and misspelled fields', () => {
  const window = {id: 'opening', from: 1, to: 24};
  const good = {schemaVersion: 1, id: 'review-v1', windows: [window]};
  assert.deepEqual(validateBatchRequest(cfg, good).windows, [window]);
  for (const bad of [null, [], {}, {...good, id: '../escape'}, {...good, id: '/tmp/escape'}, {...good, id: 123}, {...good, id: 'a'.repeat(81)},
    {...good, windows: null}, {...good, stills: null}, {...good, schemaVersion: 2}, {...good, typo: true}, {...good, windows: []}, {...good, allowOverlap: 'true'},
    ...[{from: 0}, {from: 1.5}, {from: '1'}, {to: 97}, {to: 0}, {from: 25}, {from: NaN}, {from: Infinity}, {id: 'a/b'}, {id: 'a\\b'}, {id: '..'}, {frames: [1,24]}].map(change => ({...good, windows: [{...window,...change}]})),
    {...good, windows: [window, {...window, id: 'Opening'}]}, {...good, stills: [{id: 'OPENING', frame: 50}]},
    {...good, stills: [{id: 'one', frame: 0}]}, {...good, stills: [{id: 'one', frame: 96}, {id: 'two', frame: 96}]},
  ]) assert.throws(() => validateBatchRequest(cfg, bad), JSON.stringify(bad));
});

test('overlap is explicit and ranges/order are never silently merged or shifted', () => {
  const input = {schemaVersion: 1, id: 'overlap', windows: [{id: 'later', from: 40, to: 70}, {id: 'earlier', from: 20, to: 40}]};
  assert.throws(() => validateBatchRequest(cfg, input), /Overlapping/);
  assert.deepEqual(validateBatchRequest(cfg, {...input, allowOverlap: true}).windows, input.windows);
  assert.doesNotThrow(() => validateBatchRequest(cfg, {...input, windows: [{id: 'a', from: 1, to: 20}, {id: 'b', from: 21, to: 40}]}));
});

test('mixed batch uses one validation/typecheck/bundle/browser and exact one-based evidence', {skip: !hasFfmpeg}, async t => {
  const root = fixture(t);
  const input = {...request(), windows: [{id: 'opening', from: 1, to: 8}, {id: 'middle', from: 40, to: 47}, {id: 'ending', from: 89, to: 96}]};
  const result = await renderBatch(root, input, {});
  assert.equal(result.outputs.length, 5);
  assert.equal(result.manifest.status, 'needs_review');
  assert.equal(result.manifest.draft, true);
  for (const key of ['planChecks', 'typechecks', 'bundles', 'browserOpens', 'compositionSelections']) assert.equal(result.manifest.metrics[key], 1, key);
  assert.ok(result.manifest.metrics.bundleMs >= 0 && result.manifest.metrics.sessionMs >= result.manifest.metrics.bundleMs);
  const recorded = events(root);
  for (const event of ['typecheck', 'bundle', 'open', 'select', 'close']) assert.equal(recorded.filter(row => row.event === event).length, 1, event);
  assert.deepEqual(recorded.filter(row => row.event === 'media').map(row => row.frameRange), [[0,7],[39,46],[88,95]]);
  assert.deepEqual(recorded.filter(row => row.event === 'still').map(row => row.frame), [95,0]);
  for (const item of result.manifest.items) {
    const media = path.join(root, item.media), delivery = json(path.join(root,item.delivery));
    assert.equal(item.mediaSha256, sha256File(media));
    assert.equal(item.deliverySha256, sha256File(media+'.delivery.json'));
    assert.equal(delivery.mediaSha256,item.mediaSha256);
    assert.deepEqual(delivery.sourceHashes,snapshotSources(root));
    assert.deepEqual(delivery.frames,item.frames);
    assert.equal(delivery.mode,item.mode);
    assert.notEqual(delivery.mode,'video');
    assert.equal(delivery.status,'needs_review');
    assert.equal(delivery.visualReview,'not_performed');
    assert.equal(delivery.audioReview,'not_performed');
    if (item.mode === 'preview') {
      const video = delivery.ffprobe.streams.find(stream => stream.codec_type === 'video');
      assert.equal(video.width,cfg.width); assert.equal(video.height,cfg.height);
      assert.equal(video.avg_frame_rate,'24/1'); assert.equal(video.nb_read_frames,'8');
    }
  }
  assert.deepEqual(json(path.join(result.directory,'batch.json')),result.manifest);
  await assert.rejects(renderBatch(root,input,{}), /already exists/);
  clean(root);
});

test('no cross-run bundle/browser reuse and no source hash pollution from previous batches', async t => {
  const root = fixture(t), before = snapshotSources(root);
  const first = await renderBatch(root,request('one'),{});
  const second = await renderBatch(root,request('two'),{});
  assert.deepEqual(first.manifest.sourceHashes,second.manifest.sourceHashes);
  assert.deepEqual(snapshotSources(root),before);
  const bundles = events(root).filter(row => row.event === 'bundle');
  assert.equal(bundles.length,2); assert.notEqual(bundles[0].outDir,bundles[1].outDir);
  assert.equal(events(root).filter(row => row.event === 'close').length,2);
  clean(root);
});

test('preflight rejects existing output file, directory, symlink and parent aliases before dependency work', async t => {
  for (const kind of ['file','directory','symlink','dangling','parent-internal','parent-external']) {
    const root = fixture(t), output = path.join(root,'renders/reviews/r1');
    fs.mkdirSync(path.dirname(output),{recursive:true});
    if (kind==='file') fs.writeFileSync(output,'prior');
    if (kind==='directory') fs.mkdirSync(output);
    if (kind==='symlink' || kind==='dangling') fs.symlinkSync(path.join(root,kind==='symlink'?'src':'missing'),output);
    if (kind.startsWith('parent-')) {
      fs.rmdirSync(path.dirname(output));
      fs.symlinkSync(kind==='parent-internal'?path.join(root,'src'):os.tmpdir(),path.dirname(output));
    }
    await assert.rejects(renderBatch(root,request(),{}),/already exists|symlink/);
    assert.deepEqual(events(root),[]);
  }
});

test('same batch ID is locked, unrelated batches have independent locks and outputs', async t => {
  const root = fixture(t);
  const same = await Promise.allSettled([renderBatch(root,request(),{}),renderBatch(root,request(),{})]);
  assert.equal(same.filter(result => result.status==='fulfilled').length,1);
  assert.match(same.find(result => result.status==='rejected').reason.message,/Render lock exists|already exists|Render already owns/);
  const others = await Promise.all([renderBatch(root,request('a'),{}),renderBatch(root,request('b'),{})]);
  assert.notEqual(others[0].directory,others[1].directory);
  clean(root);
});

test('later rendering failure publishes no partial media, closes browser and permits explicit retry', async t => {
  const root = fixture(t,{render:"if (count===2) throw Error('deliberate later-item failure');"});
  await assert.rejects(renderBatch(root,request(),{}),/later-item failure/);
  assert.ok(!fs.existsSync(path.join(root,'renders/reviews/r1')));
  assert.equal(events(root).filter(row => row.event==='close').length,1);
  clean(root);
  // The retry is smaller and explicit; no failed output directory was published.
  const result = await renderBatch(root,{...request(),stills:[{id:'first',frame:1}]},{});
  assert.equal(result.outputs.length,1);
  clean(root);
});

test('source edits during typecheck, bundle, rendering or browser close reject the whole batch', async t => {
  for (const settings of [
    {tsc:"fs.appendFileSync('src/A.tsx','// edit');"},
    {bundle:"fs.appendFileSync(path.join(root,'src/A.tsx'),'// edit');"},
    {render:"if (count===2) fs.appendFileSync(path.join(root,'src/A.tsx'),'// edit');"},
    {close:"fs.appendFileSync(path.join(root,'src/A.tsx'),'// edit');"},
  ]) {
    const root = fixture(t,settings);
    await assert.rejects(renderBatch(root,request(),{}),/Sources changed/);
    assert.ok(!fs.existsSync(path.join(root,'renders/reviews/r1')));
    clean(root);
  }
});

test('parsed project config is bound to exact original bytes before the first source snapshot', async t => {
  const root = fixture(t), config = path.join(root,'project.json'), original = fs.readFileSync;
  let edited = false;
  fs.readFileSync = function(file,...args) {
    const bytes = original.call(this,file,...args);
    if (file===config && !edited) {edited=true; fs.writeFileSync(config,JSON.stringify({...cfg,status:'changed-after-read'}));}
    return bytes;
  };
  let result;
  try {result=renderBatch(root,request(),{});} finally {fs.readFileSync=original;}
  await assert.rejects(result,/Sources changed after project configuration/);
  assert.deepEqual(events(root),[]);
  clean(root);
});

test('composition and actual encoded frame-count mismatch reject before publication', {skip: !hasFfmpeg}, async t => {
  for (const settings of [{composition:'width: 999'}, {extraFrames:'+1'}]) {
    const root = fixture(t,settings);
    await assert.rejects(renderBatch(root,{schemaVersion:1,id:'bad',windows:[{id:'opening',from:1,to:8}]},{}),/does not match/);
    assert.ok(!fs.existsSync(path.join(root,'renders/reviews/bad')));
    assert.equal(events(root).filter(row => row.event==='close').length,1);
    clean(root);
  }
});

test('finalize is inside transaction; hook failure, source edits or evidence tampering publish nothing', async t => {
  for (const finalize of [
    async () => {throw Error('packet generation failed');},
    async ({directory}) => {fs.appendFileSync(path.resolve(directory,'../../..','src/A.tsx'),'// edit');},
    async ({directory}) => {fs.appendFileSync(path.join(directory,'last.png'),'changed');},
    async ({directory}) => {fs.appendFileSync(path.join(directory,'batch.json'),'changed');},
  ]) {
    const root = fixture(t);
    await assert.rejects(renderBatch(root,request(),{}, {finalize}),/packet generation failed|Sources changed|changed before publication/);
    assert.ok(!fs.existsSync(path.join(root,'renders/reviews/r1')));
    clean(root);
  }
});

test('finalizer sees complete manifest after browser closes and only publishes once callback succeeds', async t => {
  const root = fixture(t);
  const result = await renderBatch(root,request(),{}, {finalize:async ({directory,manifest}) => {
    assert.equal(events(root).at(-1).event,'close');
    assert.ok(!fs.existsSync(path.join(root,'renders/reviews/r1')));
    assert.equal(manifest.items.length,2);
    write(directory,'checklist.md','Needs real playback and audio review.');
    manifest.items[0].mediaSha256='changed callback clone';
  }});
  assert.ok(fs.existsSync(path.join(result.directory,'checklist.md')));
  assert.notEqual(result.manifest.items[0].mediaSha256,'changed callback clone');
  clean(root);
});

test('batch CLI records request file hash and rejects changes even in snapshot-excluded qc', async t => {
  const root = fixture(t), input = request();
  write(root,'qc/batch.json',input);
  const result = await renderProject(root,['batch','qc/batch.json'],{});
  assert.equal(result.manifest.inputRequest.path,'qc/batch.json');
  assert.equal(result.manifest.inputRequest.sha256,sha256File(path.join(root,'qc/batch.json')));
  const newer = request('new'); write(root,'qc/next.json',newer);
  await assert.rejects(renderBatch(root,newer,{}, {requestFile:'qc/next.json',finalize:async () => {write(root,'qc/next.json',{...newer,id:'edited'});}}),/request changed/);
  assert.ok(!fs.existsSync(path.join(root,'renders/reviews/new')));
  for (const args of [['batch'],['batch','qc/batch.json','--overwrite'],['batch','../escape.json']]) await assert.rejects(renderProject(root,args,{}));
  clean(root);
});

test('batch retains storyboard and typecheck gates, including malformed plan diagnostics', async t => {
  for (const malformed of [{shots:null}, {shots:[]}, '{broken']) {
    const root=fixture(t); write(root,'script/storyboard.json',malformed);
    await assert.rejects(renderBatch(root,request(),{}),/Storyboard gate failed/);
    assert.deepEqual(events(root),[]); clean(root);
  }
  const root=fixture(t,{tsc:"process.exit(2);"});
  await assert.rejects(renderBatch(root,request(),{}),/TypeScript gate failed/);
  assert.equal(events(root).filter(row=>row.event==='bundle').length,0); clean(root);
});


test('last input verification is synchronous and remains inside atomic publication', async t => {
  for (const verifyInputs of [() => {throw Error('request replaced');}, async () => {throw Error('invalid async verifier');}]) {
    const root = fixture(t);
    await assert.rejects(renderBatch(root,request(),{}, {verifyInputs}), /request replaced|must be synchronous/);
    assert.ok(!fs.existsSync(path.join(root,'renders/reviews/r1')));
    clean(root);
  }
});
