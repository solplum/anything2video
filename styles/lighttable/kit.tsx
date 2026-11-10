import React, {useId} from 'react';
import {renderLighttable} from './scene.mjs';

/** The same frame renderer powers the browser study and Remotion composition. */
export const LighttableStudy: React.FC<{frame:number;fps:number;width:number;height:number}> = ({frame,fps,width,height}) => {
  const idPrefix = `lt-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  return <div style={{width,height}} dangerouslySetInnerHTML={{__html:renderLighttable({frame,fps,width,height,idPrefix})}} />;
};
