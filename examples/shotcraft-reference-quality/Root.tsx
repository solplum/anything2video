import React from 'react';
import {Composition, Sequence} from 'remotion';
import project from '../project.json';
import storyboard from '../script/storyboard.json';
import {GradientTransition} from './demos/transition/gradient-transition/GradientTransition';
import {AutolayoutGapDial} from './demos/interaction/autolayout-gap-dial/AutolayoutGapDial';

const components = [GradientTransition, AutolayoutGapDial];
const Study: React.FC = () => <>
  {storyboard.shots.map((shot, index) => {
    const Component = components[index];
    return <Sequence key={shot.id} from={shot.from - 1} durationInFrames={shot.to - shot.from + 1}>
      <Component />
    </Sequence>;
  })}
</>;

export const Root: React.FC = () => <Composition id={project.composition} component={Study}
  width={project.width} height={project.height} fps={project.fps} durationInFrames={project.totalFrames} />;
