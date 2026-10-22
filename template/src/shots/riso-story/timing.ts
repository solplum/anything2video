import {createCueSheet, alignMotion, motionProgress} from '../../common/motion/cues';
export const STORY_SECONDS = 36;
export const smooth = (p: number) => p * p * (3 - 2 * p);
/** Authorial visual cues, not inferred musical beats. All consumers use the same 0-based sheet. */
export function createRisoStory(fps: number) {
  const cues = createCueSheet(fps, [
    {id:'arrive', atSec:8}, {id:'notice', after:'arrive', offsetSec:2},
    {id:'unfold', after:'notice', offsetSec:3}, {id:'reach', after:'unfold', offsetSec:5},
    {id:'settle', after:'reach', offsetSec:2}, {id:'overprint', after:'settle', offsetSec:2},
    {id:'cross', after:'overprint', offsetSec:1}, {id:'land', after:'cross', offsetSec:5},
    {id:'friend', after:'land', offsetSec:1}, {id:'together', after:'friend', offsetSec:5},
  ]);
  const progress = (frame:number, a:string, b:string) => smooth(motionProgress(frame,alignMotion(cues.get(a).frame,cues.get(b).frame-cues.get(a).frame,0)));
  return {cues, stateAt(frame: number) {
    if (!Number.isFinite(frame)) throw new Error('frame must be finite');
    const t=frame/fps;
    const walk=smooth(Math.max(0,Math.min(1,t/8)));
    const unfold=progress(frame,'unfold','reach');
    const crossing=progress(frame,'cross','land');
    const friend=progress(frame,'friend','together');
    const firstX=t<23 ? 180+210*walk : 390+610*crossing;
    const bridgeY=(x:number) => x<=440 || x>=840 ? 490 : 490-100*Math.sin((x-440)/400*Math.PI);
    return {t,unfold,crossing,friend,firstX,firstY:bridgeY(firstX),secondX:100+800*friend,
      secondY:bridgeY(100+800*friend),paperX:470,bridgeY,
      phase:t<8?'journey':t<13?'obstacle':t<18?'unfold':t<22?'register':t<23?'ready':t<28?'cross':t<34?'share':'resolved',
      camera: t<8 ? 1.2-.2*walk : t<10 ? 1+.4*smooth((t-8)/2) : t<12 ? 1.4 : t<14 ? 1.4-.4*smooth((t-12)/2) : 1,
      walking:(t<8 || (t>=23&&t<28)),
      paperCarried:t<13,
      resolved:t>=34};
  }};
}

/** Small stylized body tilt plus per-foot surface solve, independent of drawing. */
export function beetlePose(x:number,y:number,scale:number,lookBack:boolean,ground:(x:number)=>number){
  const slope=(ground(x+35)-ground(x-35))/70;
  const angle=Math.atan(slope),cos=Math.cos(angle),sin=Math.sin(angle),sx=lookBack?-scale:scale;
  const footY=(q:number)=>{let v=0;for(let i=0;i<12;i++){const gx=x+sx*q*cos-scale*v*sin;v=(ground(gx)-y-sx*q*sin)/(scale*cos);}return v;};
  return {angle,cos,sin,sx,footY};
}
