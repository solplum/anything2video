import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {BgSpec} from './types';
import {GRAIN_SIZE, GRAIN_URL} from './Grain';
import {DOT_BACKGROUND, DOT_COLOR, DOT_HEIGHT, DOT_POSITIONS, DOT_WIDTH, dotAppearance, dotsVisible} from './DotFieldModel';

// Compatibility exports for existing projects. New grain users import ./Grain.
export {DOT_STEP, DOT_X0, DOT_Y0} from './DotFieldModel';
export {GRAIN_URL} from './Grain';

/** Dark screen-space dot field with a moving diagonal light band.
 * Public timing contract: frame is zero-based; BgSpec intervals are inclusive,
 * one-based. Any overlapping stars:'none' hides the entire layer, including grain.
 * fog is intentionally ignored. The lattice stays fixed for frame_metrics masks.
 * Historical provenance and rewrite scope: reference/workflows/sources.md (source registry).
 */
export const DotFieldBg: React.FC<{specs: BgSpec[]; speed?: number; grain?: boolean}> = ({specs, speed = 1.5, grain = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!dotsVisible(frame, specs)) return null;
  const seconds = frame * (Number.isFinite(speed) ? speed : 1.5) / fps;
  return (
    <div aria-hidden style={{position: 'absolute', inset: 0, overflow: 'hidden', background: DOT_BACKGROUND, pointerEvents: 'none'}}>
      <svg viewBox={`0 0 ${DOT_WIDTH} ${DOT_HEIGHT}`} preserveAspectRatio="xMidYMid slice"
        width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
        <g fill={DOT_COLOR}>
          {DOT_POSITIONS.map(({x, y}) => {
            const {opacity, radius} = dotAppearance(x, y, seconds);
            return <circle key={`${x}:${y}`} cx={x} cy={y} r={radius} opacity={opacity} />;
          })}
        </g>
      </svg>
      {grain && <div style={{position: 'absolute', inset: 0, backgroundImage: GRAIN_URL,
        backgroundSize: `${GRAIN_SIZE}px ${GRAIN_SIZE}px`, opacity: 0.06, mixBlendMode: 'overlay'}} />}
    </div>
  );
};
