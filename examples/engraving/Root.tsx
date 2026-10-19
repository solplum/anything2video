import React from 'react';
import {Composition} from 'remotion';
import {Scene} from './Scene';
export const Root: React.FC = () => <>
  <Composition id="Engraving" component={Scene} width={1280} height={720} fps={30} durationInFrames={360}/>
  <Composition id="EngravingPortrait" component={Scene} width={720} height={1280} fps={30} durationInFrames={360}/>
</>;
