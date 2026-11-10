import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
import {SCENARIOS,renderDuel,duelState} from '../styles/card-conflict/scene.mjs';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('remaining custom guard stays visible after resolution',()=>{const scenario=JSON.parse(JSON.stringify(SCENARIOS.lighthouse));scenario.choices[0].guard=4;const state=duelState({frame:479,scenario});assert.equal(state.guard,1);const svg=renderDuel({frame:479,scenario});assert.match(svg,/aria-label="shield" opacity="1"/);assert.match(svg,/余下 1 点防护/);});
test('3840 frames bridge the exact actually-rendered source to the delivered surplus-guard fix',async()=>{
 const root=new URL('../styles/card-conflict/',import.meta.url),proof=JSON.parse(fs.readFileSync(new URL('./fixtures/card-conflict-rendered-source.json',import.meta.url),'utf8'));
 const current=fs.readFileSync(new URL('scene.mjs',root),'utf8');
 const patched='const shieldAlpha=st.impacted?(st.guard>0?1:clamp(1-st.resolveProgress*2)):fieldProgress;';
 const rendered='const shieldAlpha=st.impacted?clamp(1-st.resolveProgress*2):fieldProgress;';
 assert.equal(current.split(patched).length,2,'one documented change only');
 const predecessor=current.replace(patched,rendered);assert.equal(hash(predecessor),proof.renderedSourceHashes['scene.mjs']);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'card-conflict-rendered-'));
 for(const file of ['engine.mjs','scenarios.mjs']){const bytes=fs.readFileSync(new URL(file,root));assert.equal(hash(bytes),proof.renderedSourceHashes[file]);fs.writeFileSync(path.join(dir,file),bytes);}
 fs.writeFileSync(path.join(dir,'scene.mjs'),predecessor);const old=await import(pathToFileURL(path.join(dir,'scene.mjs')).href);let compared=0;
 for(const scenario of Object.values(SCENARIOS))for(const card of scenario.choices)for(const showCaptions of [false,true])for(let frame=0;frame<480;frame++){const props={frame,scenario,choice:card.id,showCaptions};assert.equal(renderDuel(props),old.renderDuel(props),scenario.id+'/'+card.id+'/'+frame);compared++;}
 assert.equal(compared,3840);
});
