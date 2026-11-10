/** Original transit-narrative engine. All state derives from graph + frame, never a clock. */
export const TRANSIT = Object.freeze({fps:30,seconds:18,frames:540,width:1280,height:720});
export const PALETTE = Object.freeze({paper:'#f5f0e5',ink:'#1d3037',muted:'#65716e',grid:'#e3dfd4',people:'#d95b38',venue:'#21877c',joined:'#253b42',yellow:'#efd16d'});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const n=x=>Number(x.toFixed(3));
const time=x=>Math.round(x*1e9)/1e9;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=(x,label,min=0)=>{if(!Number.isFinite(x)||x<min)throw new TypeError(`${label} must be finite and >= ${min}`);};
const safeId=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(x);

/** Sources begin at startAt. Other stations release only when ALL inbound edges arrive.
 * A blocked edge can reveal a partial track, but never counts as an arrival.
 * Cycles are rejected: use distinct event nodes for a revisited physical station.
 */
export function compileTransit(graph){
 if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)||graph.nodes.length<2)throw new TypeError('graph requires nodes and edges');
 const nodes=new Map(),edges=new Map(),incoming=new Map(),outgoing=new Map();
 for(const node of graph.nodes){
  if(!safeId(node.id)||nodes.has(node.id))throw new Error('Node IDs must be unique safe identifiers');
  if(typeof node.label!=='string')throw new TypeError('Each node needs a text label');
  finite(node.dwell??0,`${node.id}.dwell`);
  if(node.startAt!==undefined)finite(node.startAt,`${node.id}.startAt`);
  nodes.set(node.id,node);incoming.set(node.id,[]);outgoing.set(node.id,[]);
 }
 for(const edge of graph.edges){
  if(!safeId(edge.id)||edges.has(edge.id))throw new Error('Edge IDs must be unique safe identifiers');
  if(!nodes.has(edge.from)||!nodes.has(edge.to))throw new Error('Edge endpoint does not exist');
  finite(edge.duration,`${edge.id}.duration`,.001);
  if(edge.blockedAt!==undefined){finite(edge.blockedAt,`${edge.id}.blockedAt`);if(edge.blockedAt<=0||edge.blockedAt>=1)throw new Error('blockedAt must be between 0 and 1');}
  if(!['people','venue','joined'].includes(edge.line))throw new Error('Unknown line');
  edges.set(edge.id,edge);incoming.get(edge.to).push(edge.id);outgoing.get(edge.from).push(edge.id);
 }
 const visiting=new Set(),scheduleNodes=Object.create(null),scheduleEdges=Object.create(null);
 function visit(id){
  if(scheduleNodes[id])return scheduleNodes[id];
  if(visiting.has(id))throw new Error('Transit event graph must be acyclic');
  visiting.add(id);const node=nodes.get(id),ins=incoming.get(id);let arrivals=[];
  if(ins.length&&node.startAt!==undefined)throw new Error('Only source nodes may specify startAt');
  if(!ins.length&&node.startAt===undefined)throw new Error('Source nodes require startAt');
  for(const eid of ins){const edge=edges.get(eid),source=visit(edge.from),start=source.releaseAt;
   const arrival=edge.blockedAt===undefined?time(start+edge.duration):Infinity;
   scheduleEdges[eid]={...edge,startAt:start,arriveAt:arrival,stopAt:edge.blockedAt===undefined?arrival:time(start+edge.duration*edge.blockedAt)};arrivals.push(arrival);
  }
  const firstAt=ins.length?Math.min(...arrivals):node.startAt;
  const readyAt=ins.length?Math.max(...arrivals):node.startAt;
  const result={...node,incoming:[...ins],outgoing:[...outgoing.get(id)],firstAt,readyAt,releaseAt:time(readyAt+(node.dwell??0))};
  scheduleNodes[id]=result;visiting.delete(id);return result;
 }
 for(const id of nodes.keys())visit(id);
 return {nodes:scheduleNodes,edges:scheduleEdges,terminalIds:[...nodes.keys()].filter(id=>outgoing.get(id).length===0)};
}

export function transitState(graph,frame,fps=30){
 finite(frame,'frame');finite(fps,'fps',.001);const compiled=compileTransit(graph),t=frame/fps,nodes=Object.create(null),edges=Object.create(null);
 for(const [id,edge] of Object.entries(compiled.edges)){
  const p=Number.isFinite(edge.startAt)?clamp((t-edge.startAt)/edge.duration,0,edge.blockedAt??1):0;
  edges[id]={...edge,progress:p,started:t>=edge.startAt,arrived:t>=edge.arriveAt,blocked:edge.blockedAt!==undefined&&t>=edge.stopAt,active:t>=edge.startAt&&t<edge.arriveAt};
 }
 for(const [id,node] of Object.entries(compiled.nodes)){
  const arrived=node.incoming.filter(eid=>edges[eid].arrived);
  nodes[id]={...node,visible:t>=node.firstAt,ready:t>=node.readyAt,released:t>=node.releaseAt,arrivedCount:arrived.length,waiting:t>=node.firstAt&&t<node.readyAt,reveal:ease((t-node.firstAt)/.3)};
 }
 return {t,nodes,edges,complete:compiled.terminalIds.every(id=>nodes[id].ready)};
}

