import React,{useId} from 'react';
import {renderPorcelain,type PorcelainOptions} from './scene.mjs';
/** Random-access frame-safe wrapper. Stable unique mask IDs support multiple players. */
export const PorcelainReveal:React.FC<PorcelainOptions> = props => {
 const uid=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <div style={{width:props.width??1280,height:props.height??720}} dangerouslySetInnerHTML={{__html:renderPorcelain({...props,idPrefix:props.idPrefix??`porcelain-${uid}`})}}/>;
};
export {materialState,bloomPath,bloomRadius,originalArtwork,PORCELAIN,COLORS} from './scene.mjs';
