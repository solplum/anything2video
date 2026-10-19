import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {catalog, selectionGroups, generate, generatedFiles} from '../scripts/style-catalog.mjs';
import {tsLoader} from './helpers/load-ts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacy = JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/style-compat.json'),'utf8'));
const load = tsLoader();
const hash = x => crypto.createHash('sha256').update(x).digest('hex');

test('every legacy ID remains distinct and the four family pairs retain recipe associations', () => {
  assert.equal(new Set(catalog.styles.map(s=>s.id)).size,catalog.styles.length);
  assert.deepEqual(catalog.styles.filter(s=>s.id!=='engraving').map(s=>({id:s.id,recipe:s.recipe,source:s.source})),legacy.styles);
  assert.equal(selectionGroups().length,59);
  assert.deepEqual(catalog.families.map(f=>f.members), [['deep-space','mg-purple'],['isometric-city','clay-town'],['light-dabs','lily-pond'],['ink-plate','riso-print']]);
  for (const f of catalog.families) for (const id of f.members) assert.equal(catalog.styles.find(s=>s.id===id).family,f.id);
  const dirs = fs.readdirSync(path.join(root,'styles'),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='shared').map(d=>d.name);
  assert.deepEqual(catalog.styles.filter(s=>s.source.startsWith('styles/')).map(s=>s.id).sort(),dirs.sort());
});

test('catalog capability labels match actual runtime registration; missing previews stay explicit', () => {
  const {STYLE_SKINS} = load('template/src/recipes/styles/index.ts');
  assert.deepEqual(catalog.styles.filter(s=>s.runtimeSkin).map(s=>s.id).sort(),Object.keys(STYLE_SKINS).sort());
  const anatomy = catalog.styles.find(s=>s.id==='isometric-anatomy');
  assert.equal(anatomy.preview.status,'missing');
  assert.equal(anatomy.preview.path,null);
  assert.equal(anatomy.runtimeSkin,false);
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'samples/manifest.json'),'utf8'));
  for (const s of catalog.styles) {
    if (s.preview.status==='missing') continue;
    const sample = manifest.samples.find(m=>m.styleId===s.id);
    assert.ok(sample,'missing sample metadata '+s.id);
    assert.equal(sample.familyId,s.family);
    assert.equal(sample.poolType,s.recipe);
    assert.equal(sample.runtimeSkin,s.runtimeSkin);
    assert.ok(fs.existsSync(path.join(root,'samples',s.preview.path)));
  }
  generate({check:true});
});

test('all 36 original recipe/style combinations match pre-change runtime values', () => {
  const {VIDEO} = load('template/src/config.ts');
  const {getActiveRecipe,styleSkinOf} = load('template/src/recipes/index.ts');
  for (const row of legacy.runtime) {
    VIDEO.recipe=row.recipe; VIDEO.style=row.style??undefined;
    assert.deepEqual(getActiveRecipe(),row.value,`${row.recipe}/${row.style}`);
    if(row.style) assert.equal(styleSkinOf(row.style).id,row.style);
  }
  for (const recipe of ['explainer','promo','epic']) {
    VIDEO.recipe=recipe;VIDEO.style='engraving';
    const r=getActiveRecipe();
    assert.equal(r.palette.bg,'#F1E8D2');assert.equal(r.chrome.barGlow,false);assert.equal(r.chrome.subColor,'#1C1510');
  }
  VIDEO.recipe='explainer'; VIDEO.style=undefined;
});

export function paintTrace(mod, t, boil) {
  const trace=[];
  const dst=new Proxy({}, {set(o,k,v){o[k]=v;trace.push([k,v]);return true;},get(o,k){return o[k]??((...a)=>trace.push([k,...a]));}});
  const pixels=Uint8ClampedArray.from({length:24*18*4},(_,i)=>i%4===3?255:(i*17)%256);
  const src={width:24,height:18,getContext:()=>({getImageData:()=>({data:pixels})})};
  mod.paintStrokes(dst,src,{cell:6,len:12,width:2,t,boil,seed:41,angle:(x,y,tt)=>Math.sin(x/10+tt)+y/30,palette:mod.swatch(['#ddccaa','#336699'],0.4),mask:(x,y)=>x>=0&&y>=0});
  return hash(JSON.stringify(trace));
}

