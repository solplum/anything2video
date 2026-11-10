/** Pure, random-access, deterministic rules. Every consequence follows a declared event. */
import {DEFAULT_SCENARIO} from './scenarios.mjs';
export const DUEL={fps:30,durationSeconds:16,frames:480,width:1280,height:720};
const integer=(x,min=0)=>Number.isInteger(x)&&x>=min;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fail=message=>{throw new TypeError(message);};
export function validateScenario(s){
 if(!s||typeof s!=='object')fail('scenario is required');
 for(const key of ['id','name','chapter','goal','objective','objectiveArt'])if(typeof s[key]!=='string'||!s[key].trim()||s[key].length>100)fail('invalid '+key);
 for(const [key,max] of Object.entries({name:18,chapter:48,goal:36,objective:8}))if([...s[key]].length>max)fail(key+' is too long for this layout');
 if(!['lighthouse','seedling'].includes(s.objectiveArt))fail('unsupported objective art');
 for(const key of ['maxIntegrity','energy'])if(!integer(s[key],1)||s[key]>6)fail('invalid '+key);
 if(!s.threat||!integer(s.threat.power,1)||s.threat.power>6||!['storm','frost'].includes(s.threat.art)||typeof s.threat.name!=='string'||s.threat.name.length>20)fail('invalid threat');
 if(!s.theme||!['table','shadow','ink','paper','gold','accent','danger'].every(k=>/^#[\da-f]{6}$/i.test(s.theme[k])))fail('invalid theme');
 if(!Array.isArray(s.choices)||s.choices.length<2||s.choices.length>3)fail('choose two or three cards');
 const ids=new Set();
 for(const c of s.choices){
  if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id))fail('invalid or duplicate card id');ids.add(c.id);
  for(const key of ['name','tag'])if(typeof c[key]!=='string'||!c[key]||c[key].length>60)fail('invalid card '+key);
  if([...c.name].length>8||[...c.tag].length>12)fail('card copy too long for this layout');
  if(!['anchor','boat','greenhouse','basket'].includes(c.art))fail('unsupported card art');
  if(!integer(c.cost)||c.cost>s.energy||!integer(c.guard)||c.guard>6||!integer(c.reward)||c.reward>6)fail('invalid cost, guard or reward');
 }
 return s;
}
export function duelTiming({fps=30,selectSec=4}={}){
 if(!finite(fps)||fps<1||fps>120)fail('fps must be 1–120');
 if(!finite(selectSec)||selectSec<3||selectSec>5)fail('selection must be 3–5 seconds');
 const frame=t=>Math.round(t*fps);
 return Object.freeze({select:frame(selectSec),commit:frame(selectSec+2),attack:frame(selectSec+5),impact:frame(selectSec+6),settle:frame(selectSec+8),end:Math.ceil(16*fps)-1});
}
export function resolveDuel({scenario=DEFAULT_SCENARIO,choice=scenario.choices[0].id}={}){
 validateScenario(scenario);const card=scenario.choices.find(c=>c.id===choice);if(!card)fail('unknown choice');
 const blocked=Math.min(card.guard,scenario.threat.power),damage=scenario.threat.power-blocked;
 return Object.freeze({energy:scenario.energy-card.cost,guard:card.guard-blocked,blocked,damage,integrity:Math.max(0,scenario.maxIntegrity-damage),reward:card.reward});
}
export function describeCard(card){
 const effects=[card.guard?`抵挡 ${card.guard} 点冲击`:null,card.reward?`获得 ${card.reward} 份物资`:null].filter(Boolean);
 return `消耗 ${card.cost} 点补给 · ${effects.join(' · ')||'无额外效果'}`;
}
export function outcomeCaption(scenario,state){
 if(!state.impacted)return '';
 if(state.integrity>0)return state.damage>0?`承受 ${state.damage} 点损伤，${scenario.objective}仍在。`:state.guard>0?`余下 ${state.guard} 点防护，${scenario.objective}守住。`:`防护耗尽，${scenario.objective}守住。`;
 return state.reward>0?`物资收回，${scenario.objective}失守。`:`防护不足，${scenario.objective}失守。`;
}
export function duelEvents({scenario=DEFAULT_SCENARIO,choice=scenario.choices[0].id,fps=30,selectSec=4}={}){
 const final=resolveDuel({scenario,choice}),card=scenario.choices.find(c=>c.id===choice),time=duelTiming({fps,selectSec});
 return Object.freeze([
  Object.freeze({id:'choice',frame:time.select,kind:'decision',card:choice}),
  Object.freeze({id:'commit',frame:time.commit,kind:'payment-and-effect',energyDelta:-card.cost,guardDelta:card.guard,rewardDelta:card.reward}),
  Object.freeze({id:'impact',frame:time.impact,kind:'opposition-resolution',threat:scenario.threat.power,blocked:final.blocked,damage:final.damage,integrityDelta:final.integrity-scenario.maxIntegrity}),
 ]);
}
const engineClamp=x=>Math.max(0,Math.min(1,x));
export function duelState({frame,scenario=DEFAULT_SCENARIO,choice=scenario.choices[0].id,fps=30,selectSec=4}={}){
 if(!integer(frame))fail('frame must be a nonnegative integer');
 const final=resolveDuel({scenario,choice}),time=duelTiming({fps,selectSec}),f=Math.min(frame,time.end),card=scenario.choices.find(c=>c.id===choice);
 const chosen=f>=time.select,committed=f>=time.commit,impacted=f>=time.impact;
 const phase=!chosen?'choose':!committed?'commit':f<time.attack?'protect':!impacted?'attack':f<time.settle?'resolve':'result';
 return Object.freeze({frame:f,fps,t:f/fps,time,phase,chosen,committed,impacted,choice:chosen?choice:null,energy:committed?final.energy:scenario.energy,guard:impacted?final.guard:committed?card.guard:0,integrity:impacted?final.integrity:scenario.maxIntegrity,reward:committed?final.reward:0,blocked:impacted?final.blocked:0,damage:impacted?final.damage:0,success:impacted?final.integrity>0:null,cardProgress:engineClamp((f-time.select)/(time.commit-time.select)),attackProgress:engineClamp((f-time.attack)/(time.impact-time.attack)),resolveProgress:engineClamp((f-time.impact)/(time.settle-time.impact))});
}
