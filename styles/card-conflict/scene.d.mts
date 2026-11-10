export interface Card {id:string;name:string;tag:string;art:'anchor'|'boat'|'greenhouse'|'basket';cost:number;guard:number;reward:number}
export interface Scenario {id:string;name:string;chapter:string;goal:string;objective:string;objectiveArt:'lighthouse'|'seedling';maxIntegrity:number;energy:number;threat:{name:string;art:'storm'|'frost';power:number};theme:Record<'table'|'shadow'|'ink'|'paper'|'gold'|'accent'|'danger',string>;choices:Card[]}
export interface DuelOptions {scenario?:Scenario;choice?:string;fps?:number;selectSec?:number}
export interface DuelRenderOptions extends DuelOptions {frame:number;width?:number;height?:number;showCaptions?:boolean}
export interface DuelState {frame:number;fps:number;t:number;time:Readonly<Record<'select'|'commit'|'attack'|'impact'|'settle'|'end',number>>;phase:'choose'|'commit'|'protect'|'attack'|'resolve'|'result';chosen:boolean;committed:boolean;impacted:boolean;choice:string|null;energy:number;guard:number;integrity:number;reward:number;blocked:number;damage:number;success:boolean|null;cardProgress:number;attackProgress:number;resolveProgress:number}
export const DUEL:Readonly<{fps:number;durationSeconds:number;frames:number;width:number;height:number}>;
export const SCENARIOS:Readonly<Record<'lighthouse'|'greenhouse',Scenario>>;
export const DEFAULT_SCENARIO:Scenario;
export function renderDuel(options:DuelRenderOptions):string;
export function duelState(options:DuelOptions & {frame:number}):Readonly<DuelState>;
export function duelTiming(options?:Pick<DuelOptions,'fps'|'selectSec'>):DuelState['time'];
export function resolveDuel(options?:DuelOptions):Readonly<{energy:number;guard:number;blocked:number;damage:number;integrity:number;reward:number}>;
export function duelEvents(options?:DuelOptions):ReadonlyArray<Readonly<Record<string,string|number>>>;
export function validateScenario(scenario:Scenario):Scenario;

export function describeCard(card:Card):string;
export function outcomeCaption(scenario:Scenario,state:DuelState):string;
