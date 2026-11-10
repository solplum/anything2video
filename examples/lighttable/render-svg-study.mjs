#!/usr/bin/env node
// SVG-only fallback proof. This is not the production Remotion renderer.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderLighttable} from '../../styles/lighttable/scene.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.argv[2]??'');
if(!process.argv[2]||out===root||out.startsWith(root+path.sep)) throw new Error('Usage: node examples/lighttable/render-svg-study.mjs <output-outside-repository>');
fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lighttable-'));
const run=(cmd,args)=>new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:['ignore','ignore','pipe'],env:{...process.env,OMP_NUM_THREADS:'1',INKSCAPE_PROFILE_DIR:path.join(temp,'profile'),XDG_CACHE_HOME:path.join(temp,'cache')}});let error='';p.stderr.on('data',s=>error+=s);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(error)));});
const results={renderer:'Inkscape shared SVG-core rasterization + ffmpeg',audio:'none',fps:30,frames:360,variants:{}};
for(const [name,width,height] of [['landscape',1280,720],['portrait',720,1280]]) {
 const dir=path.join(temp,name);fs.mkdirSync(dir);
 const unique=new Map(), frames=[];
 for(let frame=0;frame<360;frame++){const svg=renderLighttable({frame,width,height}),f=String(frame).padStart(3,'0');if(!unique.has(svg)){unique.set(svg,f);fs.writeFileSync(path.join(dir,`${f}.svg`),svg);}frames.push({f,source:unique.get(svg)});}
 const queue=[...unique.values()];let cursor=0;
 await Promise.all(Array.from({length:4},async()=>{while(cursor<queue.length){const f=queue[cursor++];await run('inkscape',['--export-type=png',`--export-filename=${dir}/${f}.png`,`${dir}/${f}.svg`]);}}));
 for(const {f,source} of frames)if(f!==source)fs.copyFileSync(path.join(dir,`${source}.png`),path.join(dir,`${f}.png`));
 await run('ffmpeg',['-y','-v','error','-framerate','30','-i',`${dir}/%03d.png`,'-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,`${name}.mp4`)]);
 for(const frame of [0,60,105,165,240,315,359])fs.copyFileSync(path.join(dir,`${String(frame).padStart(3,'0')}.png`),path.join(out,`${name}-${String(frame).padStart(3,'0')}.png`));
 results.variants[name]={width,height};console.log(name+' complete');
}
fs.writeFileSync(path.join(out,'svg-capture-verification.json'),JSON.stringify(results,null,2)+'\n');
console.log('Intermediate SVG/PNG frames: '+temp);
