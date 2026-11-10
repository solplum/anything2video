import React from 'react';
import {Composition,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {ChoiceQuestFrame} from '../../styles/choice-quest/kit';
import type {QuestBranch} from '../../styles/choice-quest/scene.mjs';
import storyboard from './storyboard.json';
// One conversion from global 1-based story contact to the 0-based frame clock.
const selectSec=(storyboard.shots[0].story.actions[0].phases.contact[0]-1)/30-2.5;
const Scene:React.FC<{branch:QuestBranch;showCaptions:boolean;selectSec:number}>=props=>{
  const frame=useCurrentFrame(),{width,height,fps}=useVideoConfig();
  return <ChoiceQuestFrame {...props} {...{frame,width,height,fps}}/>;
};
const Root=()=> <>
  <Composition id="ChoiceQuest" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{branch:'repair',showCaptions:true,selectSec}}/>
  <Composition id="ChoiceQuestWait" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{branch:'wait',showCaptions:true,selectSec}}/>
  <Composition id="ChoiceQuestAction" component={Scene} width={1280} height={720} fps={30} durationInFrames={540} defaultProps={{branch:'repair',showCaptions:false,selectSec}}/>
</>;
registerRoot(Root);