/** This fictional demonstration is data, not renderer-specific choreography. */
export function makeOpeningStory({delay=0,blocked=false}={}){
 finite(delay,'delay');if(delay>8)throw new RangeError('Demo delay must be <= 8 seconds');if(typeof blocked!=='boolean')throw new TypeError('blocked must be boolean');
 return {title:'开门之前，还缺一条线。',subtitle:'一场虚构放映会 / 两条准备线，缺一不可',nodes:[
  {id:'invite',label:'发出邀请',startAt:.8,line:'people'},
  {id:'guests',label:'观众到齐',dwell:.4,line:'people'},
  {id:'venue',label:'场地确认',startAt:1.3+delay,line:'venue'},
  {id:'sound',label:'声音就位',dwell:.4,line:'venue'},
  {id:'lights',label:'放映就绪',dwell:.4,line:'venue'},
  {id:'join',label:'双线会合',dwell:1.1,line:'joined'},
  {id:'open',label:'开场',line:'joined'}],edges:[
  {id:'invite-guests',from:'invite',to:'guests',duration:2.2,line:'people'},
  {id:'guests-join',from:'guests',to:'join',duration:2.3,line:'people'},
  {id:'venue-sound',from:'venue',to:'sound',duration:2.4,line:'venue'},
  {id:'sound-lights',from:'sound',to:'lights',duration:2.3,line:'venue'},
  {id:'lights-join',from:'lights',to:'join',duration:2.4,line:'venue',...(blocked?{blockedAt:.55}:{})},
  {id:'join-open',from:'join',to:'open',duration:2,line:'joined'}]};
}

export function layoutFor(width,height){
 finite(width,'width',1);finite(height,'height',1);
 const ratio=width/height,portrait=ratio<1;
 if(Math.abs(ratio-(portrait?9/16:16/9))>.002)throw new Error('Use 16:9 or 9:16; other aspect ratios need a deliberate layout');
 return portrait?{portrait,w:720,h:1280,positions:{invite:[138,320],guests:[138,550],venue:[558,320],sound:[558,490],lights:[558,660],join:[360,850],open:[360,1050]},via:{'guests-join':[[138,628]],'lights-join':[[550,660]]}}:
 {portrait,w:1280,h:720,positions:{invite:[128,282],guests:[365,282],venue:[128,492],sound:[345,492],lights:[570,492],join:[820,370],open:[1110,370]},via:{'guests-join':[[600,282],[688,370]],'lights-join':[[698,492]]}};
}

