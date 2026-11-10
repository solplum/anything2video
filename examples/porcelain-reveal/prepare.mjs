#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2])throw Error('Usage: node examples/porcelain-reveal/prepare.mjs <new-external-directory>');
const out=canonical(path.resolve(process.argv[2]));
if(fs.existsSync(out)||out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Choose a new external directory, not repository, descendant or ancestor');
fs.mkdirSync(path.join(out,'src/style'),{recursive:true});
for(const f of ['package.json','package-lock.json','tsconfig.json'])fs.copyFileSync(path.join(root,'template',f),path.join(out,f));
for(const f of ['kit.tsx','scene.mjs','scene.d.mts'])fs.copyFileSync(path.join(root,'styles/porcelain-reveal',f),path.join(out,'src/style',f));
fs.copyFileSync(path.join(root,'examples/porcelain-reveal/Root.tsx'),path.join(out,'src/Root.tsx'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE-anything2video.txt'));
fs.writeFileSync(path.join(out,'src/index.ts'),"import {registerRoot} from 'remotion';import {Root} from './Root';registerRoot(Root);\n");console.log(out);
