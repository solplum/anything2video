import React, {useId} from 'react';
import {registrationOffset, revealRect} from './timing';
import type {Registration, RevealEvent} from './timing';

export type RisoPaperProps = Readonly<{
  id: string;
  width: number;
  height: number;
  children: React.ReactNode;
  color?: string;
  grainOpacity?: number;
  style?: React.CSSProperties;
}>;
export type HalftoneOptions = Readonly<{
  /** SVG user units; the pattern is anchored to the paper origin. */
  spacing?: number;
  radius?: number;
  /** 0 gives discrete dots; 1 gives solid ink. */
  baseOpacity?: number;
}>;
export type InkPlateProps = Readonly<{
  id: string;
  width: number;
  height: number;
  ink: string;
  frame: number;
  /** SVG artwork supplies the mask. Its original colors do not become ink. */
  children: React.ReactNode;
  opacity?: number;
  /** Alpha flattens colors; luminance makes white print and black knock out. */
  maskMode?: 'alpha' | 'luminance';
  reveal?: RevealEvent;
  registration?: Registration;
  /** Defaults to a subtle tonal screen; false disables it. */
  halftone?: HalftoneOptions | false;
}>;

const positive = (value: number, name: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
  return value;
};
const unit = (value: number, name: string) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  return value;
};
const nonempty = (value: string, name: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new RangeError(`${name} must be nonempty`);
  return value;
};
// React's instance ID prevents sibling collisions even when caller labels match.
// Separate server-rendered roots should use React's identifierPrefix option.
function useScopedId(id: string): string {
  const instance = useId();
  nonempty(id, 'id');
  return `riso-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${instance.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

/** Isolated SVG paper: place two InkPlate siblings inside to overprint them.
 * Paper fibers are static vector marks, with no frame-dependent texture noise.
 */
export function RisoPaper({id, width, height, children, color = '#F4EFE4', grainOpacity = 0.055, style}: RisoPaperProps) {
  const scope = useScopedId(id);
  positive(width, 'width');
  positive(height, 'height');
  nonempty(color, 'color');
  unit(grainOpacity, 'grainOpacity');
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{display: 'block', ...style, isolation: 'isolate', overflow: 'hidden'}} data-riso-paper={id}>
      <defs>
        <pattern id={`${scope}-fibers`} width={61} height={47} patternUnits="userSpaceOnUse">
          <g fill="#504B40" stroke="#504B40" strokeWidth={0.5}>
            <circle cx={7} cy={9} r={0.65}/><circle cx={39} cy={28} r={0.5}/>
            <circle cx={54} cy={41} r={0.8}/><circle cx={24} cy={38} r={0.4}/>
            <path d="M16 4 l2 0.5 M46 14 l3 -0.5 M8 32 l2 1 M28 20 l2 -1" fill="none"/>
          </g>
        </pattern>
      </defs>
      <rect width={width} height={height} fill={color}/>
      <rect width={width} height={height} fill={`url(#${scope}-fibers)`} opacity={grainOpacity}/>
      {children}
    </svg>
  );
}

/** Flatten SVG artwork to one ink separation. With maskMode="luminance", white
 * prints and black removes ink (even over white). Registration moves only artwork;
 * reveal and screen dots remain fixed to the paper.
 * Children should be SVG elements, not HTML, and should namespace their own IDs.
 */
export function InkPlate({id, width, height, ink, frame, children, opacity = 0.94, maskMode = 'alpha', reveal, registration, halftone}: InkPlateProps) {
  const scope = useScopedId(id);
  const gate = revealRect(frame, reveal, width, height);
  const offset = registrationOffset(frame, registration);
  unit(opacity, 'opacity');
  nonempty(ink, 'ink');
  if (maskMode !== 'alpha' && maskMode !== 'luminance') throw new RangeError('maskMode must be alpha or luminance');
  const screen = halftone === false ? undefined : halftone ?? {};
  const spacing = positive(screen?.spacing ?? 5, 'halftone.spacing');
  const radius = screen?.radius ?? 0.9;
  if (!Number.isFinite(radius) || radius < 0 || radius > spacing / 2) {
    throw new RangeError('halftone.radius must be between 0 and spacing / 2');
  }
  const baseOpacity = unit(screen?.baseOpacity ?? 0.9, 'halftone.baseOpacity');
  return (
    <g data-riso-plate={id} opacity={opacity} style={{mixBlendMode: 'multiply'}}>
      <defs>
        <clipPath id={`${scope}-reveal`} clipPathUnits="userSpaceOnUse"><rect {...gate}/></clipPath>
        <mask id={`${scope}-artwork`} x={0} y={0} width={width} height={height}
          maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style={{maskType: maskMode}}>
          <g clipPath={`url(#${scope}-reveal)`}>
            <g transform={`translate(${offset.x} ${offset.y})`} fill="white" color="white">{children}</g>
          </g>
        </mask>
        {screen && <pattern id={`${scope}-screen`} x={0} y={0} width={spacing} height={spacing}
          patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
          <rect width={spacing} height={spacing} fill={ink} opacity={baseOpacity}/>
          <circle cx={spacing / 2} cy={spacing / 2} r={radius} fill={ink}/>
        </pattern>}
      </defs>
      <rect width={width} height={height} fill={screen ? `url(#${scope}-screen)` : ink}
        mask={`url(#${scope}-artwork)`}/>
    </g>
  );
}
