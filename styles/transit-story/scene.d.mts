export type Line = 'people'|'venue'|'joined';
export interface TransitNode {id:string;label:string;line?:Line;startAt?:number;dwell?:number}
export interface TransitEdge {id:string;from:string;to:string;duration:number;line:Line;blockedAt?:number}
export interface TransitGraph {title?:string;subtitle?:string;lineNames?:{people:string;venue:string};captions?:Partial<Record<'complete'|'ready'|'waiting'|'moving',string>>;nodes:TransitNode[];edges:TransitEdge[]}
export interface TransitLayout {portrait:boolean;w:number;h:number;positions:Record<string,[number,number]>;via:Record<string,[number,number][]>}
export interface ScheduledNode extends TransitNode {incoming:string[];outgoing:string[];firstAt:number;readyAt:number;releaseAt:number}
export interface ScheduledEdge extends TransitEdge {startAt:number;arriveAt:number;stopAt:number}
export interface TransitSchedule {nodes:Record<string,ScheduledNode>;edges:Record<string,ScheduledEdge>;terminalIds:string[]}
export interface TransitNodeState extends ScheduledNode {visible:boolean;ready:boolean;released:boolean;arrivedCount:number;waiting:boolean;reveal:number}
export interface TransitEdgeState extends ScheduledEdge {progress:number;started:boolean;arrived:boolean;blocked:boolean;active:boolean}
export interface TransitState {t:number;nodes:Record<string,TransitNodeState>;edges:Record<string,TransitEdgeState>;complete:boolean}
export interface RenderOptions {frame?:number;fps?:number;width?:number;height?:number;delay?:number;blocked?:boolean;showCaptions?:boolean;graph?:TransitGraph;layout?:TransitLayout;idPrefix?:string}
export const TRANSIT:Readonly<{fps:number;seconds:number;frames:number;width:number;height:number}>;
export const PALETTE:Readonly<Record<string,string>>;
export function compileTransit(graph:TransitGraph):TransitSchedule;
export function transitState(graph:TransitGraph,frame:number,fps?:number):TransitState;
export function makeOpeningStory(options?:{delay?:number;blocked?:boolean}):TransitGraph;
export function layoutFor(width:number,height:number):TransitLayout;
export function routePoints(edge:TransitEdge,layout:TransitLayout):[number,number][];
export function pointOnRoute(points:[number,number][],progress:number):{x:number;y:number;length:number};
export function renderTransit(options?:RenderOptions):string;
