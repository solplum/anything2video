#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=process.argv[2];
if(!target)throw new Error('Usage: node examples/lighttable/prepare.mjs <new-external-directory>');
const out=path.resolve(target);
if(out===root||out.startsWith(root+path.sep))throw new Error('Choose a directory outside the repository');
if(fs.existsSync(out))throw new Error('Refusing an existing directory');
fs.mkdirSync(path.join(out,'src/style'),{recursive:true});
for(const name of ['package.json','package-lock.json','tsconfig.json'])fs.copyFileSync(path.join(root,'template',name),path.join(out,name));
for(const name of ['Root.tsx','Scene.tsx'])fs.copyFileSync(path.join(root,'examples/lighttable',name),path.join(out,'src',name));
for(const name of ['kit.tsx','scene.mjs','scene.d.mts'])fs.copyFileSync(path.join(root,'styles/lighttable',name),path.join(out,'src/style',name));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE-anything2video.txt'));
fs.writeFileSync(path.join(out,'src/index.ts'),"import {registerRoot} from 'remotion';\nimport {Root} from './Root';\nregisterRoot(Root);\n");
console.log(out);
