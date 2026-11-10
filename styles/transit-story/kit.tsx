import React, {useId} from 'react';
import {renderTransit} from './scene.mjs';
import type {RenderOptions} from './scene.mjs';
/** Shared core: the browser, offline study and Remotion use exactly the same SVG. */
export const TransitStoryFrame: React.FC<RenderOptions> = props => {
 const idPrefix=`transit-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
 return <div style={{width:props.width??1280,height:props.height??720}} dangerouslySetInnerHTML={{__html:renderTransit({...props,idPrefix})}}/>;
};
