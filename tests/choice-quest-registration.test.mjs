import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {collectCoreFiles} from '../scripts/build-editions.mjs';
import {catalog,selectionGroups,generate} from '../scripts/style-catalog.mjs';
import {presentOptionalSamples} from '../scripts/package-profile.mjs';
test('choice-quest registration is manual, discoverable, and generated consistently',()=>{
 const entry=catalog.styles.find(s=>s.id==='choice-quest');assert.ok(entry);assert.equal(entry.runtimeSkin,false);assert.equal(entry.source,'styles/choice-quest');
 assert.ok(selectionGroups().some(g=>g.members.some(s=>s.id==='choice-quest')));generate({check:true});
 const html=fs.readFileSync(new URL('../samples/index.html',import.meta.url),'utf8');
 const core=presentOptionalSamples('samples/index.html',html,'core');assert.ok(core.includes('data-optional-media="choice-quest-sample.mp4"'));assert.ok(core.includes('posters/choice-quest-sample.jpg'));
});
test('real packaging allowlist includes source and reviewed examples in both profiles',()=>{
 // Deliberately small filesystem fixture, not a simulated full skill build.
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'quest-package-fixture-'));
 const write=(p,s='fixture')=>{const f=path.join(tmp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)};
 for(const dir of ['recipes','reference','styles','template','scripts','gallery','audio-engine','LICENSE-THIRDPARTY'])fs.mkdirSync(path.join(tmp,dir),{recursive:true});
 for(const file of ['LICENSE','assets/audio/ATTRIBUTION.md','docs/adapters.md','docs/getting-started.md','docs/package-profiles.md','docs/optimization-v3.md','docs/optimization-v3.1.md','docs/optimization-v3.6.md','docs/optimization-v3.7.md','docs/style-system-round1.md','docs/style-browsing.md'])write(file);
 for(const file of ['styles/choice-quest/scene.mjs','styles/choice-quest/kit.tsx','styles/choice-quest/SPEC.md','examples/choice-quest/Root.tsx','examples/choice-quest/preview.html','examples/choice-quest/wait.mp4','samples/choice-quest-sample.mp4','samples/posters/choice-quest-sample.jpg'])write(file);
 write('examples/choice-quest/__pycache__/bad.pyc');write('examples/choice-quest/.env');write('examples/private-work/secret.txt');
 try{
  const full=collectCoreFiles(tmp,{profile:'full'}),core=collectCoreFiles(tmp,{profile:'core'});
  for(const f of ['styles/choice-quest/scene.mjs','styles/choice-quest/kit.tsx','styles/choice-quest/SPEC.md','examples/choice-quest/Root.tsx','examples/choice-quest/preview.html','examples/choice-quest/wait.mp4','samples/posters/choice-quest-sample.jpg']){assert.ok(full.includes(f),f);assert.ok(core.includes(f),f)}
  assert.ok(full.includes('samples/choice-quest-sample.mp4'));assert.ok(!core.includes('samples/choice-quest-sample.mp4'));assert.ok(!full.some(f=>/secret|\.env|__pycache__/.test(f)));
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
