export interface PorcelainOptions {frame?:number;fps?:number;width?:number;height?:number;seed?:number;speed?:number;showText?:boolean;title?:string;subtitle?:string;idPrefix?:string;artworkSvg?:string;bloomSources?:[number,number,number,number,number][]}
export interface MaterialState {t:number;wet:number;settled:number;title:number;border:number;complete:boolean}
export const PORCELAIN:Readonly<{fps:number;seconds:number;frames:number;width:number;height:number}>;
export const COLORS:Readonly<Record<string,string>>;
export function seeded(seed?:number):()=>number;
export function materialState(frame?:number,fps?:number,options?:{speed?:number}):MaterialState;
export function bloomRadius(t:number,start:number,radius?:number,duration?:number):number;
export function bloomPath(cx:number,cy:number,r:number,seed?:number,aspect?:number):string;
export function originalArtwork(options?:{portrait?:boolean;idPrefix?:string}):string;
export function renderPorcelain(options?:PorcelainOptions):string;
