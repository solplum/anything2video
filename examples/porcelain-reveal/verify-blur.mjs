#!/usr/bin/env node
/** Pixel-level check: 32px filter padding must match generous 128px padding. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {renderPorcelain} from '../../styles/porcelain-reveal/scene.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'porcelain-blur-proof-'));
fs.mkdirSync(path.join(tmp,'fonts'));fs.writeFileSync(path.join(tmp,'fonts.conf'),`<fontconfig><include>/etc/fonts/fonts.conf</include><cachedir>${tmp}/fonts</cachedir></fontconfig>`);
const env={...process.env,FONTCONFIG_FILE:path.join(tmp,'fonts.conf'),OMP_NUM_THREADS:'1'},frames=[22,24,87,90,93,138,240,419],proofs=[];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [name,w,h] of [['landscape',1280,720],['portrait',720,1280]]){
 const folders=['default','overscan'].map(mode=>{const d=path.join(tmp,name+'-'+mode);fs.mkdirSync(d);return d;});
 for(const f of frames){const svg=renderPorcelain({frame:f,width:w,height:h});fs.writeFileSync(path.join(folders[0],`${f}.svg`),svg);fs.writeFileSync(path.join(folders[1],`${f}.svg`),svg.replaceAll(`filterUnits="userSpaceOnUse" x="-32" y="-32" width="${w+64}" height="${h+64}"`,`filterUnits="userSpaceOnUse" x="-128" y="-128" width="${w+256}" height="${h+256}"`));}
 for(const folder of folders){const run=spawnSync('python',[path.join(here,'rasterize.py'),folder,String(w),String(h)],{env,encoding:'utf8'});if(run.status!==0)throw Error(run.stderr);}
 for(const frame of frames){const a=sha(path.join(folders[0],`${frame}.png`)),b=sha(path.join(folders[1],`${frame}.png`));if(a!==b)throw Error(`${name} frame ${frame} differs with larger filter padding`);proofs.push({variant:name,frame,defaultPngSha256:a,overscanPngSha256:b,equal:true});}
}
const result={sourceSha256:sha(path.join(here,'../../styles/porcelain-reveal/scene.mjs')),filterPadding:32,overscanPadding:128,proofs};fs.writeFileSync(path.join(tmp,'verification.json'),JSON.stringify(result,null,2)+'\n');console.log(`PASS: ${proofs.length} frame pairs byte-identical. Evidence: ${tmp}/verification.json`);
