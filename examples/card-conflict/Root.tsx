import React from 'react';
import {Composition,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {CardConflictFrame,SCENARIOS} from '../../styles/card-conflict/kit';
const Scene:React.FC<{variant:'lighthouse'|'greenhouse';choice:string;showCaptions:boolean}>=props=>{
 const frame=useCurrentFrame(),{width,height,fps}=useVideoConfig();
 return <CardConflictFrame {...{frame,width,height,fps}} scenario={SCENARIOS[props.variant]} choice={props.choice} showCaptions={props.showCaptions}/>;
};
const Root=()=> <>
 <Composition id="CardConflictLighthouse" component={Scene} width={1280} height={720} fps={30} durationInFrames={480} defaultProps={{variant:'lighthouse',choice:'brace',showCaptions:true}}/>
 <Composition id="CardConflictCounterfactual" component={Scene} width={1280} height={720} fps={30} durationInFrames={480} defaultProps={{variant:'lighthouse',choice:'rush',showCaptions:true}}/>
 <Composition id="CardConflictGreenhouse" component={Scene} width={1280} height={720} fps={30} durationInFrames={480} defaultProps={{variant:'greenhouse',choice:'warm',showCaptions:true}}/>
</>;
registerRoot(Root);
