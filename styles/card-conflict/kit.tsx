import React from 'react';
import {renderDuel,type DuelRenderOptions} from './scene.mjs';
/** The same deterministic SVG frame used by the browser preview and offline proofs. */
export const CardConflictFrame: React.FC<DuelRenderOptions> = props =>
 <div style={{width:props.width??1280,height:props.height??720}} dangerouslySetInnerHTML={{__html:renderDuel(props)}}/>;
export {duelState,duelEvents,duelTiming,resolveDuel,validateScenario,SCENARIOS,DUEL} from './scene.mjs';
