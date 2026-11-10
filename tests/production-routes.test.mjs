import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {routeCatalog, styleCatalog, validateCatalog, planSelection, routesForStyle, runCli, treatmentEntries} from '../scripts/production-routes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clone = value => structuredClone(value);
const legacy = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/style-compat.json'), 'utf8'));

test('eight complete routes cover each existing style without changing any legacy identity', () => {
  assert.deepEqual(validateCatalog(), []);
  assert.equal(routeCatalog.routes.length, 8);
  const legacyIds = new Set(legacy.styles.map(s=>s.id));
  assert.deepEqual(styleCatalog.styles.filter(s => legacyIds.has(s.id)).map(({id, recipe, source}) => ({id, recipe, source})), legacy.styles);
  for (const style of styleCatalog.styles) assert.ok(routesForStyle(style.id).length > 0);
  for (const route of routeCatalog.routes) {
    assert.ok(fs.existsSync(path.join(root, route.workflow)));
    assert.equal(route.readiness.wholeFilm, 'not_validated_by_catalog');
  }
  assert.equal(new Set(routeCatalog.routes.map(r => JSON.stringify(r.stages))).size, 8);
});

test('every recommended route/style pair produces a deterministic read-only plan', () => {
  const before = JSON.stringify({routeCatalog, styleCatalog});
  for (const route of routeCatalog.routes) for (const id of route.recommendedStyles) {
    const style = styleCatalog.styles.find(s => s.id === id);
    const input = {route: route.id, style: id};
    const plan = planSelection(input);
    assert.deepEqual(plan, planSelection(input));
    assert.equal(plan.productionRoute, route.id);
    assert.equal(plan.visualStyle, id);
    assert.equal(plan.visualFamily, style.family);
    assert.equal(plan.recipe, style.recipe);
    assert.equal(plan.runtime.recipe, style.recipe);
    assert.equal(plan.editingMode, 'standard');
    assert.equal(plan.validation, 'selection_only');
    assert.equal(Object.hasOwn(plan.runtime, 'style'), style.runtimeSkin);
    assert.equal(plan.visualSource, style.source);
  }
  assert.equal(JSON.stringify({routeCatalog, styleCatalog}), before);
});

test('same visual family does not merge member IDs or inherit another recipe', () => {
  const a = planSelection({route:'diagram-explainer', style:'deep-space'});
  const b = planSelection({route:'diagram-explainer', style:'mg-purple'});
  assert.equal(a.visualFamily, b.visualFamily);
  assert.notEqual(a.visualStyle, b.visualStyle);
  assert.equal(a.recipe, 'promo');
  assert.equal(b.recipe, 'explainer');
});

test('Chinese route and style names resolve to unchanged IDs', () => {
  assert.deepEqual(planSelection({route:'产品演示', style:'深空'}), planSelection({route:'product-demo', style:'deep-space'}));
  assert.throws(() => planSelection({route:'unknown', style:'深空'}), /Unknown/);
});

test('manual styles never become runtime skins, including local lighttable', () => {
  for (const style of styleCatalog.styles.filter(s => !s.runtimeSkin)) {
    const plan = planSelection({route:routesForStyle(style.id)[0].id, style:style.id});
    assert.equal(plan.visualSource, style.source);
    assert.ok(!Object.hasOwn(plan.runtime,'style'));
    assert.ok(plan.warnings.some(w => w.includes('手动')));
  }
});

test('missing anatomy preview remains an explicit warning, not a rendering claim', () => {
  const p = planSelection({route:'mechanism-breakdown', style:'isometric-anatomy'});
  assert.ok(p.warnings.some(w => w.includes('没有可用样片')));
  assert.equal(p.validation,'selection_only');
});

test('documentary remains a production route, never a new runtime recipe', () => {
  const p = planSelection({route:'archive-narrative', style:'epic-paper'});
  assert.equal(p.runtime.recipe,'epic');
  assert.throws(() => planSelection({route:'archive-narrative', style:'epic-paper', recipe:'documentary'}), /Not a runtime recipe/);
});

test('editing mode is orthogonal and never silently enabled by rhythmic route', () => {
  assert.equal(planSelection({route:'rhythmic-short', style:'kinetic-type'}).editingMode, 'standard');
  const base = planSelection({route:'archive-narrative', style:'epic-paper'});
  const relay = planSelection({route:'archive-narrative', style:'epic-paper', editingMode:'match-cut-beat-relay'});
  assert.deepEqual({...relay, editingMode:'standard'}, base);
});

