import React from 'react';
import {Composition} from 'remotion';
import project from '../project.json';
import {Scene} from './Scene';

export const Root: React.FC = () => <Composition
  id={project.composition}
  component={Scene}
  width={project.width}
  height={project.height}
  fps={project.fps}
  durationInFrames={project.totalFrames}
/>;
