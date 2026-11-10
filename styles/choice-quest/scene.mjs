/**
 * Original choice-story artwork and deterministic frame clock.
 * Method inspiration: vibe-knowledge RPG choice/dialogue grammar; no copied art,
 * sample movie, font, soundtrack, code, character, or source plot.
 */
export const QUEST = Object.freeze({fps:30, width:1280, height:720, seconds:18, frames:540});
export const COLORS = Object.freeze({ink:'#14272c',panel:'#20393e',edge:'#456263',paper:'#f0e5c7',muted:'#a4bab1',gold:'#e9bb65',teal:'#79ccba',red:'#df785d',sky:'#253d48',water:'#345c66'});
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix = (a,b,t)=>a+(b-a)*clamp(t);
const progress = (t,a,b)=>clamp((t-a)/(b-a));
const snap = (v,step=2)=>Math.round(v/step)*step;
const escape = text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = (n,name)=>{if(!Number.isFinite(n)) throw new TypeError(`${name} must be finite`);return n;};

/** Reusable, seekable state ledger. Events replace explicit scalar fields only. */
export function evaluateChoiceEvents({frame,initial,events}) {
  if(!Number.isInteger(frame)||frame<0)throw new RangeError('frame must be a non-negative integer');
  if(!initial||typeof initial!=='object'||Array.isArray(initial))throw new TypeError('initial must be an object');
  if(!Array.isArray(events))throw new TypeError('events must be an array');
  for(const [key,value] of Object.entries(initial)){
    if(['__proto__','constructor','prototype'].includes(key))throw new Error('initial state fields must be safe');
    if(!['number','string','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value)))throw new TypeError('initial state values must be finite scalars');
  }
  const result={...initial},ids=new Set();let previous=-1;
  for(const event of events){
    if(typeof event.id!=='string'||!event.id||ids.has(event.id))throw new Error('event IDs must be nonempty and unique');
    ids.add(event.id);
    if(!Number.isInteger(event.atFrame)||event.atFrame<previous||event.atFrame<0)throw new RangeError('events must be ordered by non-negative integer frame');
    previous=event.atFrame;
    if(!event.set||typeof event.set!=='object'||Array.isArray(event.set))throw new TypeError('event.set must be an object');
    for(const [key,value] of Object.entries(event.set)){
      if(!Object.hasOwn(initial,key)||['__proto__','constructor','prototype'].includes(key))throw new Error('event must name a declared safe state field');
      if(!['number','string','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value)))throw new TypeError('event values must be finite scalars');
      if(typeof value!==typeof initial[key])throw new TypeError('event values must preserve their declared scalar type');
      if(frame>=event.atFrame)result[key]=value;
    }
  }
  return Object.freeze(result);
}

export function questTiming(selectSec=6.5) {
  finite(selectSec,'selectSec');
  if(selectSec<5.5||selectSec>7.5) throw new RangeError('selectSec must be 5.5..7.5 seconds');
  return Object.freeze({select:selectSec,reach:selectSec+1.3,contact:selectSec+2.5,bridgeStart:selectSec+2.9,bridgeEnd:selectSec+4.1,crossStart:selectSec+4.5,crossEnd:selectSec+8.6,beacon:selectSec+9.0});
}

/** 0-based renderer frame. The returned state never depends on earlier calls. */
export function questState({frame,fps=30,branch='repair',selectSec=6.5}={}) {
  finite(frame,'frame');finite(fps,'fps');
  if(frame<0||!Number.isInteger(frame)) throw new RangeError('frame must be a non-negative integer');
  if(fps<1) throw new RangeError('fps must be at least 1');
  if(!['repair','wait'].includes(branch)) throw new RangeError('branch must be repair or wait');
  const t=Math.min(frame/fps,QUEST.seconds-1/fps), timing=questTiming(selectSec);
  const selected=t>=timing.select, repairing=selected&&branch==='repair';
  const ledger=evaluateChoiceEvents({frame,initial:{inventory:1,terminalPowered:false,cellOwner:'courier'},events:branch==='repair'?[{id:'insert-cell',atFrame:Math.ceil(timing.contact*fps),set:{inventory:0,terminalPowered:true,cellOwner:'terminal'}}]:[]});
  const inserted=repairing&&ledger.terminalPowered;
  const bridge=inserted?progress(t,timing.bridgeStart,timing.bridgeEnd):0;
  const crossing=inserted&&t>=timing.crossStart;
  const heroX=snap(t<3.0?mix(270,466,progress(t,0.8,3)):crossing?mix(466,938,progress(t,timing.crossStart,timing.crossEnd)):466);
  const moving=(t>=0.8&&t<3)||(crossing&&t<timing.crossEnd);
  const walkFrame=moving?Math.floor(t*8)%4:0;
  const reach=repairing?progress(t,timing.reach,timing.contact):0;
  const cellX=inserted?502:snap(mix(heroX+26,502,reach));
  const cellY=inserted?418:snap(mix(424,418,reach));
  const release=progress(t,timing.contact+0.35,timing.contact+0.7);
  const palmX=inserted?snap(mix(502,heroX+24,release)):cellX;
  const palmY=inserted?snap(mix(418,430,release)):cellY;
  const beacon=repairing&&t>=timing.beacon;
  let phase=t<3?'approach':!selected?'choice':branch==='wait'?'wait':!inserted?'reach':bridge<1?'bridge':!beacon?'cross':'result';
  const messages={approach:'雾谷驿站就在对岸。',choice:'断桥没有电。要用掉最后一枚电芯吗？',reach:'把电芯接入桥头终端。',bridge:'电流接通，桥面正在展开。',cross:'路通了。带着信件继续前行。',result:'抵达驿站，山谷信标重新亮起。',wait:'电芯保留下来，断桥仍未接通。'};
  const starts={approach:0.3,choice:3,reach:timing.select,bridge:timing.contact,cross:timing.bridgeEnd,result:timing.beacon,wait:timing.select};
  const message=messages[phase], count=Math.max(0,Math.floor((t-starts[phase])*15));
  return Object.freeze({t,frame,fps,branch,timing,phase,selected,heroX,moving,walkFrame,palmX,palmY,cellX,cellY,cellOwner:ledger.cellOwner,inventory:ledger.inventory,terminalPowered:inserted,bridge,crossing,beacon,caption:message.slice(0,count),message,option:!selected?(t<5.5?'wait':'repair'):branch});
}

const rect=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const path=(d,fill,extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
const text=(x,y,txt,size=24,color=COLORS.paper,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${escape(txt)}</text>`;
function cell(x,y,filled=true,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})">${rect(-8,-13,16,26,filled?COLORS.gold:'#466167')}${rect(-4,-17,8,4,filled?COLORS.paper:'#466167')}${rect(-4,-9,8,18,filled?'#fff0a4':'#243d43')}${path('M1 -8L-4 1H0L-1 9L5 -2H1Z',filled?'#9b7540':'#5a7779')}</g>`;}
function pine(x,y,h,color){return `<g transform="translate(${x} ${y})">${rect(-4,-h*.25,8,h*.25,color)}${path(`M0 ${-h}L${h*.21} ${-h*.6}H${h*.12}L${h*.32} ${-h*.24}H${-h*.32}L${-h*.12} ${-h*.6}H${-h*.21}Z`,color)}</g>`;}
function courier(s){
  const x=s.heroX,y=466,w=s.walkFrame;
  const legA=[0,-5,0,5][w],legB=-legA;
  return `<g aria-label="courier" shape-rendering="crispEdges">
    ${rect(x-28,y+4,58,6,'#203d42')}
    ${rect(x-16,y-28,13,27,'#20333b')}${rect(x+3,y-28,13,27,'#20333b')}
    ${rect(x-20+legA,y-5,19,7,'#e1c496')}${rect(x+3+legB,y-5,19,7,'#e1c496')}
    ${rect(x-28,y-58,14,35,'#a76a45')}${rect(x-26,y-56,10,6,'#d09a66')}
    ${rect(x-19,y-61,38,38,'#719e8e')}${rect(x-19,y-38,38,8,'#4d766c')}
    ${rect(x-12,y-83,28,27,'#e3b88f')}${rect(x+10,y-74,9,10,'#e3b88f')}
    ${rect(x-17,y-91,37,12,'#c99052')}${rect(x-25,y-80,48,7,'#e3b269')}
    ${rect(x+10,y-71,4,5,'#20333b')}${rect(x-15,y-62,38,8,COLORS.red)}
    ${rect(x-34,y-60,20,7,COLORS.red)}${rect(x-38,y-55,10,9,'#b95f49')}
    ${path(`M${x+14} ${y-54}L${s.palmX} ${s.palmY}`, 'none',`stroke="#86ac97" stroke-width="12"`)}
    ${rect(s.palmX-5,s.palmY-5,10,10,'#e3b88f')}
  </g>`;
}
function world(s){
  const c=COLORS;let a='';
  a+=rect(32,128,1216,386,c.sky);
  a+=rect(32,186,1216,80,'#304b55')+rect(32,266,1216,89,'#49656a');
  a+=path('M32 348V300H84V270H124V240H164V204H204V240H244V272H294V300H344V338H410V514H32Z','#395863');
  a+=path('M164 240V204H204V240H228V250H190V232H178V250H146V240Z','#6b8180');
  a+=path('M380 350V290H428V254H470V214H514V180H550V214H584V248H626V288H676V354Z','#3e5e67');
  a+=path('M470 224V214H514V180H550V214H572V224H550V212H534V236H516V212H502V224Z','#82928a');
  a+=path('M740 356V314H790V286H836V246H872V226H912V258H954V300H1014V344H1060V380Z','#4f6f72');
  for(let i=0;i<27;i++)a+=rect(52+(i*137)%1168,143+(i*47)%112,3,3,i%3?'#6c888a':'#b5c3af');
  a+=rect(1086,166,24,8,'#d9d8b6')+rect(1078,174,40,24,'#d9d8b6')+rect(1086,198,24,8,'#d9d8b6')+rect(1094,166,24,24,c.sky);
  for(let i=0;i<22;i++)a+=pine(38+i*57,406,72+(i*31)%58,i%2?'#304e51':'#3b5d5b');
  a+=rect(32,428,1216,86,c.water);
  for(let i=0;i<24;i++){const x=50+(i*67+Math.floor(s.t*5))%1170;const y=446+(i*19)%60;a+=rect(x,y,16+(i%4)*10,3,i%2?'#497783':'#6d9695');}
  // Two banks leave a real gap. The bridge is the only walkable connector.
  a+=path('M32 414H532V438H518V454H510V480H494V514H32Z','#344a47');
  a+=path('M32 410H532V426H512V438H32Z','#80946c');
  a+=rect(32,410,500,7,'#bcc79a');
  a+=path('M748 410H1248V514H778V480H764V450H748Z','#344a47');
  a+=path('M748 410H1248V438H768V426H748Z','#80946c');a+=rect(748,410,500,7,'#bcc79a');
  // Raised walking platforms clarify the horizon and prevent feet floating.
  a+=rect(32,466,500,12,'#cbb78a')+rect(32,478,480,8,'#756750');
  a+=rect(748,466,500,12,'#cbb78a')+rect(768,478,480,8,'#756750');
  for(let i=0;i<12;i++)a+=rect(45+i*40,469,26,3,'#9f906b');
  for(let i=0;i<12;i++)a+=rect(762+i*40,469,26,3,'#9f906b');
  // Bridge extension is gated by the inserted cell and measured in grid steps.
  const bw=Math.floor(216*s.bridge/6)*6;
  if(bw>0){a+=rect(532,466,bw,12,'#d7be83');a+=rect(532,478,bw,6,'#766e53');for(let x=538;x<532+bw;x+=24)a+=rect(x,468,4,8,'#88794f');}
  if(s.bridge===1){for(let x=540;x<=748;x+=52)a+=rect(x,438,5,29,'#879d8e');a+=rect(540,438,208,5,'#b6c7a4');}
  // The cell is physically inserted into this socket; the indicator precedes motion.
  a+=rect(484,400,36,66,'#536f69')+rect(480,395,44,10,'#a2b5a0')+rect(489,405,26,30,'#203a40');
  a+=rect(491,445,22,6,s.terminalPowered?c.teal:c.red);
  // Original little mountain relay station, separate from the reference artwork.
  a+=rect(994,354,112,112,'#9c8460')+rect(1002,366,96,94,'#ba9d72');
  a+=path('M978 356H986V344H998V332H1102V344H1114V356Z','#61483f');
  a+=rect(1016,390,28,76,'#3d4d49')+rect(1021,395,18,65,'#6d7660');
  a+=rect(1056,386,28,28,s.beacon?c.gold:'#3d555a')+rect(1068,386,4,28,'#aa956e')+rect(1056,398,28,4,'#aa956e');
  a+=rect(1032,294,38,40,'#c4b98a')+rect(1026,286,50,10,'#6b5547')+rect(1038,304,26,22,s.beacon?'#ffe7a3':'#52665f');
  a+=rect(1048,270,8,16,'#c4b98a')+rect(1048,270,33,7,COLORS.red);
  if(s.beacon){a+=path('M1042 310L860 272V350L1042 320Z','#e9bb65','opacity=".16"');a+=path('M1060 310L1216 276V350L1060 320Z','#e9bb65','opacity=".16"');}
  for(const [x,y,h] of [[95,466,84],[150,463,111],[1175,466,140],[1235,466,94]])a+=pine(x,y,h,'#203e40');
  a+=courier(s);
  a+=cell(s.cellX,s.cellY,true,.7);
  if(s.terminalPowered){const dx=Math.floor(progress(s.t,s.timing.contact,s.timing.bridgeEnd)*240/8)*8;a+=rect(510,456,Math.min(dx,238),3,c.teal);}
  a+=rect(32,510,1216,4,'#637a6d');
  return a;
}
function ui(s,showCaptions){
  const c=COLORS;let a='';
  a+=text(48,48,'雾谷驿站',30,c.paper,'font-weight="800"');
  a+=text(49,78,'CHOICE QUEST  /  原创游戏叙事样片',14,c.muted,'letter-spacing="2"');
  a+=rect(1040,28,192,60,c.panel)+rect(1040,28,4,60,c.gold)+cell(1066,60,s.inventory===1,.65);
  a+=text(1090,53,'剩余电芯',13,c.muted)+text(1090,76,String(s.inventory)+' 枚',22,c.paper,'font-weight="700"');
  const beats=[['遇阻',s.t>=3],['选择',s.selected],['行动',s.terminalPowered],['后果',s.beacon]];
  beats.forEach(([label,active],i)=>{const x=594+i*104;a+=rect(x,44,8,8,active?c.gold:'#496469');if(i<3)a+=rect(x+14,47,70,2,'#496469');a+=text(x+4,73,label,14,active?c.paper:c.muted,'text-anchor="middle"');});
  a+=text(48,112,'01  雾谷 · 北岸',14,c.muted,'letter-spacing="1"');
  a+=text(1232,112,s.beacon?'信标已点亮':s.bridge===1?'通路已接通':'任务  把信送到对岸',14,s.beacon?c.gold:c.muted,'text-anchor="end"');
  a+=rect(32,538,744,150,c.panel)+rect(32,538,744,4,c.edge)+rect(32,538,4,150,c.edge)+rect(772,538,4,150,c.edge)+rect(32,684,744,4,c.edge);
  a+=rect(52,525,108,30,c.ink)+text(68,548,'邮差 · 阿苔',15,c.gold,'font-weight="700"');
  if(showCaptions){a+=text(60,596,s.caption,28,c.paper,'font-weight="600"');a+=text(60,651,s.phase==='result'?'选择改变了场景，也留下了代价。':s.phase==='wait'?'另一条分支：资源不变，目标未完成。':'先读局面，再做选择。',16,c.muted);}
  const prompt=!s.selected?'你会怎么选？':s.branch==='repair'?'已选择：给桥供电':'已选择：保留电芯';
  a+=text(806,548,prompt,15,c.muted);
  for(const [i,id,label] of [[0,'repair','给桥供电'],[1,'wait','保留电芯']]){
    const y=566+i*62,active=s.option===id;a+=rect(802,y,446,52,active?'#d4bd88':'#253f44');
    a+=rect(802,y,4,52,active?c.gold:c.edge);
    if(active)a+=path(`M820 ${y+17}L832 ${y+26}L820 ${y+35}Z`,c.ink);
    a+=text(846,y+34,label,23,active?c.ink:c.muted,'font-weight="700"');
    a+=text(1224,y+33,id==='repair'?'−1 电芯':'暂缓',16,active?c.ink:c.muted,'text-anchor="end"');
  }
  if(!showCaptions)a+=text(60,648,'字幕隐藏 · 检查角色、道具与桥的变化',15,c.muted);
  return a;
}

export function renderQuest({frame,fps=30,width=1280,height=720,branch='repair',selectSec=6.5,showCaptions=true}={}){
  finite(width,'width');finite(height,'height');
  if(width<=0||height<=0||Math.abs(width/height-16/9)>0.001)throw new RangeError('Choice Quest supports 16:9 layouts; portrait needs a new layout');
  const s=questState({frame,fps,branch,selectSec});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1280 720" role="img" aria-label="${escape('选项冒险：'+s.message)}"><rect width="1280" height="720" fill="${COLORS.ink}"/><g font-family="Noto Sans CJK SC, sans-serif">${world(s)}${ui(s,showCaptions)}</g></svg>`;
}
