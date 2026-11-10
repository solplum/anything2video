import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';import {renderPorcelain} from '../styles/porcelain-reveal/scene.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/porcelain-reveal-pre-fix-surface.json',import.meta.url),'utf8'));
const normalize=s=>s.replace(/<filter id="porcelain-(feather|wet)"[^>]*>/g,(_,id)=>`<filter id="porcelain-${id}">`);
test('all 840 frames preserve pre-fix geometry, timing, material opacity, masks and typography',()=>{
 for(const [key,width,height] of [['landscape',1280,720],['portrait',720,1280]]){const hash=crypto.createHash('sha256');for(let frame=0;frame<420;frame++)hash.update(normalize(renderPorcelain({frame,width,height})));assert.equal(hash.digest('hex'),fixture.hashes[key]);}
});
