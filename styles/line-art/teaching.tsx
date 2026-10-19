/** Optional teaching layer. Import explicitly; the existing kit's output is unchanged. */
import React from 'react';
import {LA, LINE_W} from './kit';
import {TEACHING, teachingOpacity} from './teaching-timing.mjs';

type Cue = {N: number; from: number; until?: number; fadeFrames?: number; text: string};

/** A single question or conclusion in the upper negative space of a 1280×720 scene. */
export const TeachingPrompt: React.FC<Cue & {x?: number; y?: number; width?: number}> = ({
  N, from, until, fadeFrames, text, x = 150, y = 64, width = 980,
}) => <div style={{position: 'absolute', left: x, top: y, width,
  opacity: teachingOpacity(N, from, until, fadeFrames), color: LA.ink,
  fontFamily: "'Noto Sans SC', sans-serif", fontSize: TEACHING.promptSize,
  fontWeight: 500, lineHeight: 1.35}}>{text}</div>;

/** Put the leader endpoint on the named object; never enlarge text over the force path. */
export const TeachingLabel: React.FC<Cue & {
  x: number; y: number; leader?: readonly [readonly [number, number], readonly [number, number]];
  anchor?: 'start' | 'middle' | 'end';
}> = ({N, from, until, fadeFrames, text, x, y, leader, anchor = 'start'}) => {
  const opacity = teachingOpacity(N, from, until, fadeFrames);
  if (opacity === 0) return null;
  return <svg width={1280} height={720} style={{position: 'absolute', inset: 0}}>
    <g opacity={opacity}>
      {leader ? <path d={`M${leader[0].join(',')} L${leader[1].join(',')}`} fill="none"
        stroke={LA.ink} strokeWidth={LINE_W} strokeLinecap="round" /> : null}
      <text x={x} y={y} fill={LA.ink} fontSize={TEACHING.labelSize} textAnchor={anchor}
        fontFamily="'Noto Sans SC', sans-serif" fontWeight={500}>{text}</text>
    </g>
  </svg>;
};

/** Essential caveats stay readable, above the default bottom 10% subtitle band. */
export const TeachingNote: React.FC<Cue & {x?: number; y?: number}> = ({
  N, from, until, fadeFrames, text, x = 150, y = 564,
}) => <div style={{position: 'absolute', left: x, top: y,
  opacity: teachingOpacity(N, from, until, fadeFrames), color: LA.ink,
  fontFamily: "'Noto Sans SC', sans-serif", fontSize: TEACHING.noteSize,
  fontWeight: 400, lineHeight: 1.4}}>{text}</div>;
