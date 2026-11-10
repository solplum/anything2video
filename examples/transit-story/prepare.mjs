#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2])throw Error('Usage: node examples/transit-story/prepare.mjs <new-external-directory>');
const out=canonical(path.resolve(process.argv[2]));
if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Choose a directory outside the repository and not an ancestor');
if(fs.existsSync(out))throw Error('Refusing an existing directory');
fs.mkdirSync(path.join(out,'src/style'),{recursive:true});
for(const name of ['package.json','package-lock.json','tsconfig.json'])fs.copyFileSync(path.join(root,'template',name),path.join(out,name));
for(const name of ['kit.tsx','scene.mjs','scene.d.mts'])fs.copyFileSync(path.join(root,'styles/transit-story',name),path.join(out,'src/style',name));
fs.writeFileSync(path.join(out,'src/index.tsx'),fs.readFileSync(path.join(import.meta.dirname,'Root.tsx'),'utf8').replace('../../styles/transit-story/kit','./style/kit'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE-anything2video.txt'));
console.log(out);
