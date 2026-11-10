import assert from 'node:assert/strict';
import vm from 'node:vm';
import {catalog, selectionGroups, generatedFiles} from '../../scripts/style-catalog.mjs';
import {presentOptionalSamples} from '../../scripts/package-profile.mjs';

// Run the generated inline script, with only its required DOM surface stubbed.
// This regression suite stays dependency-free; actual Chromium layout/playback
// checks are separate from these deterministic interaction tests.
export function catalogUi({flat=false,hash='',profile='full'}={}) {
  const filename=flat?'samples/all.html':'samples/index.html';
  const html=presentOptionalSamples(filename,generatedFiles().get(filename),profile);
  const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[entity]));
  const variants=[...html.matchAll(/<div class="variant" id="([^"]+)" data-type="([^"]+)" data-vibe="([^"]*)" data-search="([^"]*)" data-section="([^"]*)">/g)].map(([,id,type,vibe,search,section])=>({
    id,dataset:{type,vibe,section,search:decode(search)},hidden:false,scrolled:0,
    video:profile==='full'&&catalog.styles.find(s=>s.id===id).preview.status==='available'?{pauses:0,pause(){this.pauses++}}:null,
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
  const sectionButtons=['all',...catalog.showcaseSections.map(s=>s.id)].map(id=>({dataset:{sectionChoice:id},attrs:{},setAttribute(k,v){this.attrs[k]=v}}));
  const controls={results:{scrolled:0,scrollIntoView(){this.scrolled++}},'results-title':{textContent:''},'section-description':{textContent:''},'view-link':{hash:''},reset:{},type:{value:'all'},vibe:{value:'all'},search:{value:''},status:{textContent:''},empty:{hidden:true}};
  const events={},location={hash},pushes=[];
  const document={
    querySelector:selector=>controls[selector.slice(1)],
    querySelectorAll(selector){if(selector==='.family')return families;if(selector==='[data-section-choice]')return sectionButtons;if(selector==='#grid>.variant')return variants;if(selector==='[data-member]')return buttons;if(selector==='select')return [controls.type,controls.vibe];throw new Error(selector)},
    getElementById:id=>variants.find(v=>v.id===id)??(controls[id]?{classList:{contains:()=>false}}:null),
  };
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,location,history:{pushState(_state,_unused,url){pushes.push(url);location.hash=url}},addEventListener:(name,fn)=>events[name]=fn});
  return {html,variants,families,buttons,sectionButtons,controls,location,pushes,
    chooseSection(id){const b=sectionButtons.find(b=>b.dataset.sectionChoice===id);assert.ok(b);b.onclick()},
    reset(){controls.reset.onclick()},
    filter(key,value){controls[key].value=value;(key==='search'?controls[key].oninput:controls[key].onchange)()},
    navigate(hash,event='hashchange'){location.hash=hash;events[event]()},
    click(id){const b=buttons.find(b=>b.dataset.member===id);assert.ok(b&&!b.disabled);b.onclick()},
  };
}
