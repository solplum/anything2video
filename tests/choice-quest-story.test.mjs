import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {questState} from '../styles/choice-quest/scene.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../examples/choice-quest/'+name,import.meta.url),'utf8'));
test('existing story contract uses stable IDs and real 1-based contact windows',()=>{
 const plan=read('storyboard.json'),shot=plan.shots[0],action=shot.story.actions[0],phases=action.phases;
 assert.equal(plan.story.schemaVersion,1);assert.equal(plan.story.kind,'fiction');assert.equal(shot.from,1);assert.equal(shot.to,540);
 assert.ok(plan.story.characters.some(c=>c.id===action.actor));assert.ok(plan.story.props.some(p=>p.id===action.prop));
 assert.equal(phases.contact[0]-1,270);
 let end=0;for(const [name,[from,to]] of Object.entries(phases)){assert.ok(from>end);assert.ok(to>=from&&to<=shot.to);end=to;}
 for(let global=phases.contact[0];global<=phases.support[1];global++){const s=questState({frame:global-1});assert.equal(s.palmX,s.cellX);assert.equal(s.palmY,s.cellY);}
});
test('late storyboard changes only the action window and matches the late clock',()=>{
 const a=read('storyboard.json'),b=read('storyboard.late.json');const ap=a.shots[0].story.actions[0].phases,bp=b.shots[0].story.actions[0].phases;
 for(const key of Object.keys(ap))assert.deepEqual(bp[key],ap[key].map(n=>n+15));
 b.shots[0].story.actions[0].phases=ap;assert.deepEqual(b,a);
 const before=questState({frame:284,selectSec:7}),contact=questState({frame:285,selectSec:7});assert.equal(before.inventory,1);assert.equal(contact.inventory,0);
});
