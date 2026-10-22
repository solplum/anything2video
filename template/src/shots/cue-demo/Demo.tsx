import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {createCueDemo} from './timing';

/** Inspect in Studio as CueDemo; silent technical timing example, not a scored film. */
export const CueDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const demo = createCueDemo(fps);
  const state = demo.stateAt(frame);
  return <AbsoluteFill style={{background: '#f2eee5', color: '#172b2a', fontFamily: 'Arial, sans-serif'}}>
    <div style={{position: 'absolute', width: 1920, height: 1080, transformOrigin: 'top left', transform: `translate(${(width - 1920 * Math.min(width / 1920, height / 1080)) / 2}px, ${(height - 1080 * Math.min(width / 1920, height / 1080)) / 2}px) scale(${Math.min(width / 1920, height / 1080)})`}}>
      <div style={{position: 'absolute', left: 120, top: 95, fontSize: 26, letterSpacing: 5}}>MOTION LAB / NAMED CUES</div>
      <div style={{position: 'absolute', left: 120, top: 160, fontSize: 84, fontWeight: 700}}>Make the result land on time.</div>
      <div style={{position: 'absolute', left: 120, top: 280, fontSize: 31}}>Approach → contact → confirmation → reading hold → handoff</div>
      <div style={{position: 'absolute', left: 290, top: 565, width: 1140, height: 4, background: '#b8c2b8'}} />
      {[['INPUT', 190], ['VERIFY', 760], ['OUTPUT', 1330]].map(([label, x]) => <div key={label} style={{position: 'absolute', left: Number(x), top: 440, width: 210, height: 260, border: '3px solid #617b70', borderRadius: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 26, boxSizing: 'border-box', fontSize: 24}}>{label}</div>)}
      <div data-a2v-id="request" style={{position: 'absolute', left: 0, top: 480, width: 150, height: 110, transform: `translateX(${state.x + 30}px)`, background: state.confirmed ? '#255b4c' : '#ca6b3b', color: 'white', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, fontWeight: 700}}>{state.confirmed ? 'VERIFIED' : 'REQUEST'}</div>
      <div style={{position: 'absolute', left: 120, top: 805, fontSize: 34, fontWeight: 700}}>{state.phase}</div>
      <div style={{position: 'absolute', left: 120, top: 865, fontSize: 25}}>Arrival {(demo.sheet.get('arrive').frame / fps).toFixed(2)}s · confirm {(demo.sheet.get('confirm').frame / fps).toFixed(2)}s · depart {(demo.sheet.get('depart').frame / fps).toFixed(2)}s</div>
      <div style={{position: 'absolute', right: 120, top: 865, fontSize: 25}}>Frame {frame} / {(frame / fps).toFixed(2)}s</div>
      <div style={{position: 'absolute', left: 120, top: 940, fontSize: 21, color: '#536760'}}>Silent timing study. Use measured cues from your recording or narration in production.</div>
    </div>
  </AbsoluteFill>;
};
