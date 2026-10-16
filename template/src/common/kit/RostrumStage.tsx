// RostrumStage 真实历史档案与文献翻拍机摄影台组件（v5.0.0 新增）
// 吸收自 archival-doc（真实影像纪录片方法论）与 lemo-opuscar / dashi-animationstyle。
// 提供高精度的老照片、古籍文献、条约原件与手稿的视线跟随扫描、Ken Burns 恒速慢推、
// 物理纸纹呼吸、光学暗角与朱红印章/文献高亮框选标注。

import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, Img} from 'remotion';

export interface ArchivalHighlight {
  /** 归一化坐标 x (0..1) */
  x: number;
  /** 归一化坐标 y (0..1) */
  y: number;
  /** 归一化宽度 w (0..1) */
  w: number;
  /** 归一化高度 h (0..1) */
  h: number;
  /** 标注文字或印章说明 */
  label?: string;
  /** 标注在第几帧入场 (默认第 15 帧) */
  startFrame?: number;
  /** 类型: 'box' (高亮墨框) | 'stamp' (朱红印章) | 'underline' (朱批下划线) */
  type?: 'box' | 'stamp' | 'underline';
}

export interface RostrumStageProps {
  /** 档案图片路径或 URL */
  src: string;
  /** 起始焦点归一坐标 [x, y] (默认 [0.5, 0.5]) */
  startFocus?: [number, number];
  /** 结束焦点归一坐标 [x, y] (默认 [0.5, 0.5]) */
  endFocus?: [number, number];
  /** 起始缩放倍率 (默认 1.05) */
  startZoom?: number;
  /** 结束缩放倍率 (默认 1.15) */
  endZoom?: number;
  /** 光学暗角强度 (0..1, 默认 0.25) */
  vignette?: number;
  /** 是否启用微抖动呼吸感 (模拟物理翻拍机微晃, 默认 true) */
  microShake?: boolean;
  /** 纸纹或老胶片微粒度 (0..1, 默认 0.15) */
  grain?: number;
  /** 文献标注/印章列表 */
  highlights?: ArchivalHighlight[];
  /** 档案存证标签: 年份、藏馆、文献标题 */
  meta?: {
    title?: string;
    year?: number | string;
    archive?: string;
    license?: string;
  };
  style?: React.CSSProperties;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const RostrumStage: React.FC<RostrumStageProps> = ({
  src,
  startFocus = [0.5, 0.5],
  endFocus = [0.5, 0.5],
  startZoom = 1.05,
  endZoom = 1.15,
  vignette = 0.25,
  microShake = true,
  grain = 0.15,
  highlights = [],
  meta,
  style,
}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  const progress = clamp01(frame / Math.max(1, durationInFrames - 1));
  // 纪录片平稳恒速微推 (Smooth Linear-Cosine)
  const smoothProgress = 0.5 * (1 - Math.cos(Math.PI * progress));

  // 焦点插值
  const fx = startFocus[0] + (endFocus[0] - startFocus[0]) * smoothProgress;
  const fy = startFocus[1] + (endFocus[1] - startFocus[1]) * smoothProgress;
  const currentZoom = startZoom + (endZoom - startZoom) * smoothProgress;

  // 微晃计算 (正弦+余弦确定性微抖动，最大位移 ≤ 1.2px)
  const shakeX = microShake ? Math.sin(frame * 0.12) * 1.2 : 0;
  const shakeY = microShake ? Math.cos(frame * 0.18) * 0.9 : 0;

  // 居中偏移计算: 将当前焦点 (fx, fy) 映射至视口中心并缩放
  const translateX = (0.5 - fx) * width * currentZoom + shakeX;
  const translateY = (0.5 - fy) * height * currentZoom + shakeY;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0c0a09',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 底层主图：高精度档案扫描件 */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          transform: `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`,
          transformOrigin: '50% 50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img
          src={src}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          }}
        />

        {/* 随画移动的局部高亮框与朱红印章 */}
        {highlights.map((hl, idx) => {
          const start = hl.startFrame ?? 15;
          if (frame < start) return null;
          const hlAge = frame - start;
          const enterProgress = clamp01(hlAge / 10);

          if (hl.type === 'stamp') {
            // 朱红印章: 缩放沉稳砸下 (1.3 -> 1.0 带轻微阻尼)
            const stampScale = 1 + 0.3 * Math.exp(-hlAge * 0.3) * Math.cos(hlAge * 0.5);
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${hl.x * 100}%`,
                  top: `${hl.y * 100}%`,
                  width: `${hl.w * 100}%`,
                  height: `${hl.h * 100}%`,
                  transform: `scale(${stampScale})`,
                  transformOrigin: 'center center',
                  border: '2px solid rgba(220, 38, 38, 0.85)',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 'bold',
                  fontFamily: 'serif',
                  letterSpacing: 2,
                  boxShadow: 'inset 0 0 8px rgba(220, 38, 38, 0.4)',
                  opacity: enterProgress,
                }}
              >
                {hl.label || '存证原件'}
              </div>
            );
          }

          // 默认: 半透明朱砂墨框标出关键词/段落
          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: `${hl.x * 100}%`,
                top: `${hl.y * 100}%`,
                width: `${hl.w * 100}%`,
                height: `${hl.h * 100}%`,
                border: '2px dashed rgba(234, 179, 8, 0.9)',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                opacity: enterProgress,
                transition: 'opacity 0.2s ease',
              }}
            >
              {hl.label && (
                <span
                  style={{
                    position: 'absolute',
                    top: -22,
                    left: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    color: '#fef08a',
                    padding: '2px 6px',
                    fontSize: 12,
                    borderRadius: 2,
                    border: '1px solid rgba(234, 179, 8, 0.6)',
                  }}
                >
                  {hl.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 光学暗角 (Vignette) */}
      {vignette > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,${vignette * 1.5}) 100%)`,
          }}
        />
      )}

      {/* 历史文献存证角标 (Provenance Cartouche) */}
      {meta && (
        <div
          style={{
            position: 'absolute',
            left: 48,
            bottom: 48,
            backgroundColor: 'rgba(12, 10, 9, 0.82)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(214, 211, 209, 0.25)',
            borderLeft: '3px solid #b45309',
            padding: '8px 16px',
            color: '#e7e5e4',
            fontFamily: 'serif',
            fontSize: 14,
            maxWidth: 420,
            zIndex: 10,
          }}
        >
          {meta.title && <div style={{fontWeight: 600, color: '#f5f5f4'}}>{meta.title}</div>}
          <div style={{fontSize: 12, color: '#a8a29e', marginTop: 3}}>
            {[meta.year, meta.archive, meta.license].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
