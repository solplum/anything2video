import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));

test('engraving sample evidence matches current source, fonts and published media', () => {
  const verification = read('examples/engraving/verification.json');
  for (const [variant, media] of [['landscape','samples/engraving-sample.mp4'], ['portrait','examples/engraving/portrait.mp4']]) {
    const evidence = read(`examples/engraving/${variant}.delivery.json`);
    assert.equal(hash(path.join(root,media)),evidence.mediaSha256);
    assert.equal(verification.videos.find(v=>v.path===media).sha256,evidence.mediaSha256);
    for (const [rendered,source] of Object.entries({
      'src/Root.tsx':'examples/engraving/Root.tsx',
      'src/Scene.tsx':'examples/engraving/Scene.tsx',
      'src/style/kit.tsx':'styles/engraving/kit.tsx',
      'src/style/engine/index.js':'styles/engraving/engine/index.js',
      'src/style/engine/burin.js':'styles/engraving/engine/burin.js',
      'public/fonts/NotoSerifSC.ttf':'template/public/fonts/NotoSerifSC[wght].ttf',
      'public/fonts/Fraunces.ttf':'template/public/fonts/Fraunces[SOFT,WONK,opsz,wght].ttf',
    })) assert.equal(hash(path.join(root,source)),evidence.sourceHashes[rendered],`${variant}: stale ${source}`);
    const video = evidence.ffprobe.streams.find(s=>s.codec_type==='video');
    assert.equal(Number(video.nb_frames),360);
    assert.equal(video.r_frame_rate,'30/1');
    assert.deepEqual([video.width,video.height],variant==='portrait'?[720,1280]:[1280,720]);
  }
});

test('fresh engraving examples include both layouts and complete code/font license records', t => {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'a2v-engraving-example-'));
  t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  for (const portrait of [false,true]) {
    const out=path.join(tmp,portrait?'portrait':'landscape');
    execFileSync(process.execPath,[path.join(root,'examples/engraving/prepare.mjs'),out,...(portrait?['--portrait']:[])]);
    const project=JSON.parse(fs.readFileSync(path.join(out,'project.json'),'utf8'));
    assert.deepEqual([project.width,project.height],portrait?[720,1280]:[1280,720]);
    assert.equal(project.totalFrames,360);
    for(const file of ['LICENSE-anything2video.txt','LICENSE-lemo-opuscar.txt','UPSTREAM-engraving.md','public/fonts/LICENSE-NotoSerifSC-OFL.txt','public/fonts/LICENSE-Fraunces-OFL.txt','src/style/engine/burin.js']) assert.ok(fs.statSync(path.join(out,file)).size>0,file);
    assert.equal(hash(path.join(out,'src/Scene.tsx')),hash(path.join(root,'examples/engraving/Scene.tsx')));
  }
});
