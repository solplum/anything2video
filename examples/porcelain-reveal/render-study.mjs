#!/usr/bin/env node
// Original SVG core -> librsvg/cairo -> ffmpeg. Deliberately silent; not Remotion CLI evidence.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {renderPorcelain,PORCELAIN} from '../../styles/porcelain-reveal/scene.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=fs.realpathSync(path.resolve(here,'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2])throw Error('Usage: node examples/porcelain-reveal/render-study.mjs <external-output-directory>');
const out=canonical(path.resolve(process.argv[2]));if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Output must be external and not an ancestor');
fs.mkdirSync(out,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'porcelain-render-'));fs.mkdirSync(path.join(tmp,'fonts'));
fs.writeFileSync(path.join(tmp,'fonts.conf'),`<fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${tmp}/fonts</cachedir></fontconfig>`);
const env={...process.env,FONTCONFIG_FILE:path.join(tmp,'fonts.conf'),OMP_NUM_THREADS:'1'};
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:16e6});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr}`);return r.stdout;};
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');const proofs=[];
const variants=[['porcelain-reveal',{}],['porcelain-reveal-portrait',{width:720,height:1280}]];
for(const [name,opts] of variants.filter(([name])=>!process.argv.includes('--portrait-only')||name.endsWith('-portrait'))){
 const dir=path.join(tmp,name);fs.mkdirSync(dir);const unique=new Map(),copies=[];
 for(let frame=0;frame<PORCELAIN.frames;frame++){const svg=renderPorcelain({frame,...opts}),f=String(frame).padStart(4,'0');if(unique.has(svg))copies.push([f,unique.get(svg)]);else{unique.set(svg,f);fs.writeFileSync(path.join(dir,`${f}.svg`),svg)}}
 console.log(name,unique.size,'unique SVGs');console.log(run('python',[path.join(here,'rasterize.py'),dir,String(opts.width??1280),String(opts.height??720)]).trim());
 for(const [a,b] of copies)fs.copyFileSync(path.join(dir,`${b}.png`),path.join(dir,`${a}.png`));
 const stillDir=path.join(out,'frames',name);fs.mkdirSync(stillDir,{recursive:true});for(const frame of [0,24,45,60,90,120,150,180,210,240,270,300,330,390,419])fs.copyFileSync(path.join(dir,`${String(frame).padStart(4,'0')}.png`),path.join(stillDir,`${frame}.png`));
 const f=path.join(out,name+'.mp4');run('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(dir,'%04d.png'),'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',f]);run('ffmpeg',['-v','error','-i',f,'-f','null','-']);
 proofs.push({name,options:opts,path:path.basename(f),sha256:sha(f),probe:JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',f]))});console.log(name,'complete');
}
for(const [name,options] of variants){const f=path.join(out,name+'.mp4');if(fs.existsSync(f)&&!proofs.some(p=>p.name===name))proofs.unshift({name,options,path:path.basename(f),sha256:sha(f),probe:JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',f]))});}
fs.writeFileSync(path.join(out,'render-evidence.json'),JSON.stringify({schemaVersion:1,renderer:'librsvg/cairo + ffmpeg from shared original SVG core',sourceSha256:sha(path.join(root,'styles/porcelain-reveal/scene.mjs')),proofs,limits:{nativeRemotionCLI:'blocked: Chromium launch SIGABRT; socket() not permitted / read-only profile',continuousPlayback:'not performed',audio:'intentionally absent',fullIntegration:'not performed; isolated additive prototype'}},null,2)+'\n');console.log('Frames retained at',tmp);
