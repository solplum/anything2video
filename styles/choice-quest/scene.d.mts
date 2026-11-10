export type QuestBranch='repair'|'wait';
export interface QuestOptions {frame:number;fps?:number;branch?:QuestBranch;selectSec?:number;}
export interface QuestRenderOptions extends QuestOptions {width?:number;height?:number;showCaptions?:boolean;}
export const QUEST:Readonly<{fps:number;width:number;height:number;seconds:number;frames:number}>;
export const COLORS:Readonly<Record<string,string>>;
export function questTiming(selectSec?:number):Readonly<Record<'select'|'reach'|'contact'|'bridgeStart'|'bridgeEnd'|'crossStart'|'crossEnd'|'beacon',number>>;
export function evaluateChoiceEvents<T extends Record<string,string|number|boolean>>(options:{frame:number;initial:T;events:{id:string;atFrame:number;set:Partial<T>}[]}):Readonly<T>;
export function questState(options:QuestOptions):Readonly<{t:number;frame:number;fps:number;branch:QuestBranch;timing:ReturnType<typeof questTiming>;phase:string;selected:boolean;heroX:number;moving:boolean;walkFrame:number;palmX:number;palmY:number;cellX:number;cellY:number;cellOwner:string;inventory:number;terminalPowered:boolean;bridge:number;crossing:boolean;beacon:boolean;caption:string;message:string;option:QuestBranch}>;
export function renderQuest(options:QuestRenderOptions):string;
