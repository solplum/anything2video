#!/usr/bin/env node
// Offline shared-SVG-core study, not a native Remotion/Chromium render.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {renderQuest,QUEST} from '../../styles/choice-quest/scene.mjs';
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2])throw Error('Usage: node examples/choice-quest/render-study.mjs <external-output-directory> [--stills]');
const out=canonical(path.resolve(process.argv[2]));
if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Output must be outside the repository and not its ancestor');
fs.mkdirSync(out,{recursive:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'choice-quest-'));
fs.mkdirSync(path.join(tmp,'fontcache'));
fs.writeFileSync(path.join(tmp,'fonts.conf'),`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${tmp}/fontcache</cachedir></fontconfig>`);
const env={...process.env,FONTCONFIG_FILE:path.join(tmp,'fonts.conf'),XDG_CACHE_HOME:path.join(tmp,'cache'),OMP_NUM_THREADS:'1'};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:8e6});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr}`);if(r.stdout)console.log(r.stdout.trim());return r;};
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const stillFrames=[0,90,130,194,230,269,270,280,300,318,360,420,465,480,539];
const proofs=[];
const variants=[['choice-quest',{branch:'repair'}],['choice-quest-wait',{branch:'wait'}],['choice-quest-no-captions',{branch:'repair',showCaptions:false}],['choice-quest-late',{branch:'repair',selectSec:7}]];
for(const [name,opts] of variants){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);
 const frames=process.argv.includes('--stills')?stillFrames:Array.from({length:QUEST.frames},(_,f)=>f);
 for(const frame of frames)fs.writeFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.svg`),renderQuest({frame,...opts}));
 run('python',[path.join(import.meta.dirname,'rasterize.py'),dir]);
 const stillDir=path.join(out,'stills',name);fs.mkdirSync(stillDir,{recursive:true});
 for(const frame of stillFrames)fs.copyFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.png`),path.join(stillDir,`${String(frame).padStart(4,'0')}.png`));
 if(!process.argv.includes('--stills')){
  const video=path.join(out,`${name}.mp4`);
  run('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(dir,'%04d.png'),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video]);
  run('ffmpeg',['-v','error','-i',video,'-f','null','-']);
  const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',video]).stdout);
  proofs.push({name,options:opts,path:path.basename(video),sha256:hash(video),probe});
 }
 console.log(name+' complete');
}
fs.writeFileSync(path.join(out,'render-evidence.json'),JSON.stringify({schemaVersion:1,classification:'silent shared-SVG-core visual prototype',renderer:'System librsvg/cairo + ffmpeg',source:hash(path.join(root,'styles/choice-quest/scene.mjs')),proofs,limits:{nativeRemotion:'not_performed: Chromium launch failed with socket Operation not permitted',fullPlayback:'not_performed',audioReview:'not_performed; deliberate no-audio stream',finalFilmQC:'not_performed; this is a style prototype'}},null,2)+'\n');
console.log('Intermediate frame directory: '+tmp);
