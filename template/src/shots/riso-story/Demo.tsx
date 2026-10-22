import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {RisoPaper, InkPlate} from '../../common/riso';
import {createRisoStory, beetlePose} from './timing';

const W=1280,H=720,BLUE='#0078BF',PINK='#FF48B0',PAPER='#F4EFE4';
/** Same six-legged paper silhouette throughout; legs step on twos, the camera does not. */
const Beetle:React.FC<{x:number;y:number;frame:number;fps:number;moving:boolean;lookBack?:boolean;scale?:number;ground?:(x:number)=>number}>=({x,y,frame,fps,moving,lookBack=false,scale=1,ground=()=>y})=>{
  const step=moving?Math.sin(Math.floor(frame/(fps/12))*Math.PI/3):0;
  const {angle,sx,footY}=beetlePose(x,y,scale,lookBack,ground);
  return <g transform={`translate(${x} ${y}) rotate(${angle*180/Math.PI}) scale(${sx} ${scale})`}>
    {[-28,0,27].map((p,i)=><path key={p} d={`M${p} -19 L${p-13+step*(i%2?5:-5)} -8 L${p-19+step*(i%2?7:-7)} ${footY(p-19+step*(i%2?7:-7))} M${p+8} -16 L${p+17-step*(i%2?5:-5)} -7 L${p+24-step*(i%2?7:-7)} ${footY(p+24-step*(i%2?7:-7))}`} stroke="white" strokeWidth={7} strokeLinecap="round" fill="none"/>)}
    <ellipse cx={-8} cy={-40} rx={44} ry={31} fill="white"/>
    <circle cx={38} cy={-39} r={24} fill="white"/>
    <path d="M40 -56 Q48 -83 62 -81 M51 -53 Q67 -69 78 -61" stroke="white" strokeWidth={5} fill="none" strokeLinecap="round"/>
    <path d="M-12 -68 Q2 -45 -12 -15" stroke="black" strokeWidth={3} fill="none"/>
    <circle cx={47} cy={-42} r={6} fill="black"/>
  </g>;
};
const bridgePath=(u:number)=>{
  const width=60+340*u;
  const top=Array.from({length:21},(_,i)=>{const p=i/20;return [440+p*width,490-100*u*Math.sin(p*Math.PI)-(1-u)*(i%2?18:0)];});
  return `M${top.map(p=>p.join(' ')).join(' L')} L${440+width} 525 ${top.slice().reverse().map(([x,y])=>`L${x} ${y+35}`).join(' ')} Z`;
};

/** Original wordless 36-second narrative. Sound is mixed into the encoded example, not a template music asset. */
export const RisoStoryDemo:React.FC=()=>{
  const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();
  const story=createRisoStory(fps),s=story.stateAt(frame),c=story.cues;
  const bridge=bridgePath(s.unfold);
  const handoff=Math.max(0,Math.min(1,(s.t-12)/1));
  const paperX=s.firstX+76-26*handoff;
  const paperY=470+20*handoff;
  const firstFacingBack=s.t>=29;
  const pinkRegistration={x:2.8,y:-1.4,kicks:[{atFrame:c.get('reach').frame,durationFrames:Math.round(fps*.4),x:10,y:-5},{atFrame:c.get('overprint').frame,durationFrames:Math.round(fps*.3),x:-7,y:3}]};
  const sceneTransform=`translate(${490*(1-s.camera)} ${490*(1-s.camera)}) scale(${s.camera})`;
  const afterBridge=s.t>=13;
  return <AbsoluteFill style={{background:PAPER,display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{width:W,height:H,transform:`scale(${Math.min(width/W,height/H)})`,flexShrink:0}}>
      <RisoPaper id="paper-road" width={W} height={H} color={PAPER} grainOpacity={0.045}>
        <InkPlate maskMode="luminance" id="land-tint" width={W} height={H} ink={BLUE} frame={frame} halftone={{spacing:10,radius:1.5,baseOpacity:0}}>
          <g transform={sceneTransform} fill="white">
            <path d="M-200 510 Q-20 420 180 490 Q300 405 440 490 L440 760 H-200Z"/>
            <path d="M840 490 Q1020 400 1200 490 Q1340 420 1500 490 V760 H840Z"/>
            <circle cx={1060} cy={220} r={115}/>
          </g>
        </InkPlate>
        <InkPlate maskMode="luminance" id="blue-world" width={W} height={H} ink={BLUE} frame={frame} registration={{x:-1,y:1}}>
          <g transform={sceneTransform} fill="white">
            <path d="M-200 490 H440 V502 H-200Z M840 490 H1500 V502 H840Z"/>
            {[0,1,2,3,4,5].map(i=><path key={i} d={`M${490+(i%2)*28} ${550+i*29} q55 -14 105 0 t110 0 t70 0`} stroke="white" strokeWidth={3} fill="none"/>)}
            {/* Reeds frame the gap, rather than covering the actor. */}
            <path d="M95 490 Q65 420 40 433 Q80 425 95 490 M103 490 Q112 423 140 417 Q111 446 103 490 M1160 490 Q1167 427 1194 422 Q1172 451 1160 490"/>
          </g>
        </InkPlate>
        <InkPlate maskMode="luminance" id="pink-paper" width={W} height={H} ink={PINK} frame={frame} registration={pinkRegistration}>
          <g transform={sceneTransform} fill="white">
            {!afterBridge ? <g transform={`translate(${paperX} ${paperY}) rotate(${s.t>=10?-15*(1-handoff):0}) scale(${1-.1*handoff} ${1-.7*handoff})`}>
              <path d="M0 0 L30 -66 L67 -20 L40 15Z"/>
              <path d="M0 0 L42 -28 L30 -66 M42 -28 L40 15" stroke="black" strokeWidth={3} fill="none"/>
            </g> : <>
              <path d={bridge}/>
              {[.25,.5,.75].map(p=><path key={p} d={`M${440+p*(60+340*s.unfold)} ${490-100*s.unfold*Math.sin(p*Math.PI)} l${10*(1-s.unfold)} 35`} stroke="black" strokeWidth={2} fill="none"/>) }
            </>}
          </g>
        </InkPlate>
        {/* The second ink creates a continuous load-bearing route only after the paper reaches both banks. */}
        {afterBridge&&<InkPlate maskMode="luminance" id="blue-bridge" width={W} height={H} ink={BLUE} frame={frame} reveal={{startFrame:c.get('settle').frame,endFrame:c.get('overprint').frame,direction:'left-to-right',bounds:{x:440,y:350,width:400,height:180}}} registration={{x:-1,y:1}}>
          <g transform={sceneTransform}><path d={bridge} fill="white"/></g>
        </InkPlate>}
        <InkPlate maskMode="luminance" id="blue-actors" width={W} height={H} ink={BLUE} frame={frame} registration={{x:-1,y:1}}>
          <g transform={sceneTransform}>
            <Beetle x={s.firstX} y={s.firstY} frame={frame} fps={fps} moving={s.walking} lookBack={firstFacingBack} ground={s.t>=23?s.bridgeY:()=>490}/>
            {s.t>=29&&<Beetle x={s.secondX} y={s.secondY} frame={frame} fps={fps} moving={!s.resolved} scale={.72} ground={s.bridgeY}/>}
          </g>
        </InkPlate>
      </RisoPaper>
    </div>
  </AbsoluteFill>;
};
