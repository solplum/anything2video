export declare const TOKENS: Readonly<Record<string,string>>;
export declare const DURATION_SECONDS: number;
export declare function layoutFor(width:number,height:number): {portrait:boolean;w:number;h:number;page:{x:number;y:number;w:number;h:number};tag:{x:number;y:number;w:number;h:number};lensA:{x:number;y:number};lensB:{x:number;y:number};radius:number;footY:number};
export declare function stateAt(frame:number,fps:number,width?:number,height?:number): {t:number;layout:ReturnType<typeof layoutFor>;reveal:number;lensOpacity:number;lens:{x:number;y:number};markA:number;markB:number;conclusion:number;stage:number};
export declare function renderLighttable(options?: {frame?:number;fps?:number;width?:number;height?:number;idPrefix?:string}): string;
