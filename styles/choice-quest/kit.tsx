import React from 'react';
import {renderQuest, type QuestRenderOptions} from './scene.mjs';

/** Same owned SVG scene used by the offline study. Frame is always 0-based. */
export const ChoiceQuestFrame:React.FC<QuestRenderOptions> = props =>
  <div style={{width:props.width??1280,height:props.height??720}} dangerouslySetInnerHTML={{__html:renderQuest(props)}}/>;

export {evaluateChoiceEvents,questState,questTiming,QUEST,COLORS} from './scene.mjs';
