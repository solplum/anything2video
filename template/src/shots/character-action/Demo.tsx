import React from 'react';
import {AbsoluteFill,useCurrentFrame,useVideoConfig} from 'remotion';
import {RisoPaper} from '../../common/riso';
import {createCharacterAction} from './timing';
const INK='#233E47',TEAL='#357D7C',CORAL='#D9583D',GOLD='#EDB94E';
/** Original silent causal micro-story: move a shaded bud into sunlight. */
export const CharacterActionDemo:React.FC<{contactSec?:number}>=({contactSec=3})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 return <AbsoluteFill><CharacterActionFrame frame={frame} fps={fps} contactSec={contactSec}/></AbsoluteFill>;
};
/** Exact shared artwork, also usable for explicitly labeled SSR still review. */
export const CharacterActionFrame:React.FC<{frame:number;fps:number;contactSec?:number}>=({frame,fps,contactSec=3})=>{
 const s=createCharacterAction(fps,{contactSec}).stateAt(frame);
 const x=s.actorX,headX=x+s.lean,headY=354;
 return <RisoPaper id="garden-action" width={1280} height={720} grainOpacity={.12}>
  <path d="M730 155H1020V380L1080 565H700L730 380Z" fill={GOLD} opacity={.19}/>
  <path d="M735 155H1010V380H735Z M872 155V380 M735 267H1010" fill="none" stroke={INK} strokeWidth={8}/>
  <circle cx={953} cy={211} r={27} fill={GOLD}/>
  <path d="M140 567H1125" stroke={INK} strokeWidth={5}/>
  <path d="M170 568V310Q220 285 267 310V568" fill={TEAL} opacity={.12}/>
  <path d="M185 568V335M220 568V327M253 568V335" stroke={TEAL} opacity={.18} strokeWidth={4}/>
  <ellipse cx={s.potX} cy={568} rx={94} ry={9} fill={INK} opacity={.09}/>
  <ellipse cx={x} cy={568} rx={69} ry={8} fill={INK} opacity={.1}/>
  {/* Stance feet are world-locked by timing.ts; only the swing foot lifts. */}
  <path d={`M${x-15} 470 L${(x-15+s.leftFoot.x)/2-8} 515 L${s.leftFoot.x} ${s.leftFoot.y} M${x+16} 470 L${(x+16+s.rightFoot.x)/2+8} 515 L${s.rightFoot.x} ${s.rightFoot.y}`} stroke={INK} strokeWidth={19} fill="none" strokeLinecap="round"/>
  <path d={`M${s.leftFoot.x-13} ${s.leftFoot.y+1}h26 M${s.rightFoot.x-11} ${s.rightFoot.y+1}h27`} stroke={INK} strokeWidth={13} strokeLinecap="round"/>
  <path d={`M${x-29+s.lean} 392Q${x} 379 ${x+25+s.lean} 395L${x+34} 481Q${x} 497 ${x-38} 481Z`} fill={TEAL}/>
  <path d={`M${x-18+s.lean} 414L${x-37} 458L${x-10} 478`} stroke={TEAL} strokeWidth={19} fill="none" strokeLinecap="round"/>
  <circle cx={x-9} cy={479} r={10} fill={CORAL}/>
  <path d={`M${x+22+s.lean} 412Q${x+37} 444 ${s.palmX-8} ${s.palmY}`} stroke={TEAL} strokeWidth={20} fill="none" strokeLinecap="round"/>
  <path d={`M${s.palmX-8} ${s.palmY}H${s.palmX}`} stroke={'#E39970'} strokeWidth={16} strokeLinecap="butt"/>
  <path d={`M${headX-8} 371V398`} stroke={CORAL} strokeWidth={19}/>
  <ellipse cx={headX} cy={headY} rx={29} ry={34} fill={CORAL}/>
  <path d={`M${headX+20} 349l17 10-16 5`} fill={CORAL}/>
  <circle cx={headX+16} cy={350} r={3.5} fill={INK}/>
  <path d={`M${headX+9} 371q8 ${-3+11*s.bloom} 14 -4`} fill="none" stroke={INK} strokeWidth={2.5}/>
  <path d={`M${headX-39} 331Q${headX-1} 315 ${headX+39} 333 M${headX-23} 327L${headX-17} 302Q${headX+2} 293 ${headX+23} 307L${headX+28} 329`} fill={GOLD} stroke={GOLD} strokeWidth={9} strokeLinejoin="round"/>
  {/* Pot's left edge is exactly potX-70, including at palm height. */}
  <g transform={`translate(${s.potX} 0)`}>
   <path d="M-70 426H70V515Q0 547 -70 515Z" fill={CORAL}/>
   <ellipse cy={426} rx={70} ry={14} fill={INK}/>
   <path d="M-76 428H76" stroke={CORAL} strokeWidth={12}/>
   <path d="M-56 448V504" stroke="#F4EFE4" strokeWidth={5} opacity={.4}/>
   <path d="M-74 542H74" stroke={INK} strokeWidth={9} strokeLinecap="round"/>
   {[-47,47].map(a=><g key={a} transform={`translate(${a} 553) rotate(${s.wheelAngle})`}><circle r={13} fill={INK}/><path d="M-8 0H8M0-8V8" stroke="#F4EFE4" strokeWidth={2}/></g>)}
   <path d={`M0 425Q${-8+8*s.bloom} 385 0 336`} stroke={TEAL} strokeWidth={9} fill="none"/>
   <path d="M0 391Q-55 358 -47 391Q-33 416 0 402 M0 378Q48 345 45 376Q27 400 0 390" fill={TEAL}/>
   <g transform={`translate(0 329)`}>{[0,60,120,180,240,300].map(a=><ellipse key={a} transform={`rotate(${a*s.bloom})`} cy={-10-18*s.bloom} rx={8+8*s.bloom} ry={18+8*s.bloom} fill={GOLD}/>)}<circle r={5+10*s.bloom} fill={CORAL}/></g>
  </g>
 </RisoPaper>;
};