test('four legacy stroke imports preserve every export and seeded canvas command', () => {
  const core=load('styles/shared/paint/strokes.ts');
  const originalSource=fs.readFileSync(path.join(root,'styles/shared/paint/strokes.ts'),'utf8');
  assert.equal(hash(originalSource),legacy.paintSourceSha256);
  // These exact bytes are the pre-consolidation implementation. Execute a fresh
  // baseline on this host: Math.sin/cos last bits vary across JS engines/CPUs, so
  // historical hashes of unrounded floating-point traces are not portable.
  const original=tsLoader(file=>file===path.join(root,'styles/light-dabs/strokes.ts')?originalSource:fs.readFileSync(file,'utf8'))('styles/light-dabs/strokes.ts');
  for (const id of ['light-dabs','lily-pond','swirl-oil','scream-warp']) {
    const mod=load(`styles/${id}/strokes.ts`);
    assert.deepEqual(Object.keys(mod).sort(),Object.keys(core).sort());
    for(const name of Object.keys(core)) assert.equal(mod[name],core[name],`${id}/${name}`);
    for (const row of legacy.paintTraces) assert.equal(paintTrace(mod,row.t,row.boil),paintTrace(original,row.t,row.boil),`${id} ${row.t}/${row.boil}`);
  }
});

// Run the generated inline script, with only its required DOM surface stubbed.
// This regression suite stays dependency-free; actual Chromium layout/playback
// checks are separate from these deterministic interaction tests.
function catalogUi({flat=false,hash=''}={}) {
  const html=generatedFiles().get(flat?'samples/all.html':'samples/index.html');
  const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[entity]));
  const variants=[...html.matchAll(/<div class="variant" id="([^"]+)" data-type="([^"]+)" data-vibe="([^"]*)" data-search="([^"]*)">/g)].map(([,id,type,vibe,search])=>({
    id,dataset:{type,vibe,search:decode(search)},hidden:false,scrolled:0,
    video:catalog.styles.find(s=>s.id===id).preview.status==='available'?{pauses:0,pause(){this.pauses++}}:null,
    classList:{contains:name=>name==='variant'},
    querySelector(selector){assert.equal(selector,'video');return this.video},
    closest(selector){assert.equal(selector,'.family');return families.find(f=>f.variants.includes(this))},
    scrollIntoView(){this.scrolled++},
  }));
  const families=flat?[]:selectionGroups().map(g=>({
    id:g.id,dataset:{},hidden:false,variants:variants.filter(v=>g.members.some(s=>s.id===v.id)),buttons:[],
    querySelectorAll(selector){if(selector==='.variant')return this.variants;if(selector==='[data-member]')return this.buttons;if(selector==='video')return this.variants.map(v=>v.video).filter(Boolean);throw new Error(selector)},
  }));
  const buttons=families.flatMap(f=>f.buttons=f.variants.length>1?f.variants.map(v=>({dataset:{member:v.id},disabled:false,attrs:{},setAttribute(k,value){this.attrs[k]=value},closest:()=>f})):[]);
  const controls={type:{value:'all'},vibe:{value:'all'},search:{value:''},status:{textContent:''},empty:{hidden:true}};
  const events={},location={hash},pushes=[];
  const document={
    querySelector:selector=>controls[selector.slice(1)],
    querySelectorAll(selector){if(selector==='.family')return families;if(selector==='#grid>.variant')return variants;if(selector==='[data-member]')return buttons;if(selector==='select')return [controls.type,controls.vibe];throw new Error(selector)},
    getElementById:id=>variants.find(v=>v.id===id)??(controls[id]?{classList:{contains:()=>false}}:null),
  };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,location,history:{pushState(_state,_unused,url){pushes.push(url);location.hash=url}},addEventListener:(name,fn)=>events[name]=fn});
  return {html,variants,families,buttons,controls,location,pushes,
    filter(key,value){controls[key].value=value;(key==='search'?controls[key].oninput:controls[key].onchange)()},
    navigate(hash,event='hashchange'){location.hash=hash;events[event]()},
    click(id){const b=buttons.find(b=>b.dataset.member===id);assert.ok(b&&!b.disabled);b.onclick()},
  };
}

