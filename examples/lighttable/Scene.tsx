import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {LighttableStudy} from './style/kit';
export const Scene: React.FC = () => {
  const frame=useCurrentFrame(), {fps,width,height}=useVideoConfig();
  return <LighttableStudy frame={frame} fps={fps} width={width} height={height}/>;
};
