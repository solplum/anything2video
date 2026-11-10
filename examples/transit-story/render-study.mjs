#!/usr/bin/env node
// Shared original SVG core -> system librsvg/cairo -> ffmpeg. Not a Remotion render.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
import {renderTransit,TRANSIT} from '../../styles/transit-story/scene.mjs';
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2])throw Error('Usage: node examples/transit-story/render-study.mjs <external-output-directory> [--stills]');
const out=canonical(path.resolve(process.argv[2]));
if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Output must be outside repository and not its ancestor');
fs.mkdirSync(out,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'transit-story-'));
fs.mkdirSync(path.join(tmp,'fontcache'));fs.writeFileSync(path.join(tmp,'fonts.conf'),`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${tmp}/fontcache</cachedir></fontconfig>`);
const env={...process.env,FONTCONFIG_FILE:path.join(tmp,'fonts.conf'),XDG_CACHE_HOME:path.join(tmp,'cache'),OMP_NUM_THREADS:'1'};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:16e6});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr}`);return r.stdout;};
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const stillFrames=[0,90,180,240,276,290,309,335,370,450,539],proofs=[];
const variants=[['transit-story',{}],['transit-story-portrait',{width:720,height:1280}],['transit-story-delayed',{delay:2.3}],['transit-story-blocked',{blocked:true}],['transit-story-no-captions',{showCaptions:false}]];
for(const [name,opts] of variants){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);const width=opts.width??1280,height=opts.height??720;
 const frames=process.argv.includes('--stills')?stillFrames:Array.from({length:TRANSIT.frames},(_,f)=>f),unique=new Map(),copies=[];
 for(const frame of frames){const svg=renderTransit({frame,...opts}),f=String(frame).padStart(4,'0');if(!unique.has(svg)){unique.set(svg,f);fs.writeFileSync(path.join(dir,`${f}.svg`),svg);}else copies.push([f,unique.get(svg)]);}
 console.log(run('python',[path.join(import.meta.dirname,'rasterize.py'),dir,String(width),String(height)]).trim());
 for(const [target,source] of copies)fs.copyFileSync(path.join(dir,`${source}.png`),path.join(dir,`${target}.png`));
 const stillDir=path.join(out,'stills',name);fs.mkdirSync(stillDir,{recursive:true});
 for(const frame of stillFrames)fs.copyFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.png`),path.join(stillDir,`${String(frame).padStart(4,'0')}.png`));
 if(!process.argv.includes('--stills')){const file=path.join(out,`${name}.mp4`);run('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(dir,'%04d.png'),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',file]);run('ffmpeg',['-v','error','-i',file,'-f','null','-']);const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]));proofs.push({name,options:opts,path:path.basename(file),sha256:hash(file),probe});}
 console.log(name+' complete');
}
fs.writeFileSync(path.join(out,'render-evidence.json'),JSON.stringify({schemaVersion:1,classification:'original silent transit-map narrative prototype',renderer:'System librsvg/cairo + ffmpeg; same SVG source as React wrapper',source:hash(path.join(root,'styles/transit-story/scene.mjs')),proofs,limits:{nativeRemotion:'not_performed',browserParity:'not_performed',continuousPlayback:'not_performed',audioReview:'not_applicable; deliberate no-audio stream',fullRepositoryRegression:'not_performed; isolated prototype',finalFilmQC:'not_performed'}},null,2)+'\n');console.log('Intermediate frames: '+tmp);
