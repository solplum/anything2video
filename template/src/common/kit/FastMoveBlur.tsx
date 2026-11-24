/**
 * FastMoveBlur —— 仅包裹高速运动层或短冲击窗的相机运动模糊（基于 @remotion/motion-blur CameraMotionBlur）。
 * 默认 samples=6、shutterAngle=180（参数均可在 props 覆写）。
 * 注意：渲染耗时大致按 samples 倍线性放大；严禁包裹字幕层或需持续清晰阅读的关键文字层。
 */
import React from 'react';
import {CameraMotionBlur, type CameraMotionBlurProps} from '@remotion/motion-blur';

export type FastMoveBlurProps = CameraMotionBlurProps;

export const FastMoveBlur: React.FC<FastMoveBlurProps> = ({
  samples = 6,
  shutterAngle = 180,
  children,
}) => (
  <CameraMotionBlur samples={samples} shutterAngle={shutterAngle}>
    {children}
  </CameraMotionBlur>
);
