// 共用层入口：镜头组件 `import {…} from '../../common'`
export * from './lib';
export * from './easing';
export * from './textfit';
export * from './Glitch';
export * from './StarField';
export * from './Fog';
export * from './DotFieldBg';
export type {ShotDef, BgSpec} from './types';
export * from './ProgressBar';
export {SubtitleLine, SUB_STYLE, strokeShadow, Subtitles} from './Subtitle';
export * from './SceneWipe';
export * from './Throughline';
export * from './FrameGrade';
export * from './timeline';
export * from './Footage';
export {PoemSubtitleLine, POEM_STYLE} from './PoemSubtitle';
export {TempGrade} from './TempGrade';
export type {TempStop} from './TempGrade';
export {PerCharReveal} from './PerCharReveal';
export {ParticleText} from './ParticleText';
export {TreeGrow} from './TreeGrow';
export {SealStamp} from './SealStamp';
// v4.3.0 音乐反应层（数据来自 scripts/audio_features.py；纪律见 music-beat-sync §7）
export * from './music';

export * from './motion/cues';