test('explicit recipe override is preserved and flagged, route recommendation is not a whitelist', () => {
  const plan = planSelection({route:'product-demo', style:'chalk', recipe:'epic'});
  assert.equal(plan.runtime.recipe,'epic');
  assert.ok(plan.warnings.some(w=>w.includes('默认配方不同')));
  assert.ok(plan.warnings.some(w=>w.includes('不在推荐列表')));
});

test('material selection stays undecided unless explicitly provided and never implies an available generation channel', () => {
  assert.equal(planSelection({route:'archive-narrative',style:'epic-paper'}).materialMethod,null);
  assert.equal(planSelection({route:'painted-animation',style:'engraving'}).materialMethod,null);
  assert.ok(planSelection({route:'painted-animation',style:'engraving'}).warnings.some(w=>w.includes('不生成主体画面')));
  const plan = planSelection({route:'painted-animation', style:'swirl-oil', materialMethod:'hybrid'});
  assert.equal(plan.materialMethod,'hybrid');
  assert.ok(plan.warnings.some(w=>w.includes('不保证生成通道可用')));
});

test('four prototypes and three unimplemented candidates have distinct availability and evidence', () => {
  assert.equal(routeCatalog.treatments.length, 7);
  const entries = treatmentEntries();
  const candidates = entries.filter(t=>t.status==='candidate');
  assert.equal(candidates.length,3);
  for (const t of entries) {
    if (t.status === 'prototype' && t.id === t.implementedStyleId) {
      assert.equal(planSelection({route:t.route, style:t.id}).visualStyle,t.implementedStyleId);
    } else assert.throws(() => planSelection({route:t.route, style:t.id}), /Unknown/);
    const guide = fs.readFileSync(path.join(root,t.guide),'utf8');
    assert.ok(guide.includes(`id="${t.anchor}"`));
  }
  for (const t of candidates) {
    assert.equal(t.implementation,'not_implemented');
    assert.equal(t.availableInCatalog,false);
  }
  const prototype = entries.find(t=>t.id==='choice-adventure');
  assert.equal(prototype.status,'prototype');
  assert.equal(prototype.implementation,'prototype');
  assert.equal(prototype.implementedStyleId,'choice-quest');
  assert.equal(prototype.evidence,'offline_shared_svg_and_sampled_frames');
  assert.ok(Object.values(prototype.verification).every(v=>v==='not_performed'));
  assert.equal(prototype.availableInCatalog,styleCatalog.styles.some(s=>s.id==='choice-quest'));
  assert.deepEqual(JSON.parse(runCli(['treatments','--json'])),entries);
  if (prototype.availableInCatalog) {
    const plan=planSelection({route:prototype.route,style:prototype.implementedStyleId});
    assert.ok(plan.warnings.some(w=>w.includes('离线共享 SVG')));
    assert.equal(Object.hasOwn(plan.runtime,'style'),false);
  }
});

test('metadata rejects duplicate IDs, unknown styles, recipe expansion and false readiness', () => {
  const changes = [
    c => {c.routes[1].id = c.routes[0].id;},
    c => {c.routes[0].recommendedStyles.push('invented-style');},
    c => {c.runtimeRecipes.push('documentary');},
    c => {c.routes[0].readiness.wholeFilm = 'passed';},
    c => {c.treatments[0].implementation = 'implemented';},
    c => {c.resources[0].kind = 'fully-reviewed-video';},
    c => {c.routes[0].resources.push('missing-resource');},
  ];
  for (const change of changes) {const c=clone(routeCatalog);change(c);assert.ok(validateCatalog(c).length > 0);}
});

test('metadata rejects unsafe and absent source paths', () => {
  for (const value of ['../outside.md','/tmp/source.md','a\\b.md','a/../b.md','a//b.md','a.md#fragment']) {
    const c=clone(routeCatalog);c.resources[0].paths=[value];assert.ok(validateCatalog(c).some(e=>e.includes('Unsafe')));
  }
  assert.ok(validateCatalog(routeCatalog,styleCatalog,{pathExists:()=>false}).some(e=>e.includes('Missing')));
});

test('malformed metadata is reported rather than accepted', () => {
  for (const value of [null, {}, {routes:[]}, {schemaVersion:99}]) assert.ok(validateCatalog(value).length > 0);
  for (const change of [c=>{c.routes[0]=null;}, c=>{c.routes[0].stages='text';}, c=>{c.routes[0].stages=[null];}, c=>{c.resources[0].paths={};}, c=>{c.routes[0].recommendedStyles=null;}]) {
    const c=clone(routeCatalog);change(c);assert.ok(validateCatalog(c).length > 0);
  }
});

