/** Offline fallback proof of the SAME artwork component, not a Remotion/Chromium encode. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const canonical=p=>fs.existsSync(p)?fs.realpathSync(p):path.join(canonical(path.dirname(p)),path.basename(p));
const root=fs.realpathSync(path.resolve(import.meta.dirname,'../..')), work=canonical(path.resolve(process.argv[2]??''));
if(!process.argv[2]) throw Error('Usage: node render-component-proof.mjs /absolute/external/workspace');
if(work===root||work.startsWith(root+path.sep)||root.startsWith(work+path.sep))throw Error('Workspace must be external and not a repository ancestor');
const require=createRequire(path.join(work,'package.json'));
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const build=path.join(work,'component-build');
for(const dir of ['template/src/shots/character-action','template/src/common/riso']){
 for(const f of fs.readdirSync(path.join(root,dir))){if(!/\.tsx?$/.test(f))continue;
  const target=path.join(build,dir,f.replace(/\.tsx?$/,'.js'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(root,dir,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText);
 }
}
const {CharacterActionFrame}=require(path.join(build,'template/src/shots/character-action/Demo.js'));
const render=(frame,contactSec)=>renderToStaticMarkup(React.createElement(CharacterActionFrame,{frame,fps:30,contactSec}));
for(const [name,file] of [['baseline','storyboard.json'],['late-contact','storyboard.late-contact.json']]){
 const plan=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,file),'utf8'));
 const contactSec=(plan.shots[0].story.actions[0].phases.contact[0]-1)/30;
 const out=path.join(work,'component-proof',name);fs.mkdirSync(out,{recursive:true});
 for(let frame=0;frame<240;frame++){
  fs.writeFileSync(path.join(out,`${String(frame).padStart(4,'0')}.svg`),render(frame,contactSec));
  if(frame%60===0)console.log(name,frame);
 }

 const raster=spawnSync('python',[path.join(import.meta.dirname,'rasterize-svg.py'),out],{stdio:'inherit'});
 if(raster.status!==0)throw Error('System SVG rasterization failed');
 const result=spawnSync('ffmpeg',['-y','-v','error','-framerate','30','-i',path.join(out,'%04d.png'),'-c:v','libx264','-threads','1','-crf','18','-pix_fmt','yuv420p','-an',path.join(work,'component-proof',`${name}.mp4`)],{stdio:'inherit'});
 if(result.status!==0)throw Error('ffmpeg failed');
}
console.log('Offline component-frame proof completed; native Remotion browser render remains separate.');
