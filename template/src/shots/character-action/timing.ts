/** Pure frame clock. Renderer frames are zero-based; contract ranges are 1-based inclusive. */
export const CHARACTER_ACTION_SECONDS = 8;
export type PhaseRange = readonly [number, number];
export type ActionPhases = Record<'anticipation'|'contact'|'support'|'release'|'settle', PhaseRange>;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const p=clamp(v);return p*p*(3-2*p);};
/** Alternating swing windows; stance feet hold exact world coordinates. */
export function plantedWalkFoot(startX:number, distance:number, progress:number, side:0|1, cycles=3) {
 const p=clamp(progress), scaled=p*cycles, cycle=Math.min(cycles-1,Math.floor(scaled));
 const within=p===1?1:scaled-cycle;
 const swing=clamp((within-side*.5)*2);
 const advance=(cycle+smooth(swing))*distance/cycles;
 return {x:startX+advance,y:558-16*Math.sin(Math.PI*swing),planted:swing===0||swing===1};
}
export function createCharacterAction(fps:number, options:{contactSec?:number}={}) {
  if (!Number.isFinite(fps)||fps<=0) throw new RangeError('fps must be positive');
  const contactSec=options.contactSec??3;
  if(!Number.isFinite(contactSec)||contactSec<3||contactSec>3.5) throw new RangeError('contactSec must be 3..3.5');
  const contact=Math.round(contactSec*fps), release=contact+Math.round(2*fps);
  const anticipation=contact-Math.round(.5*fps), support=contact+Math.max(1,Math.round(.2*fps));
  const settle=release+Math.round(.5*fps), settled=release+Math.round(2*fps);
  const phases:ActionPhases={anticipation:[anticipation+1,contact],contact:[contact+1,support],support:[support+1,release],release:[release+1,settle],settle:[settle+1,settled]};
  return {fps,contactSec,phases,durationInFrames:Math.round(8*fps),stateAt(frame:number){
    if(!Number.isFinite(frame)) throw new RangeError('frame must be finite');
    const approach=smooth((frame-fps*.6)/(fps*1.9));
    const reach=smooth((frame-anticipation)/(contact-anticipation));
    const push=smooth((frame-contact)/(release-contact));
    const recover=smooth((frame-release)/(settle-release));
    const actorX=280+170*approach+220*push;
    const potX=610+220*push;
    const palmX=actorX+40+50*reach-50*recover;
    const palmY=450+38*recover;
    const moving=(frame>fps*.6&&frame<fps*2.5)||(frame>contact&&frame<release);
    const step=moving?Math.sin((frame<contact?frame-fps*.6:frame-contact)*Math.PI/(fps*.25)):0;
    const leftFoot=frame<contact?plantedWalkFoot(250,170,approach,0):plantedWalkFoot(420,220,push,0);
    const rightFoot=frame<contact?plantedWalkFoot(308,170,approach,1):plantedWalkFoot(478,220,push,1);
    const phase=(Object.entries(phases).find(([,range])=>frame+1>=range[0]&&frame+1<=range[1])?.[0]??(frame<anticipation?'approach':'hold'));
    return {leftFoot,rightFoot,actorX,potX,palmX,palmY,reach,recover,push,step,moving,phase,
      contactActive:frame>=contact&&frame<=release,
      bloom:smooth((frame-release)/(settled-release)),
      lean:10*reach*(1-recover),
      // Contact point stays on the vertical left pot edge through the full push.
      contactPoint:{x:potX-70,y:450},
      wheelAngle:220*push/13*180/Math.PI};
  }};
}
