import React from 'react';
import {Composition,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {TransitStoryFrame} from '../../styles/transit-story/kit';
const Scene:React.FC<{delay:number;blocked:boolean;showCaptions:boolean}>=props=>{
 const frame=useCurrentFrame(),{width,height,fps}=useVideoConfig();
 return <TransitStoryFrame {...props} {...{frame,width,height,fps}}/>;
};
const Root=()=> <>
 <Composition id="TransitStory" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{delay:0,blocked:false,showCaptions:true}}/>
 <Composition id="TransitStoryPortrait" component={Scene} width={720} height={1280} fps={30} durationInFrames={540} defaultProps={{delay:0,blocked:false,showCaptions:true}}/>
 <Composition id="TransitStoryDelayed" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{delay:2.3,blocked:false,showCaptions:true}}/>
 <Composition id="TransitStoryBlocked" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{delay:0,blocked:true,showCaptions:true}}/>
 <Composition id="TransitStoryAction" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{delay:0,blocked:false,showCaptions:false}}/>
</>;
registerRoot(Root);
