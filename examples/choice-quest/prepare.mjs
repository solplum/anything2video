#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..'));
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
if(!process.argv[2]||process.argv.length!==3)throw Error('Usage: node examples/choice-quest/prepare.mjs <new-external-directory>');
const out=canonical(path.resolve(process.argv[2]));
if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep))throw Error('Choose an external directory, not a repository ancestor');
if(fs.existsSync(out))throw Error('Refusing an existing directory');
fs.mkdirSync(out,{recursive:true});
for(const dir of ['styles/choice-quest','examples/choice-quest'])fs.mkdirSync(path.join(out,dir),{recursive:true});
for(const file of ['package.json','package-lock.json'])fs.copyFileSync(path.join(root,'template',file),path.join(out,file));
fs.writeFileSync(path.join(out,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',esModuleInterop:true,resolveJsonModule:true,strict:true,skipLibCheck:true,noEmit:true},include:['styles/**/*.tsx','styles/**/*.mts','examples/**/*.tsx']},null,2)+'\n');
for(const file of ['scene.mjs','scene.d.mts','kit.tsx'])fs.copyFileSync(path.join(root,'styles/choice-quest',file),path.join(out,'styles/choice-quest',file));
fs.copyFileSync(path.join(import.meta.dirname,'Root.tsx'),path.join(out,'examples/choice-quest/Root.tsx'));
fs.copyFileSync(path.join(import.meta.dirname,'storyboard.json'),path.join(out,'examples/choice-quest/storyboard.json'));
fs.copyFileSync(path.join(root,'LICENSE'),path.join(out,'LICENSE'));
console.log(out);