test('generated catalog preserves every ID, four variant selectors, and honest missing preview',()=>{
  for(const flat of [false,true]){
    const ui=catalogUi({flat});
    assert.equal(ui.variants.length,catalog.styles.length);
    assert.equal(ui.families.length,flat?0:59);
    assert.equal(ui.buttons.length,flat?0:8);
    assert.equal(ui.controls.status.textContent,`当前显示 ${flat?63:59} 个${flat?'变体':'选择入口'}`);
    for(const id of legacy.styles.map(s=>s.id))assert.ok(ui.variants.some(v=>v.id===id),id);
    const anatomy=ui.html.match(/<div class="variant" id="isometric-anatomy"[\s\S]*?<\/div><div class="meta">/)[0];
    assert.match(anatomy,/暂无渲染样片/);assert.doesNotMatch(anatomy,/<video|<img|src=/);
    assert.match(ui.html,/<label class="search">搜索 <input id="search" type="search"/);
    assert.match(ui.html,/id="status" aria-live="polite"/);
    assert.match(ui.html,/:focus-visible/);
  }
});

test('family search, combined filters, tab state, and empty recovery run against generated UI',()=>{
  const ui=catalogUi();
  for(const family of catalog.families){
    for(const id of family.members){
      ui.click(id);
      const f=ui.families.find(f=>f.id===family.id);
      assert.deepEqual(f.variants.filter(v=>!v.hidden).map(v=>v.id),[id]);
      assert.equal(f.buttons.find(b=>b.dataset.member===id).attrs['aria-pressed'],'true');
      assert.equal(ui.location.hash,'#'+id);
      assert.ok(f.variants.filter(v=>v.id!==id).every(v=>v.video.pauses>0));
    }
  }
  ui.filter('search','  MG-PURPLE  ');
  assert.deepEqual(ui.families.filter(f=>!f.hidden).map(f=>f.id),['dark-editorial']);
  assert.equal(ui.families.find(f=>f.id==='dark-editorial').dataset.selected,'mg-purple');
  assert.equal(ui.buttons.find(b=>b.dataset.member==='deep-space').disabled,true);
  ui.filter('search','暗色 信息');
  assert.equal(ui.controls.status.textContent,'当前显示 1 个选择入口');
  ui.filter('type','promo');
  assert.equal(ui.families.find(f=>f.id==='dark-editorial').dataset.selected,'deep-space');
  ui.filter('vibe','warm');
  assert.equal(ui.controls.status.textContent,'当前显示 0 个选择入口');
  assert.equal(ui.controls.empty.hidden,false);
  ui.filter('search','');ui.filter('type','all');ui.filter('vibe','all');
  assert.equal(ui.controls.status.textContent,'当前显示 59 个选择入口');
  assert.equal(ui.controls.empty.hidden,true);
});

test('deep links reveal hidden variants and malformed fragments never break filtering',()=>{
  for(const flat of [false,true]){
    const ui=catalogUi({flat,hash:'#lily-pond'});
    assert.equal(ui.variants.find(v=>v.id==='lily-pond').hidden,false);
    assert.ok(ui.variants.find(v=>v.id==='lily-pond').scrolled>0);
    ui.filter('search','no-such-style');ui.filter('type','epic');ui.filter('vibe','cool');
    ui.navigate('#mg%2Dpurple','popstate');
    assert.equal(ui.controls.search.value,'');assert.equal(ui.controls.type.value,'all');assert.equal(ui.controls.vibe.value,'all');
    assert.equal(ui.variants.find(v=>v.id==='mg-purple').hidden,false);
    for(const hash of ['#%E0%A4%A','#unknown-style','#search'])assert.doesNotThrow(()=>ui.navigate(hash));
    ui.filter('search','engraving');
    assert.equal(ui.controls.status.textContent,`当前显示 1 个${flat?'变体':'选择入口'}`);
  }
  const ui=catalogUi();
  ui.click('mg-purple');const pushes=ui.pushes.length;ui.click('mg-purple');assert.equal(ui.pushes.length,pushes);
  ui.navigate('','popstate');assert.equal(ui.families.find(f=>f.id==='dark-editorial').dataset.selected,'deep-space');
});

test('all-variants filtering pauses hidden previews and retains anatomy as a searchable result',()=>{
  const ui=catalogUi({flat:true});
  ui.filter('search','isometric-anatomy');
  assert.deepEqual(ui.variants.filter(v=>!v.hidden).map(v=>v.id),['isometric-anatomy']);
  assert.ok(ui.variants.filter(v=>v.video).every(v=>v.video.pauses>0));
  assert.equal(ui.controls.status.textContent,'当前显示 1 个变体');
  ui.filter('type','promo');assert.equal(ui.controls.empty.hidden,false);
  ui.filter('search','');ui.filter('type','all');
  assert.equal(ui.controls.status.textContent,'当前显示 63 个变体');
});
