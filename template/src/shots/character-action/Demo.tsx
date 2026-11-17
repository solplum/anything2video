import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {RisoPaper} from '../../common/riso';
import {followSpring, solveTwoBoneIK, walkPelvisState} from '../../common/motion/kinematics';
import {createCharacterAction} from './timing';

const INK = '#233E47', TEAL = '#357D7C', CORAL = '#D9583D', GOLD = '#EDB94E';

/** Original silent causal micro-story: move a shaded bud into sunlight. */
export const CharacterActionDemo: React.FC<{contactSec?: number}> = ({contactSec = 3}) => {
  const frame = useCurrentFrame(), {fps} = useVideoConfig();
  return <AbsoluteFill><CharacterActionFrame frame={frame} fps={fps} contactSec={contactSec}/></AbsoluteFill>;
};

/**
 * Exact shared artwork with two-bone IK limbs, pelvis stride bob, and frame-pure spring overlap.
 * Preserves timing.ts phase contracts, world-locked planted feet, and exact palm-to-pot contact.
 */
export const CharacterActionFrame: React.FC<{frame: number; fps: number; contactSec?: number}> = ({
  frame,
  fps,
  contactSec = 3,
}) => {
  const clock = createCharacterAction(fps, {contactSec});
  const s = clock.stateAt(frame);

  // Compute natural pelvis bob & forward effort using plantedWalkFoot swing lift + push effort
  const swingAt = (f: number) => {
    const st = clock.stateAt(Math.max(0, f));
    const lLift = Math.max(0, Math.min(1, (558 - st.leftFoot.y) / 16));
    const rLift = Math.max(0, Math.min(1, (558 - st.rightFoot.y) / 16));
    const effort = st.contactActive ? 0.85 : st.reach * 0.45;
    return walkPelvisState(lLift * 0.5, rLift * 0.5, st.moving, effort);
  };
  const pelvisBob = followSpring((f) => swingAt(f).bobY, frame, {stiffness: 0.24, damping: 0.68, historyFrames: 24}).value;
  const torsoLean = followSpring((f) => clock.stateAt(Math.max(0, f)).lean, frame, {stiffness: 0.18, damping: 0.72, historyFrames: 24}).value;
  const headXlag = followSpring((f) => {
    const st = clock.stateAt(Math.max(0, f));
    return st.actorX + st.lean * 1.15;
  }, frame, {stiffness: 0.16, damping: 0.70, historyFrames: 28}).value;
  const headBob = followSpring((f) => swingAt(f).bobY * 1.15 - clock.stateAt(Math.max(0, f)).bloom * 4, frame, {
    stiffness: 0.14,
    damping: 0.68,
    historyFrames: 28,
  }).value;
  const hatTilt = followSpring((f) => {
    const st = clock.stateAt(Math.max(0, f));
    return st.lean * 0.65 - st.bloom * 3.5;
  }, frame, {stiffness: 0.12, damping: 0.66, historyFrames: 30}).value;
  const stemSway = followSpring((f) => {
    const st = clock.stateAt(Math.max(0, f));
    return st.push * 12 * (1 - st.recover);
  }, frame, {stiffness: 0.14, damping: 0.65, historyFrames: 30}).value;

  const x = s.actorX;
  const hipY = 470 + pelvisBob;
  const shoulderY = 408 + pelvisBob * 0.92;
  const headX = headXlag;
  const headY = 354 + headBob;

  // Constant-length analytical two-bone IK for both legs (L1=49, L2=49 -> constant thigh & shin!)
  const leftLeg = solveTwoBoneIK({x: x - 15, y: hipY}, {x: s.leftFoot.x, y: s.leftFoot.y}, 49, 49, 1);
  const rightLeg = solveTwoBoneIK({x: x + 16, y: hipY}, {x: s.rightFoot.x, y: s.rightFoot.y}, 49, 49, 1);

  // Lead pushing arm (L1=40, L2=40 -> exact palm target (s.palmX - 8, s.palmY), elbow bends downward)
  const leadArm = solveTwoBoneIK(
    {x: x + 22 + torsoLean, y: shoulderY + 4},
    {x: s.palmX - 8, y: s.palmY},
    40,
    40,
    -1,
  );

  // Trailing counter-balance arm swings gently opposite to stride and lifts slightly during push
  const trailTargetX = x - 14 - Math.sin(s.step) * 14 - s.push * 10;
  const trailTargetY = 474 + pelvisBob * 0.6 - s.reach * 8;
  const trailArm = solveTwoBoneIK(
    {x: x - 18 + torsoLean, y: shoulderY + 6},
    {x: trailTargetX, y: trailTargetY},
    37,
    37,
    -1,
  );

  return (
    <RisoPaper id="garden-action" width={1280} height={720} grainOpacity={0.12}>
      <path d="M730 155H1020V380L1080 565H700L730 380Z" fill={GOLD} opacity={0.19}/>
      <path d="M735 155H1010V380H735Z M872 155V380 M735 267H1010" fill="none" stroke={INK} strokeWidth={8}/>
      <circle cx={953} cy={211} r={27} fill={GOLD}/>
      <path d="M140 567H1125" stroke={INK} strokeWidth={5}/>
      <path d="M170 568V310Q220 285 267 310V568" fill={TEAL} opacity={0.12}/>
      <path d="M185 568V335M220 568V327M253 568V335" stroke={TEAL} opacity={0.18} strokeWidth={4}/>
      <ellipse cx={s.potX} cy={568} rx={94} ry={9} fill={INK} opacity={0.09}/>
      <ellipse cx={x} cy={568} rx={69} ry={8} fill={INK} opacity={0.1}/>
      {/* Stance feet are world-locked by timing.ts; knees/ankles solved via constant-length two-bone IK. */}
      <path
        d={`M${x - 15} ${hipY.toFixed(2)} L${leftLeg.joint.x.toFixed(2)} ${leftLeg.joint.y.toFixed(2)} L${leftLeg.end.x.toFixed(2)} ${leftLeg.end.y.toFixed(2)} M${x + 16} ${hipY.toFixed(2)} L${rightLeg.joint.x.toFixed(2)} ${rightLeg.joint.y.toFixed(2)} L${rightLeg.end.x.toFixed(2)} ${rightLeg.end.y.toFixed(2)}`}
        stroke={INK}
        strokeWidth={19}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={`M${s.leftFoot.x - 13} ${s.leftFoot.y + 1}h26 M${s.rightFoot.x - 11} ${s.rightFoot.y + 1}h27`} stroke={INK} strokeWidth={13} strokeLinecap="round"/>
      <path
        d={`M${(x - 29 + torsoLean).toFixed(2)} ${(392 + pelvisBob).toFixed(2)}Q${(x + torsoLean * 0.4).toFixed(2)} ${(379 + pelvisBob).toFixed(2)} ${(x + 25 + torsoLean).toFixed(2)} ${(395 + pelvisBob).toFixed(2)}L${x + 34} ${(481 + pelvisBob * 0.85).toFixed(2)}Q${x} ${(497 + pelvisBob * 0.85).toFixed(2)} ${x - 38} ${(481 + pelvisBob * 0.85).toFixed(2)}Z`}
        fill={TEAL}
      />
      <path
        d={`M${(x - 18 + torsoLean).toFixed(2)} ${(shoulderY + 6).toFixed(2)}L${trailArm.joint.x.toFixed(2)} ${trailArm.joint.y.toFixed(2)}L${trailArm.end.x.toFixed(2)} ${trailArm.end.y.toFixed(2)}`}
        stroke={TEAL}
        strokeWidth={19}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={trailArm.end.x} cy={trailArm.end.y} r={10} fill={CORAL}/>
      <path
        d={`M${(x + 22 + torsoLean).toFixed(2)} ${(shoulderY + 4).toFixed(2)}L${leadArm.joint.x.toFixed(2)} ${leadArm.joint.y.toFixed(2)}L${(s.palmX - 8).toFixed(2)} ${s.palmY.toFixed(2)}`}
        stroke={TEAL}
        strokeWidth={20}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d={`M${s.palmX - 8} ${s.palmY}H${s.palmX}`} stroke={'#E39970'} strokeWidth={16} strokeLinecap="butt"/>
      <path d={`M${(headX - 8).toFixed(2)} ${(headY + 17).toFixed(2)}V${(400 + pelvisBob).toFixed(2)}`} stroke={CORAL} strokeWidth={19}/>
      <ellipse cx={headX} cy={headY} rx={29} ry={34} fill={CORAL}/>
      <path d={`M${(headX + 20).toFixed(2)} ${(headY - 5).toFixed(2)}l17 10-16 5`} fill={CORAL}/>
      <circle cx={headX + 16} cy={headY - 4} r={3.5} fill={INK}/>
      <path d={`M${(headX + 9).toFixed(2)} ${(headY + 17).toFixed(2)}q8 ${-3 + 11 * s.bloom} 14 -4`} fill="none" stroke={INK} strokeWidth={2.5}/>
      <g transform={`translate(${headX.toFixed(2)} ${(headY - 23).toFixed(2)}) rotate(${hatTilt.toFixed(2)})`}>
        <path d="M-39 0Q-1 -16 39 2 M-23 -4L-17 -29Q2 -38 23 -24L28 -2" fill={GOLD} stroke={GOLD} strokeWidth={9} strokeLinejoin="round"/>
      </g>
      {/* Pot's left edge is exactly potX-70, including at palm height. */}
      <g transform={`translate(${s.potX} 0)`}>
        <path d="M-70 426H70V515Q0 547 -70 515Z" fill={CORAL}/>
        <ellipse cy={426} rx={70} ry={14} fill={INK}/>
        <path d="M-76 428H76" stroke={CORAL} strokeWidth={12}/>
        <path d="M-56 448V504" stroke="#F4EFE4" strokeWidth={5} opacity={0.4}/>
        <path d="M-74 542H74" stroke={INK} strokeWidth={9} strokeLinecap="round"/>
        {[-47, 47].map((a) => (
          <g key={a} transform={`translate(${a} 553) rotate(${s.wheelAngle})`}>
            <circle r={13} fill={INK}/>
            <path d="M-8 0H8M0-8V8" stroke="#F4EFE4" strokeWidth={2}/>
          </g>
        ))}
        <path d={`M0 425Q${(-8 + 8 * s.bloom - stemSway * 0.45).toFixed(2)} 385 ${(-stemSway * 0.35).toFixed(2)} 336`} stroke={TEAL} strokeWidth={9} fill="none"/>
        <path d="M0 391Q-55 358 -47 391Q-33 416 0 402 M0 378Q48 345 45 376Q27 400 0 390" fill={TEAL}/>
        <g transform={`translate(${(-stemSway * 0.35).toFixed(2)} 329)`}>
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} transform={`rotate(${a * s.bloom})`} cy={-10 - 18 * s.bloom} rx={8 + 8 * s.bloom} ry={18 + 8 * s.bloom} fill={GOLD}/>
          ))}
          <circle r={5 + 10 * s.bloom} fill={CORAL}/>
        </g>
      </g>
    </RisoPaper>
  );
};
