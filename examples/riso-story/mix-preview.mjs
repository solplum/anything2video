#!/usr/bin/env node
// Synchronize existing licensed recordings with this narrative; never emits a distributable raw soundtrack.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const [input,output]=process.argv.slice(2);
if(!input||!output||process.argv.length!==4)throw new Error('Usage: node examples/riso-story/mix-preview.mjs <silent-36s.mp4> <new-preview.mp4>');
if(fs.existsSync(output))throw new Error('Refusing to overwrite output');
const music=path.join(repo,'assets/audio/bgm/classical-vibes-2-684.mp3');
const paper=path.join(repo,'assets/audio/sfx/paper/paper-page-turn.mp3');
const move=path.join(repo,'assets/audio/sfx/paper/paper-move-quick.mp3');
for(const f of [input,music,paper,move])if(!fs.existsSync(f))throw new Error('Missing '+f);
const filter='[1:a]atrim=0:36,asetpts=PTS-STARTPTS,volume=0.7,afade=t=in:st=0:d=0.5,afade=t=out:st=33.5:d=2.5[m];'+
 '[2:a]atrim=0:2,asetpts=PTS-STARTPTS,volume=0.28,adelay=13000|13000[p];'+
 '[3:a]atrim=0:1,asetpts=PTS-STARTPTS,volume=0.2,adelay=22000|22000[q];'+
 '[m][p][q]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=0[a]';
const result=spawnSync('ffmpeg',['-v','error','-i',path.resolve(input),'-i',music,'-i',paper,'-i',move,'-filter_complex',filter,'-map','0:v:0','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k','-t','36','-movflags','+faststart',path.resolve(output)],{stdio:'inherit'});
if(result.status!==0)throw new Error(`FFmpeg failed: ${result.status}`);
console.log(output+' (technical mix; listening review required)');
