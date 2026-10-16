// 镜头动效词汇 kit —— 移植自 video-shotcraft (Apache-2.0, Vincentwei1021)
// 用法：import {PageCam, DigitRoll, lagged, dampedSettle, mulberry32, handheld} from '../../common/kit'
// 出处与许可见同目录 ATTRIBUTION.md；完整原库（含 three.js 组件）见 skill 根 gallery/lib-ref/
export * from './motion';
export * from './rand';
export * from './shake';
export * from './DigitRoll';
export * from './FlashCut';
export * from './Caption';
export * from './PageCam';
export * from './ClipCard';
export * from './VerticalTicker';
// v3.9.0 配方层四件套（机制借鉴 lanshu-create-ai-presenter-video，MIT——Remotion 重写；各文件头有用法与帧号口径）
export * from './WordLitCaption';
export * from './ChapterBadge';
export * from './GoldenQuote';
export * from './RecapFrame';
// v4.3.0 可变字体轴动画（方法论吸收 mexicat/pdoom-video，MIT；用法与字体轴实测见文件头）
export * from './VarText';
// v4.4.0 单笔画字体库+逐字写出（逐字移植 mexicat/pdoom-video stroke.ts，MIT；
// 字体 Hershey 公有领域 + EMS OFL，已 vendor 到 public/fonts/stroke/；仅拉丁——中文走 draw-svg-trace）
export * from './StrokeText';
// v4.6.0 仪器解剖几何引擎（移植与重构自 Anatomy，MIT，wheresryan22）
export * as iso from './iso';
export * from './iso';
// v5.0.0 历史档案与文献翻拍机摄影台（吸收自 archival-doc，MIT，用于真实历史影像纪录片）
export * from './RostrumStage';


