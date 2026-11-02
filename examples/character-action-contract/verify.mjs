import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {checkStoryActionEdit} from '../../scripts/story-contract-lib.mjs';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..');
const external=process.argv[2];
if(!external) throw Error('Usage: node verify.mjs /absolute/render/workspace [--write]');
const require=createRequire(path.join(path.resolve(external),'package.json'));
const ts=require('typescript');
const source=fs.readFileSync(path.join(root,'template/src/shots/character-action/timing.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {createCharacterAction}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const timing={schemaVersion:1,frameConvention:'1-based-inclusive',fps:30,totalFrames:240,variants:{}};
for(const [name,contactSec] of [['baseline',3],['lateContact',3.5]]){
 const clock=createCharacterAction(30,{contactSec});
 timing.variants[name]={contactSec,phases:clock.phases};
 const plan=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,name==='baseline'?'storyboard.json':'storyboard.late-contact.json'),'utf8'));
 assert.deepEqual(plan.shots[0].story.actions[0].phases,clock.phases,'Storyboard phases drift');
 assert.equal((plan.shots[0].story.actions[0].phases.contact[0]-1)/30,contactSec);
 let prior=0;
 for(const range of Object.values(clock.phases)){assert(range[0]>prior&&range[1]>=range[0]&&range[1]<=240);prior=range[1];}
 for(let f=0;f<240;f++){
  const a=clock.stateAt(f);assert.deepEqual(a,clock.stateAt(f));
  if(f>0){const previous=clock.stateAt(f-1);for(const key of ['leftFoot','rightFoot']){
   if(a[key].planted&&previous[key].planted)assert.equal(a[key].x,previous[key].x,'stance foot slides');
   if(a[key].planted)assert(Math.abs(a[key].y-558)<1e-9);
  }}
  if(a.contactActive){assert(Math.abs(a.palmX-a.contactPoint.x)<1e-9);assert.equal(a.palmY,a.contactPoint.y);}
  if(f<contactSec*30) assert.equal(a.potX,610);
  if(f>=contactSec*30+60) assert.equal(a.potX,830);
 }
 assert.equal(clock.stateAt(239).bloom,1);
}
const plans=['storyboard.json','storyboard.late-contact.json'].map(f=>JSON.parse(fs.readFileSync(path.join(import.meta.dirname,f),'utf8')));
assert.equal(checkStoryActionEdit(plans[0],plans[1],{shotId:'garden-push',actionId:'push'}).pass,true);
const a=createCharacterAction(30),b=createCharacterAction(30,{contactSec:3.5});
for(let f=0;f<75;f++) assert.deepEqual(a.stateAt(f),b.stateAt(f));
for(let f=90;f<210;f++){
 const x=a.stateAt(f),y=b.stateAt(f+15);
 for(const k of ['actorX','potX','palmX','palmY','reach','recover','push','bloom','lean','wheelAngle'])assert.equal(x[k],y[k]);
}
for(const fps of [0,-1,NaN,Infinity])assert.throws(()=>createCharacterAction(fps));
for(const contactSec of [2,4,NaN,Infinity])assert.throws(()=>createCharacterAction(30,{contactSec}));
const file=path.join(import.meta.dirname,'timing.json');
if(process.argv.includes('--write')) fs.writeFileSync(file,JSON.stringify(timing,null,2)+'\n');
else assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),timing,'Timing JSON drift');
console.log('PASS: 480 deterministic states; planted stance; storyboard edit guard; contact equality; stationary prop before/after push; local +15-frame timing; invalid inputs; timing JSON exact.');