test('invalid selection fields and CLI options fail instead of being ignored', () => {
  for (const extra of [{recipe:'documentary'},{editingMode:'beat-relay'},{materialMethod:'magic'},{workflow:'legacy'},{treatment:'choice-adventure'}]) {
    assert.throws(()=>planSelection({route:'diagram-explainer', style:'chalk',...extra}));
  }
  for (const argv of [['list','--write'],['check','--skip'],['show'],['plan','--route','diagram-explainer','--route','product-demo'],['plan','--style'],['unknown']]) assert.throws(()=>runCli(argv));
});

test('CLI works outside checkout and never rewrites existing project/config/workflow files', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'a2v-route-'));
  const marker=JSON.stringify({schemaVersion:1,recipe:'promo',workflow:'user-custom-existing',editingMode:'standard'});
  try {
    fs.writeFileSync(path.join(dir,'project.json'),marker);
    fs.mkdirSync(path.join(dir,'src'));
    fs.writeFileSync(path.join(dir,'src/config.ts'),'export const VIDEO = {recipe:"promo"};');
    const result=spawnSync(process.execPath,[path.join(root,'scripts/production-routes.mjs'),'plan','--route','产品演示','--style','深空'],{cwd:dir,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).runtime.style,'deep-space');
    assert.equal(fs.readFileSync(path.join(dir,'project.json'),'utf8'),marker);
    assert.equal(fs.readFileSync(path.join(dir,'src/config.ts'),'utf8'),'export const VIDEO = {recipe:"promo"};');
    assert.deepEqual(fs.readdirSync(dir).sort(),['project.json','src']);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('same route catalog works with base styles or optional prototypes', () => {
  const released = {...clone(styleCatalog),styles:styleCatalog.styles.filter(s=>!['lighttable','choice-quest','transit-story','porcelain-reveal','card-conflict'].includes(s.id))};
  assert.equal(released.styles.length,63);
  assert.deepEqual(validateCatalog(routeCatalog,released),[]);
  assert.throws(()=>planSelection({route:'diagram-explainer',style:'transit-story'},routeCatalog,released),/Unknown/);
  assert.equal(treatmentEntries(routeCatalog,released).find(t=>t.id==='transit-story').availableInCatalog,false);
  assert.throws(()=>planSelection({route:'painted-animation',style:'porcelain-reveal'},routeCatalog,released),/Unknown/);
  assert.equal(treatmentEntries(routeCatalog,released).find(t=>t.id==='cobalt-reveal').availableInCatalog,false);
  assert.throws(()=>planSelection({route:'character-animation',style:'card-conflict'},routeCatalog,released),/Unknown/);
  assert.equal(treatmentEntries(routeCatalog,released).find(t=>t.id==='card-conflict').availableInCatalog,false);
  assert.throws(()=>planSelection({route:'archive-narrative',style:'lighttable'},routeCatalog,released),/Unknown/);
  assert.throws(()=>planSelection({route:'character-animation',style:'choice-quest'},routeCatalog,released),/Unknown/);
  assert.equal(treatmentEntries(routeCatalog,released).find(t=>t.id==='choice-adventure').availableInCatalog,false);
  const extension = styleCatalog.styles.find(s=>s.id==='lighttable') ?? {id:'lighttable',name:'档案灯台',family:'lighttable',recipe:'explainer',source:'styles/lighttable',runtimeSkin:false,preview:{status:'available'}};
  const withPrototype = {...released,styles:[...released.styles,extension]};
  assert.deepEqual(validateCatalog(routeCatalog,withPrototype),[]);
  const prototype=planSelection({route:'archive-narrative',style:'lighttable'},routeCatalog,withPrototype);
  assert.equal(prototype.visualStyle,'lighttable');
  assert.equal(Object.hasOwn(prototype.runtime,'style'),false);
  assert.ok(!prototype.warnings.some(w=>w.includes('不在推荐列表')));
});


test('prototype metadata rejects inflated verification, missing links and runtime skin claims', () => {
  for (const change of [
    t=>{t.verification.nativeRemotion='passed';},
    t=>{t.verification.fullMotionPlayback='passed';},
    t=>{t.evidence='fully_reviewed_video';},
    t=>{delete t.implementedStyleId;},
    t=>{t.implementedStyleId='invented';},
    t=>{t.verificationPath='../escape.json';}
  ]) {
    const c=clone(routeCatalog);change(c.treatments.find(t=>t.id==='choice-adventure'));
    assert.ok(validateCatalog(c).length>0);
  }
  const wrongStyles=clone(styleCatalog);
  const actual=wrongStyles.styles.find(s=>s.id==='choice-quest');
  if(actual){actual.runtimeSkin=true;assert.ok(validateCatalog(routeCatalog,wrongStyles).some(e=>e.includes('manual kit')));}
});

test('display names and aliases resolve without changing stable IDs; ambiguous labels fail', () => {
  const styled=clone(styleCatalog);
  const chalk=styled.styles.find(s=>s.id==='chalk');
  chalk.displayName='粉笔黑板';chalk.aliases=[...(chalk.aliases??[]),'旧粉笔风格'];
  const byId=planSelection({route:'diagram-explainer',style:'chalk'},routeCatalog,styled);
  for(const label of ['粉笔黑板','黑板','旧粉笔风格']) {
    assert.deepEqual(planSelection({route:'diagram-explainer',style:label},routeCatalog,styled),byId);
    assert.deepEqual(routesForStyle(label,routeCatalog,styled),routesForStyle('chalk',routeCatalog,styled));
  }
  styled.styles.find(s=>s.id==='blueprint').aliases=['旧粉笔风格'];
  assert.throws(()=>planSelection({route:'diagram-explainer',style:'旧粉笔风格'},routeCatalog,styled),/ambiguous/);
  assert.throws(()=>routesForStyle('旧粉笔风格',routeCatalog,styled),/ambiguous/);
});


test('implemented transit treatment shares its exact style ID without accepting candidate collisions', () => {
  const t=treatmentEntries().find(t=>t.id==='transit-story');
  assert.equal(t.status,'prototype');assert.equal(t.availableInCatalog,true);assert.equal(t.implementedStyleId,t.id);
  const plan=planSelection({route:'diagram-explainer',style:'线路叙事'});
  assert.equal(plan.visualStyle,'transit-story');assert.equal(Object.hasOwn(plan.runtime,'style'),false);
  const c=clone(routeCatalog),transit=c.treatments.find(t=>t.id==='transit-story');
  transit.implementedStyleId='choice-quest';assert.ok(validateCatalog(c).some(e=>e.includes('collides')));
  transit.status='candidate';transit.implementation='not_implemented';delete transit.implementedStyleId;
  assert.ok(validateCatalog(c).some(e=>e.includes('collides')));
});


test('cobalt treatment upgrades in place and resolves porcelain as an optional manual style', () => {
  const entries=treatmentEntries();
  assert.equal(entries.filter(t=>t.id==='cobalt-reveal').length,1);
  assert.equal(entries.some(t=>t.id==='porcelain-reveal'),false);
  const t=entries.find(t=>t.id==='cobalt-reveal');
  assert.equal(t.status,'prototype');assert.equal(t.availableInCatalog,true);
  assert.equal(t.implementedStyleId,'porcelain-reveal');assert.equal(t.route,'painted-animation');
  assert.equal(t.verification.nativeRemotion,'blocked');
  const p=planSelection({route:'绘画动画',style:'青花显影'});
  assert.equal(p.visualStyle,'porcelain-reveal');assert.equal(p.visualFamily,'porcelain-reveal');
  assert.equal(p.recipe,'explainer');assert.equal(Object.hasOwn(p.runtime,'style'),false);
  assert.ok(!p.warnings.some(w=>w.includes('不在推荐列表')));
  assert.throws(()=>planSelection({route:t.route,style:t.id}),/Unknown/);
  for(const field of ['fullMotionPlayback','audioReview','finalFilmQC']) {
    const c=clone(routeCatalog);c.treatments.find(t=>t.id==='cobalt-reveal').verification[field]='blocked';
    assert.ok(validateCatalog(c).length>0);
  }
  const c=clone(routeCatalog);c.treatments.find(t=>t.id==='cobalt-reveal').verification.nativeRemotion='passed';
  assert.ok(validateCatalog(c).length>0);
});


test('card-conflict upgrades its existing candidate to one optional manual prototype', () => {
  const entries=treatmentEntries();assert.equal(entries.filter(t=>t.id==='card-conflict').length,1);
  const t=entries.find(t=>t.id==='card-conflict');
  assert.equal(t.status,'prototype');assert.equal(t.availableInCatalog,true);
  assert.equal(t.implementedStyleId,t.id);assert.equal(t.route,'character-animation');
  const p=planSelection({route:'角色动画',style:'卡牌对抗'});
  assert.equal(p.visualStyle,'card-conflict');assert.equal(p.visualFamily,'card-conflict');
  assert.equal(p.recipe,'explainer');assert.equal(Object.hasOwn(p.runtime,'style'),false);
  assert.ok(!p.warnings.some(w=>w.includes('不在推荐列表')));
  const c=clone(routeCatalog),card=c.treatments.find(t=>t.id==='card-conflict');
  card.implementedStyleId='choice-quest';assert.ok(validateCatalog(c).some(e=>e.includes('collides')));
});