export function routePoints(edge,layout){
 const points=[layout.positions[edge.from],...(layout.via[edge.id]??[]),layout.positions[edge.to]];
 if(points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw new Error(`Missing or invalid layout for ${edge.id}`);
 return points.filter((p,i)=>i===0||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
}
export function pointOnRoute(points,progress){
 if(!Array.isArray(points)||points.length<2||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw new Error('Route requires at least two finite coordinate pairs');
 finite(progress,'progress');
 const segments=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
 const length=segments.reduce((a,b)=>a+b,0);if(length===0)throw new Error('Route length must be positive');
 let distance=clamp(progress)*length;
 for(let i=0;i<segments.length;i++){if(distance<=segments[i]||i===segments.length-1){const q=segments[i]===0?0:distance/segments[i];return {x:points[i][0]+(points[i+1][0]-points[i][0])*q,y:points[i][1]+(points[i+1][1]-points[i][1])*q,length};}distance-=segments[i];}
}
const text=(x,y,value,size=20,attrs='')=>`<text x="${n(x)}" y="${n(y)}" font-size="${size}" ${attrs}>${esc(value)}</text>`;
function token(x,y,line,size=1){
 const glyph=line==='people'?`<circle cx="0" cy="-4" r="3.6" fill="white"/><path d="M -6 6 Q 0 -2 6 6" fill="none" stroke="white" stroke-width="3"/>`:line==='venue'?`<path d="M -5 -6 L 7 0 -5 6 Z" fill="white"/>`:`<path d="M -6 0 l 4 4 8 -9" fill="none" stroke="white" stroke-width="3"/>`;
 return `<g transform="translate(${n(x)} ${n(y)}) scale(${size})"><circle r="17" fill="${PALETTE.paper}"/><circle r="13" fill="${PALETTE[line]}"/>${glyph}</g>`;
}
function stationLabel(id,pos,label,l,showCaptions){
 if(!showCaptions)return '';const [x,y]=pos;
 if(id==='join')return l.portrait?text(x+75,y+8,label,25,'text-anchor="start" font-weight="700"'):text(x,y+77,label,23,'text-anchor="middle" font-weight="700"');
 if(id==='open')return text(x,y+61,label,30,'text-anchor="middle" font-weight="800"');
 if(l.portrait){if(id==='invite')return text(x+38,y+8,label,23,'text-anchor="start" font-weight="600"');if(id==='venue')return text(x-38,y+8,label,23,'text-anchor="end" font-weight="600"');if(id==='guests')return text(x+38,y+8,label,23,'text-anchor="start" font-weight="600"');return text(x-38,y+8,label,23,'text-anchor="end" font-weight="600"');}
 return text(x,y+(id==='guests'?-36:50),label,23,'text-anchor="middle" font-weight="600"');
}

/** Pass a custom graph AND layout to tell a different story. No markup is trusted. */
export function renderTransit({frame=0,fps=30,width=1280,height=720,delay=0,blocked=false,showCaptions=true,graph,layout,idPrefix='transit'}={}){
 if(!safeId(idPrefix))throw new Error('Unsafe SVG ID');if(typeof showCaptions!=='boolean')throw new TypeError('showCaptions must be boolean');
 const story=graph??makeOpeningStory({delay,blocked}),l=layout??layoutFor(width,height),s=transitState(story,frame,fps),{w,h}=l;
 finite(width,'width',1);finite(height,'height',1);finite(w,'layout.w',1);finite(h,'layout.h',1);
 for(const id of Object.keys(s.nodes)){const p=l.positions?.[id];if(!p||p.length!==2||p.some(v=>!Number.isFinite(v)))throw new Error(`Missing node position: ${id}`);}
 const joins=Object.values(s.nodes).filter(node=>node.incoming.length>1),join=joins[0];
 let tracks='',markers='',stations='';
 for(const [id,edge] of Object.entries(s.edges)){
  const pts=routePoints(edge,l),p=pointOnRoute(pts,edge.progress),d=pts.map((v,i)=>`${i?'L':'M'} ${v.join(' ')}`).join(' ');
  if(edge.started){if(edge.progress>0)tracks+=`<path data-edge="${id}" d="${d}" fill="none" stroke="${PALETTE[edge.line]}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${n(p.length)} ${n(p.length)}" stroke-dashoffset="${n(p.length*(1-edge.progress))}"/>`;
   if(edge.active)markers+=token(p.x,p.y,edge.line);
   if(edge.blocked){markers+=`<g transform="translate(${n(p.x)} ${n(p.y-37)})"><rect x="-21" y="-15" width="42" height="30" rx="5" fill="${PALETTE.ink}"/><path d="M -5 -7 v 14 M 5 -7 v 14" stroke="${PALETTE.yellow}" stroke-width="4"/></g>`;}
  }
 }
 for(const [id,node] of Object.entries(s.nodes)){
  if(!node.visible)continue;const p=l.positions[id],[x,y]=p,arrival=ease((s.t-node.firstAt)/.35),color=PALETTE[node.line]??PALETTE.ink;
  const isJoin=node.incoming.length>1,isFinal=node.outgoing.length===0;
  let body='';
  if(isJoin){
   const readiness=node.ready?ease((s.t-node.readyAt)/.65):0;
   const rings=node.incoming.map((eid,i)=>{
    const edge=s.edges[eid],a=(-90+i*360/node.incoming.length+12)*Math.PI/180,b=(-90+(i+1)*360/node.incoming.length-12)*Math.PI/180;
    return `<path d="M ${n(31*Math.cos(a))} ${n(31*Math.sin(a))} A 31 31 0 ${b-a>Math.PI?1:0} 1 ${n(31*Math.cos(b))} ${n(31*Math.sin(b))}" fill="none" stroke="${edge.arrived?PALETTE[edge.line]:'#c9c5b7'}" stroke-width="7"/>`;
   }).join('');
   body=`<circle r="44" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="2"/><circle r="34" fill="${PALETTE.yellow}"/>${rings}`;
   if(node.ready)body+=`<path d="M -11 0 l 8 8 16 -18" fill="none" stroke="${PALETTE.ink}" stroke-width="4" stroke-linecap="round" opacity="${n(readiness)}"/>`;
   else body+=`<path d="M -5 -10 v 20 M 5 -10 v 20" stroke="${PALETTE.ink}" stroke-width="4"/>`;
   // Physical switch blades open only after the dependency gate is satisfied.
   const exit= node.outgoing[0] ? l.positions[s.edges[node.outgoing[0]].to] : [x+1,y];
   const angle=Math.atan2(exit[1]-y,exit[0]-x)*180/Math.PI;
   body+=`<g transform="rotate(${n(angle)}) translate(52 0)"><path d="M 0 -13 L ${n(readiness*18)} ${n(-13+26*(1-readiness))}" stroke="${PALETTE.ink}" stroke-width="5" stroke-linecap="round"/></g>`;
  }else if(isFinal){body=`<circle r="30" fill="${PALETTE.ink}"/><path d="M -10 -13 L 15 0 -10 13 Z" fill="${PALETTE.yellow}"/><circle r="40" fill="none" stroke="${PALETTE.ink}" stroke-width="1.5"/>`;}
  else body=`<circle r="11" fill="${PALETTE.paper}" stroke="${color}" stroke-width="5"/><circle r="3" fill="${color}"/>`;
  stations+=`<g data-station="${id}" opacity="${n(arrival)}"><g transform="translate(${x} ${y}) scale(${n(.82+.18*arrival)})">${body}</g>${stationLabel(id,p,node.label,l,showCaptions)}</g>`;
 }
 const ready=join?.ready??false,visible=join?.visible??false;
 const captions=story.captions??(graph?{complete:'所有终点已到达。',ready:'条件齐备，继续前进。',waiting:'等待其余线路到站。',moving:'各条线路并行推进。'}:{complete:'会合之后，一起开场。',ready:'两条线到齐，出口打开。',waiting:'人到了。另一条线，还在路上。',moving:'让每一条准备，各自推进。'});
 const phase=captions[s.complete?'complete':ready?'ready':visible?'waiting':'moving']??'';
 const chapter=s.complete?'04 / 开场':ready?'03 / 放行':visible?'02 / 等待换乘':'01 / 两线并行';
 const title=story.title??'每条线，都有到站条件。';
 const head=showCaptions?(l.portrait?text(54,123,title,35,'font-weight="800"')+text(54,166,story.subtitle??'原创线路叙事',18,'fill="#65716e"'):text(66,125,title,43,'font-weight="800"')+text(68,164,story.subtitle??'原创线路叙事',19,'fill="#65716e"')):'';
 const captionY=l.portrait?1197:637;
 const caption=showCaptions?`<path d="M ${l.portrait?54:66} ${captionY-37} H ${w-(l.portrait?54:66)}" stroke="#cfcabd"/>${text(l.portrait?54:66,captionY,phase,l.portrait?24:27,'font-weight="600"')}${!l.portrait?text(w-66,captionY,chapter,16,'text-anchor="end" fill="#65716e" font-family="monospace"'):''}`:'';
 const legend=(x,y,line,label,letter)=>`<g transform="translate(${x} ${y})"><rect width="27" height="27" rx="4" fill="${PALETTE[line]}"/>${text(13.5,19,letter,16,'fill="white" text-anchor="middle" font-weight="800"')}${showCaptions?text(38,20,label,17,'font-weight="700"'):''}</g>`;
 const lineNames=story.lineNames??(graph?{people:'A 线',venue:'B 线'}:{people:'观众线',venue:'场务线'});
 const mapLegend=l.portrait?legend(91,242,'people',lineNames.people,'A')+legend(493,242,'venue',lineNames.venue,'B'):legend(66,210,'people',lineNames.people,'A')+legend(66,420,'venue',lineNames.venue,'B');
 const count=showCaptions&&visible?text(l.positions[join.id][0],l.positions[join.id][1]+(l.portrait?-64:-65),`${join.arrivedCount} / ${join.incoming.length} 到站`,18,'text-anchor="middle" font-family="monospace" fill="#65716e"'):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><defs><pattern id="${idPrefix}-grid" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1" fill="${PALETTE.grid}"/></pattern></defs><rect width="${w}" height="${h}" fill="${PALETTE.paper}"/><rect x="20" y="20" width="${w-40}" height="${h-40}" rx="7" fill="none" stroke="#d2ccbf"/><rect width="${w}" height="${h}" fill="url(#${idPrefix}-grid)"/><g font-family="Noto Sans CJK SC, sans-serif" fill="${PALETTE.ink}">${text(l.portrait?54:66,58,'线路叙事 / TRANSIT STORY',14,'letter-spacing="2" font-family="monospace"')}${text(w-(l.portrait?54:66),58,'A2V · 003',13,'text-anchor="end" font-family="monospace"')}${head}${mapLegend}${tracks}${stations}${markers}${count}${caption}${text(l.portrait?54:66,h-35,'原创虚构示意 · 无声视觉原型',12,'fill="#65716e"')}${text(w-(l.portrait?54:66),h-35,'18s / EVENT-GATED',12,'text-anchor="end" fill="#65716e" font-family="monospace"')}</g></svg>`;
}
