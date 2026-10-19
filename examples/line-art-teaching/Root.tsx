import React from 'react';
import {Composition} from 'remotion';
import {Scene} from './Scene';
export const Root: React.FC = () => <>
  <Composition id="LineArtControl" component={Scene} defaultProps={{teaching: false}} width={1280} height={720} fps={30} durationInFrames={411} />
  <Composition id="LineArtTeaching" component={Scene} defaultProps={{teaching: true}} width={1280} height={720} fps={30} durationInFrames={411} />
</>;
