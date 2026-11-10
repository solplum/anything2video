/** Original vector artwork, shared by the HTML preview and Remotion frame adapter. */
import {DEFAULT_SCENARIO} from './scenarios.mjs';
import {DUEL,duelState,describeCard,outcomeCaption} from './engine.mjs';
export {DUEL,duelState,duelEvents,duelTiming,resolveDuel,validateScenario,describeCard,outcomeCaption} from './engine.mjs';
export {SCENARIOS,DEFAULT_SCENARIO} from './scenarios.mjs';
const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,p)=>a+(b-a)*p;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const txt=(x,y,size,value,color,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`;
const line=(d,stroke,w=3,extra='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
export function cardArt(kind,c){
 const i=c.ink,g=c.gold,p=c.paper;
 const seal=`<circle cx="105" cy="95" r="81" fill="${i}" opacity=".065"/><circle cx="105" cy="95" r="77" fill="none" stroke="${i}" opacity=".22"/>`;
 let art='';
 if(kind==='anchor')art=`${line('M105 41V143 M65 102H145 M55 114C55 158 155 158 155 114 M45 127L55 111L70 119 M140 119L155 111L165 127',i,8)}<circle cx="105" cy="31" r="15" fill="none" stroke="${i}" stroke-width="7"/>${line('M72 50C146 52 72 109 140 133',g,5)}${line('M25 160Q50 150 75 160T125 160T185 160',i,2)}`;
 if(kind==='boat')art=`<path d="M35 125H182L159 153H64Z" fill="${i}"/><path d="M103 25L103 112H35Z" fill="${g}" stroke="${i}" stroke-width="3"/><path d="M113 43L169 112H113Z" fill="${p}" stroke="${i}" stroke-width="3"/>${line('M108 23V136 M18 165Q38 156 58 165T98 165T138 165T198 165',i,3)}<rect x="120" y="121" width="20" height="17" rx="2" fill="${g}"/>`;
 if(kind==='storm')art=`<path d="M23 88C4 68 21 44 43 45C41 18 85 15 95 39C118 15 159 29 154 51C184 45 205 71 184 91Z" fill="${i}"/><path d="M113 82L90 117H111L94 152L141 108H119L136 82Z" fill="${g}"/>${line('M17 145C43 145 40 109 69 117C89 124 75 147 63 143C73 159 112 156 127 150C157 136 163 112 190 127 M19 163Q44 154 65 164T111 164T155 164T198 164',i,5)}${line('M44 97L35 112 M74 96L65 112 M172 99L162 116',i,3)}`;
 if(kind==='frost')art=`${line('M105 18V171 M39 56L171 132 M39 132L171 56 M84 32L105 49L126 32 M84 157L105 140L126 157 M45 79L65 71L67 49 M143 139L145 117L165 109 M45 110L65 118L67 140 M143 49L145 71L165 79',i,6)}<circle cx="105" cy="95" r="16" fill="${g}" stroke="${i}" stroke-width="3"/>`;
 if(kind==='greenhouse')art=`<path d="M29 85L105 28L181 85V160H29Z" fill="${g}" opacity=".35"/>${line('M29 160V85L105 28L181 85V160Z M29 85H181 M105 28V160 M65 59V160 M145 59V160 M29 123H181',i,3)}<path d="M92 160V129Q105 111 118 129V160Z" fill="${p}" stroke="${i}" stroke-width="3"/><path d="M55 153V134Q32 117 45 116Q61 120 55 137Q75 112 80 126Q77 141 55 142" fill="${i}"/><path d="M153 153V133Q134 119 140 116Q159 118 153 137Q174 115 177 128Q169 144 153 142" fill="${i}"/>`;
 if(kind==='basket')art=`<path d="M42 96H168L154 163H57Z" fill="${g}" stroke="${i}" stroke-width="4"/>${line('M55 99C55 27 155 27 155 99 M51 115H162 M53 134H158 M69 98L76 159 M92 98L94 160 M115 98L115 160 M138 98L134 160',i,3)}<ellipse cx="81" cy="78" rx="12" ry="18" transform="rotate(-26 81 78)" fill="${i}"/><ellipse cx="113" cy="78" rx="12" ry="18" transform="rotate(20 113 78)" fill="${i}"/><path d="M135 75Q125 41 144 49Q158 62 135 75" fill="${i}"/>`;
 return seal+art;
}
function objectiveArt(s,state){
 const c=s.theme,alive=state.integrity>0,health=state.integrity/s.maxIntegrity;
 let art='';
 if(s.objectiveArt==='lighthouse'){
  art=`<ellipse cx="120" cy="224" rx="116" ry="22" fill="${c.shadow}"/><path d="M10 211L41 184L76 191L113 173L165 192L189 184L233 216Z" fill="#1b5961"/><path d="M77 193L89 75H151L165 193Z" fill="${alive?c.paper:'#73858a'}" stroke="${c.shadow}" stroke-width="4"/><path d="M84 126L156 100L159 133L80 158Z" fill="${alive?c.danger:'#495f66'}"/><path d="M83 75H157V42H83Z" fill="${alive?c.gold:'#294950'}" stroke="${c.shadow}" stroke-width="5"/><path d="M76 41L120 12L164 41Z" fill="${alive?c.danger:'#495f66'}"/>${line('M120 7V14 M105 45V73 M135 45V73',c.shadow,4)}<path d="M107 192V166Q120 153 133 166V192" fill="${c.shadow}"/>`;
  if(alive)art=`<path d="M83 51L-40 19V105L83 65 M157 51L280 19V105L157 65" fill="${c.gold}" opacity="${.09+.06*health}"/>`+art+`<rect x="88" y="46" width="64" height="25" fill="${c.gold}" opacity=".42"/>`;
  else art+=line('M128 80L110 111L132 126L109 160',c.shadow,4)+`<path d="M172 180L189 191L171 198Z" fill="${c.paper}"/>`;
 }else{
  art=`<ellipse cx="120" cy="224" rx="110" ry="23" fill="${c.shadow}"/><path d="M27 199Q120 170 213 199L203 222H36Z" fill="#906349"/><path d="M119 196Q${alive?'129 140 120 99':'143 150 169 142'}" fill="none" stroke="${alive?'#8fb977':'#a39581'}" stroke-width="9" stroke-linecap="round"/>`;
  if(alive)art+=`<path d="M123 140C62 141 58 89 67 87C109 83 128 106 123 140Z" fill="#a9d384"/><path d="M126 161C174 161 195 112 185 106C143 102 119 133 126 161Z" fill="#70ab79"/>${line('M79 103L119 136 M176 120L129 157','#33594a',3)}`;
  else art+=`<path d="M151 156C118 158 105 181 119 194C151 192 159 177 151 156Z M166 144C205 136 219 156 207 168C182 175 168 164 166 144Z" fill="#a69784"/>`;
  if(state.impacted&&!alive)art+=`<path d="M34 196L54 184L73 197L93 187L115 198L139 185L157 198L182 185L203 198" stroke="#d2e3da" stroke-width="8" fill="none"/>`;
 }
 return `<g aria-label="objective-art" data-integrity="${state.integrity}" transform="translate(520 243)">${art}</g>`;
}
function portraitCard({x,y,rotate=0,c,name,tag,art,value,kind,opacity=1}){
 return `<g transform="translate(${x} ${y}) rotate(${rotate} 128 176)" opacity="${opacity}" aria-label="${kind}-card"><rect x="7" y="12" width="256" height="348" rx="18" fill="#03171d" opacity=".5"/><rect width="256" height="348" rx="16" fill="${c.paper}" stroke="${c.gold}" stroke-width="3"/><rect x="10" y="10" width="236" height="328" rx="10" fill="none" stroke="${c.ink}" stroke-width="1" opacity=".6"/>${txt(22,42,Math.min(29,174/[...name].length),name,c.ink,'font-weight="700"')}<circle cx="217" cy="32" r="19" fill="${c.ink}"/>${txt(217,40,22,value,c.paper,'text-anchor="middle" font-weight="700"')}<g transform="translate(23 64)">${cardArt(art,c)}</g><path d="M24 263H232" stroke="${c.ink}" opacity=".4"/>${txt(128,293,22,tag,c.ink,'text-anchor="middle" font-weight="700"')}${txt(128,320,15,kind==='opponent'?'对手 · 必然发生':'行动 · 选择后生效',c.ink,'text-anchor="middle" opacity=".7"')}</g>`;
}
function pips({x,y,n,filled,c,r=8,gap=27}){return Array.from({length:n},(_,k)=>`<circle cx="${x+k*gap}" cy="${y}" r="${r}" fill="${k<filled?c:'none'}" stroke="${c}" stroke-width="2" opacity="${k<filled?1:.25}"/>`).join('');}
export function renderDuel({frame,scenario=DEFAULT_SCENARIO,choice=scenario.choices[0].id,fps=30,selectSec=4,width=1280,height=720,showCaptions=true}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<180||Math.abs(width/height-16/9)>.002)throw new TypeError('Only 16:9 landscape composition supported');
 if(typeof showCaptions!=='boolean')throw new TypeError('showCaptions must be boolean');
 const st=duelState({frame,scenario,choice,fps,selectSec}),c=scenario.theme,time=st.time,t=st.t;
 const card=scenario.choices.find(v=>v.id===(st.chosen?choice:scenario.choices[0].id));
 const deal=ease(t/1.1),move=ease(st.cardProgress),lift=Math.sin(Math.PI*st.cardProgress)*24;
 const impact=st.impacted?Math.max(0,1-(frame-time.impact)/(fps*.65)):0;
 const selectedX=mix(-290,91,deal)+move*34,selectedY=211-move*19-lift;
 const enemyX=mix(1310,934,deal)+impact*14,enemyY=211-impact*7;
 const fieldProgress=st.committed?ease((frame-time.commit)/(fps*.6)):0;
 const shieldAlpha=st.impacted?(st.guard>0?1:clamp(1-st.resolveProgress*2)):fieldProgress;
 const protection=st.committed&&card.guard>0;
 const contactX=protection?747:scenario.objectiveArt==='lighthouse'?677:705;
 const allText=showCaptions;
 const phaseLabels={choose:'选一张牌，承担它的代价',commit:'从手牌，到承诺',protect:card.guard>0?'先付出资源，再建立防护':'付出补给，物资已经收回',attack:'对手出牌，冲突开始',resolve:'规则结算，世界随之改变',result:outcomeCaption(scenario,st)};
 const parts=[];
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 720" role="img" aria-label="${esc(scenario.name)}卡牌对抗，第${st.frame}帧"><defs><radialGradient id="table"><stop stop-color="${c.table}"/><stop offset="1" stop-color="${c.shadow}"/></radialGradient><pattern id="felt" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 3H5M6 9H11" stroke="${c.paper}" opacity=".025"/></pattern></defs><g font-family="Noto Sans CJK SC,Noto Sans SC,DejaVu Sans,sans-serif"><rect width="1280" height="720" fill="url(#table)"/><rect width="1280" height="720" fill="url(#felt)"/><rect x="25" y="24" width="1230" height="672" rx="28" stroke="${c.gold}" fill="none" opacity=".25"/><path d="M46 149H1234 M46 595H1234" stroke="${c.gold}" opacity=".22"/>`);
 parts.push(`<circle cx="640" cy="350" r="185" fill="none" stroke="${c.gold}" opacity=".12"/><circle cx="640" cy="350" r="174" fill="none" stroke="${c.gold}" opacity=".07"/>`);
 for(let a=0;a<24;a++){const r=a*Math.PI/12;parts.push(line(`M${640+178*Math.cos(r)} ${350+178*Math.sin(r)}L${640+185*Math.cos(r)} ${350+185*Math.sin(r)}`,c.gold,1,'opacity=".25"'));}
 if(allText)parts.push(txt(56,48,12,`CARD CONFLICT  /  ${scenario.chapter}`,c.gold,'letter-spacing="3"'),txt(54,96,Math.min(42,570/[...scenario.name].length),scenario.name,c.paper,'font-weight="700"'),txt(56,128,18,scenario.goal,c.paper,'opacity=".7"'),txt(1168,47,14,'剩余补给',c.paper,'text-anchor="end" opacity=".7"'));
 parts.push(`<g aria-label="energy" data-value="${st.energy}">${pips({x:1169-(scenario.energy-1)*32,y:81,n:scenario.energy,filled:st.energy,c:c.gold,r:10,gap:32})}</g>`);
 if(allText)parts.push(txt(1168,123,14,'演示规则值 · 非实测数据',c.paper,'text-anchor="end" opacity=".45"'));
 // A stable visible target, not a stat label, carries the result.
 parts.push(objectiveArt(scenario,st));
 parts.push(`<g aria-label="integrity" data-value="${st.integrity}">${pips({x:640-(scenario.maxIntegrity-1)*13.5,y:206,n:scenario.maxIntegrity,filled:st.integrity,c:c.accent,r:7})}</g>`);
 if(allText)parts.push(txt(640,179,16,scenario.objective,c.paper,'text-anchor="middle" opacity=".72"'));
 if(protection&&shieldAlpha>0)parts.push(`<g aria-label="shield" opacity="${shieldAlpha}"><path d="M640 224C598 246 552 248 535 250V340C535 418 588 462 640 490C692 462 745 418 745 340V250C700 248 670 242 640 224Z" fill="${c.accent}" fill-opacity=".06" stroke="${c.accent}" stroke-width="4" stroke-dasharray="${fieldProgress*880} 880"/><path d="M640 239L550 262V340C550 407 593 448 640 474C687 448 730 407 730 340V262Z" fill="none" stroke="${c.accent}" opacity=".28"/></g>`);
 if(st.committed&&st.reward){parts.push(`<g aria-label="reward-art" transform="translate(763 447)"><rect x="0" y="0" width="35" height="29" rx="4" fill="${c.gold}" stroke="${c.shadow}" stroke-width="3"/><path d="M6 4L29 25M29 4L6 25" stroke="${c.ink}" stroke-width="2"/></g>`);}
 if(frame>=time.attack&&frame<time.impact){
  const p=ease(st.attackProgress),x=mix(913,contactX,p),y=349-Math.sin(p*Math.PI)*31;
  parts.push(`<g aria-label="incoming-threat" data-tip-x="${x}" data-contact-x="${contactX}"><path d="M913 348Q840 285 ${x} ${y}" stroke="${c.danger}" stroke-width="3" fill="none" opacity=".5"/><path d="M${x} ${y}l28-15 28 15-28 15Z" fill="${c.danger}"/>${pips({x:x+18,y:y,n:scenario.threat.power,filled:scenario.threat.power,c:c.paper,r:2,gap:9})}</g>`);
 }
 if(impact>0){const radius=(1-impact)*100+18;parts.push(`<g aria-label="impact" data-contact-x="${contactX}" opacity="${impact}"><circle cx="${contactX}" cy="349" r="${radius}" stroke="${protection?c.accent:c.danger}" stroke-width="4" fill="none"/>`);for(let k=0;k<8;k++){const a=k*Math.PI/4,x=contactX;parts.push(line(`M${x+radius*Math.cos(a)} ${349+radius*Math.sin(a)}L${x+(radius+18)*Math.cos(a)} ${349+(radius+18)*Math.sin(a)}`,protection?c.accent:c.danger,3));}parts.push('</g>');}
 if(st.committed&&frame<time.commit+fps*.75){
  const pulse=clamp((frame-time.commit)/(fps*.75));
  parts.push(`<path d="M391 369Q450 345 532 350" fill="none" stroke="${c.gold}" stroke-width="3" stroke-dasharray="${pulse*160} 160" opacity="${1-pulse}"/>`);
 }
 parts.push(`<rect x="116" y="184" width="274" height="363" rx="22" fill="none" stroke="${c.gold}" stroke-width="1" stroke-dasharray="6 8" opacity="${st.committed?.45:.13}"/>`);
 // The selected card is a concrete actor: lift, commit, then settle. No resource is paid on hover.
 parts.push(portraitCard({x:selectedX,y:selectedY,rotate:mix(-8,st.chosen?-2:0,deal)-Math.sin(st.cardProgress*Math.PI)*4,c,name:card.name,tag:card.tag,art:card.art,value:card.cost,kind:'action'}));
 parts.push(portraitCard({x:enemyX,y:enemyY,rotate:mix(9,2,deal)+impact*3,c:{...c,gold:c.danger},name:scenario.threat.name,tag:`冲击强度 ${scenario.threat.power}`,art:scenario.threat.art,value:scenario.threat.power,kind:'opponent'}));
 if(allText&&st.chosen)parts.push(txt(254,580,17,`补给 −${card.cost}  ·  防护 +${card.guard}${card.reward?'  ·  物资 +'+card.reward:''}`,c.paper,'text-anchor="middle" opacity=".8"'));
 if(allText&&!st.chosen)parts.push(txt(255,580,17,scenario.choices.map(v=>v.name).join('  /  '),c.gold,'text-anchor="middle"'));
 if(allText)parts.push(txt(1060,580,17,'预告之后，才会落下',c.paper,'text-anchor="middle" opacity=".62"'));
 // Rules are a projection of engine state; they do not control the outcome.
 if(allText&&st.committed){
  parts.push(txt(640,519,16,st.impacted?`冲击 ${scenario.threat.power} − 抵挡 ${st.blocked} = 损伤 ${st.damage}`:`防护 ${st.guard}  /  目标完好 ${st.integrity}`,st.impacted&&!st.success?c.danger:c.accent,'text-anchor="middle" font-weight="700"'));
  if(st.impacted)parts.push(txt(640,547,13,st.success?'目标守住':'目标失守',st.success?c.accent:c.danger,'text-anchor="middle" letter-spacing="4"'));
 }
 if(allText){parts.push(txt(640,640,25,phaseLabels[st.phase],c.paper,'text-anchor="middle" font-weight="700"'),txt(640,674,12,'选择 → 支付 → 防护 / 收获 → 对手接触 → 规则结算 → 后果',c.gold,'text-anchor="middle" letter-spacing="1"'));}
 parts.push(`<path d="M48 694H${48+1184*Math.min(1,t/16)}" stroke="${c.accent}" stroke-width="2" opacity=".55"/></g></svg>`);
 const svg=parts.join('');
 return showCaptions?svg:svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,'');
}
