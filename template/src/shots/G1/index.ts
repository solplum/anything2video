import type {ShotDef, BgSpec, FootageSpec} from '../../common';
// 组 G1：镜头表 / 背景覆写 / 实拍层。数组顺序即层序（后者在上）。帧区间优先用 span('S01','S03') / at('hit') 绑定旁白锚点，不用手抄数字帧号。
// 示例：{id: 'SC01', ...span('S01', 'S03'), Comp: Intro}；组件内用 local('hit', F0) 对照 useCurrentFrame()，或 N = useCurrentFrame() + F0。
export const SHOTS_G1: ShotDef[] = [];
export const BG_G1: BgSpec[] = [];
export const FOOTAGE_G1: FootageSpec[] = [];
