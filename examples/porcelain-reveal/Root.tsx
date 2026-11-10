import React from 'react';
import {Composition,useCurrentFrame,useVideoConfig} from 'remotion';
import {PorcelainReveal} from './style/kit';
import type {PorcelainOptions} from './style/scene.mjs';
const Scene:React.FC<PorcelainOptions> = props => {const frame=useCurrentFrame();const {fps,width,height}=useVideoConfig();return <PorcelainReveal {...props} frame={frame} fps={fps} width={width} height={height}/>};
export const Root:React.FC = ()=><>
 <Composition id="PorcelainReveal" component={Scene} width={1280} height={720} fps={30} durationInFrames={420}/>
 <Composition id="PorcelainRevealPortrait" component={Scene} width={720} height={1280} fps={30} durationInFrames={420}/>
 <Composition id="PorcelainRevealNoText" component={Scene} width={1280} height={720} fps={30} durationInFrames={420} defaultProps={{showText:false}}/>
</>;
