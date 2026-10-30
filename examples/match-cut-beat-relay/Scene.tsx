import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import storyboard from '../script/storyboard.json';
import motion from '../script/study-motion.json';

type StudyShot = typeof storyboard.shots[number];
const colors = {paper: '#F3EAD9', ink: '#223E35', green: '#577454', sun: '#E8B953', line: '#AD9980'};
const words = [
  {tag: '01 / A BEGINNING', title: 'Small beginnings.', note: 'One seed starts the idea.'},
  {tag: '02 / A DAILY RHYTHM', title: 'A little time, every day.', note: 'The same circle becomes a new day.'},
  {tag: '03 / AN INTENTION', title: 'Make time to care.', note: 'An imagined reminder — not a product claim.'},
];

const Shot: React.FC<{shot: StudyShot; index: number}> = ({shot, index}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const total = shot.to - shot.from + 1;
  const {scale, speed, settleSeconds, settleX} = motion;
  const r = width * scale / 2;
  // The outgoing/incoming velocities agree at the cut. Only this pair keeps moving;
  // the sun/dial cut is at rest before the new pointer action begins.
  const x = index === 0
    ? width * (0.5 - (total - frame) / fps * scale * speed)
    : index === 1
      ? width * (0.5 + scale * speed * (Math.min(t, settleSeconds) - Math.min(t, settleSeconds) ** 2 / (2 * settleSeconds)))
      : width * settleX;
  const y = height * 0.48;
  const q = Math.max(0, Math.min(1, (t - 0.15) / 0.45));
  const handAngle = (-90 + 140 * (q * q * (3 - 2 * q))) * Math.PI / 180;
  const copy = words[index];
  return <AbsoluteFill style={{background: colors.paper, fontFamily: 'Arial, sans-serif', color: colors.ink}}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Deterministic paper layers. No Date, randomness, filters or services. */}
      <path d={`M 0 ${height * .73} Q ${width * .25} ${height * .66} ${width * .5} ${height * .73} T ${width} ${height * .74} V ${height} H 0 Z`} fill="#E4D7BC" />
      <path d={`M 0 ${height * .81} Q ${width * .42} ${height * .75} ${width} ${height * .84} V ${height} H 0 Z`} fill="#D7C7A9" />
      <g transform={`translate(${x},${y})`}>
        <circle cx="7" cy="8" r={r} fill="#B3A083" opacity=".25" />
        <circle r={r} fill={index === 0 ? colors.green : index === 1 ? colors.sun : '#F8F1E3'} stroke={colors.ink} strokeWidth="5" />
        {index === 0 && <>
          <path d={`M ${-r * .52} ${r * .4} Q ${-r * .1} ${-r * .42} ${r * .57} ${-r * .46} Q ${r * .22} ${r * .35} ${-r * .52} ${r * .4}`} fill="#B1C19B" stroke={colors.ink} strokeWidth="4" />
          <path d={`M ${-r * .47} ${r * .36} Q 0 0 ${r * .49} ${-r * .39}`} fill="none" stroke={colors.ink} strokeWidth="4" />
        </>}
        {index === 1 && Array.from({length: 12}, (_, i) => {
          const a = i * Math.PI / 6;
          return <line key={i} x1={Math.cos(a) * r * .68} y1={Math.sin(a) * r * .68} x2={Math.cos(a) * r * .86} y2={Math.sin(a) * r * .86} stroke={colors.ink} strokeWidth="5" strokeLinecap="round" />;
        })}
        {index === 1 && <circle r={r * .35} fill="#F5D884" stroke={colors.ink} strokeWidth="3" />}
        {index === 2 && <>
          {Array.from({length: 12}, (_, i) => {
            const a = i * Math.PI / 6;
            return <circle key={i} cx={Math.cos(a) * r * .78} cy={Math.sin(a) * r * .78} r="4" fill={colors.line} />;
          })}
          <circle cx={Math.cos(50 * Math.PI / 180) * r * .78} cy={Math.sin(50 * Math.PI / 180) * r * .78} r="10" fill={colors.green} />
          <line x1="0" y1="0" x2={Math.cos(handAngle) * r * .68} y2={Math.sin(handAngle) * r * .68} stroke={colors.ink} strokeWidth="9" strokeLinecap="round" />
          <circle r="12" fill={colors.ink} />
        </>}
      </g>
    </svg>
    <div style={{position: 'absolute', left: 70, top: 42, fontSize: 22, letterSpacing: 3}}>{copy.tag}</div>
    <div style={{position: 'absolute', bottom: 90, width: '100%', textAlign: 'center', fontSize: 46, fontWeight: 700}}>{copy.title}</div>
    <div style={{position: 'absolute', bottom: 52, width: '100%', textAlign: 'center', fontSize: 23}}>{copy.note}</div>
    <div style={{position: 'absolute', right: 32, top: 42, fontSize: 17}}>SYNTHETIC TIMING STUDY</div>
  </AbsoluteFill>;
};

export const Scene: React.FC = () => <AbsoluteFill>
  {/* Prepared helper-derived storyboard is the mounted timeline, not a second
      hand-written array of frame constants. Convert 1-based origin once. */}
  {storyboard.shots.map((shot, index) => <Sequence key={shot.id} from={shot.from - 1} durationInFrames={shot.to - shot.from + 1}>
    <Shot shot={shot} index={index} />
  </Sequence>)}
  <Audio src={staticFile('click-study.wav')} />
</AbsoluteFill>;
