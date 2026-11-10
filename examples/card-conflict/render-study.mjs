#!/usr/bin/env node
// Shared-SVG-core visual proof. Native Remotion render is a separately reported check.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {renderDuel,SCENARIOS,DUEL} from '../../styles/card-conflict/scene.mjs';
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
const out=path.resolve(process.argv[2]||'');if(!process.argv[2]||out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Specify output directory outside the source tree');
fs.mkdirSync(out,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'card-conflict-'));
fs.mkdirSync(path.join(tmp,'fontcache'));fs.writeFileSync(path.join(tmp,'fonts.conf'),`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${tmp}/fontcache</cachedir></fontconfig>`);
const env={...process.env,FONTCONFIG_FILE:path.join(tmp,'fonts.conf'),XDG_CACHE_HOME:path.join(tmp,'cache'),OMP_NUM_THREADS:'1'};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:8e6});if(r.status!==0)throw Error(`${cmd}: ${r.stderr}`);return r.stdout;};
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sourceHashes=Object.fromEntries(['scene.mjs','engine.mjs','scenarios.mjs'].map(f=>[f,hash(path.join(root,'styles/card-conflict',f))]));
const variants=[['card-conflict-lighthouse',{scenario:SCENARIOS.lighthouse,choice:'brace'}],['card-conflict-counterfactual',{scenario:SCENARIOS.lighthouse,choice:'rush'}],['card-conflict-greenhouse',{scenario:SCENARIOS.greenhouse,choice:'warm'}],['card-conflict-labels-hidden',{scenario:SCENARIOS.lighthouse,choice:'brace',showCaptions:false}]];
const proofs=[];
for(const [name,opts] of variants){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);for(let frame=0;frame<DUEL.frames;frame++)fs.writeFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.svg`),renderDuel({frame,...opts}));
 run('python',[path.join(import.meta.dirname,'rasterize.py'),dir]);
 const stills=path.join(out,'stills',name);fs.mkdirSync(stills,{recursive:true});for(const frame of [0,90,119,120,150,179,180,240,270,285,299,300,310,330,360,479])fs.copyFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.png`),path.join(stills,`${frame}.png`));
 const video=path.join(out,name+'.mp4');run('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(dir,'%04d.png'),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video]);
 run('ffmpeg',['-v','error','-i',video,'-f','null','-']);const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',video]));
 proofs.push({name,scenario:opts.scenario.id,choice:opts.choice,showCaptions:opts.showCaptions??true,sha256:hash(video),probe});console.log(name+' rendered and decoded');
}
for(const [file,digest] of Object.entries(sourceHashes))if(hash(path.join(root,'styles/card-conflict',file))!==digest)throw Error('Source changed during rendering: '+file);
fs.writeFileSync(path.join(out,'render-evidence.json'),JSON.stringify({schemaVersion:1,classification:'silent shared-SVG-core card conflict prototype',renderer:'system librsvg / cairo + ffmpeg',sourceHashes,proofs,limits:{nativeRemotion:'reported separately',browserInteraction:'reported separately',fullContinuousHumanPlayback:'not performed',audio:'deliberately absent',portrait:'not implemented; rejects incompatible aspect ratio'}},null,2)+'\n');
console.log('Intermediate frames: '+tmp);
