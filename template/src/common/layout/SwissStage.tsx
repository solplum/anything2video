import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp01, slideIn} from '../easing';
import {FPS, FONT_HEAVY, FONT_MONO, FONT_ORB, H, W} from '../lib';
import {followSpring, type Vec2} from '../motion/kinematics';
import {fitSize} from '../textfit';

export type EditorialThemeId = 'obsidian' | 'paper' | 'jade-ink';

export type EditorialTheme = Readonly<{
  id: EditorialThemeId;
  bg: string;
  bgGradient: string;
  surface: string;
  surfaceAlt: string;
  hairline: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  highlight: string;
  scrimBg: string;
  scrimInk: string;
  scrimBorder: string;
  shadow: string;
}>;

export const EDITORIAL_THEMES: Record<EditorialThemeId, EditorialTheme> = {
  obsidian: {
    id: 'obsidian',
    bg: '#0B0E14',
    bgGradient: 'radial-gradient(ellipse 88% 76% at 50% 34%, #161E2E 0%, #0B0E14 100%)',
    surface: '#131926',
    surfaceAlt: '#1A2233',
    hairline: '#28344B',
    ink: '#F3F5F9',
    muted: '#94A0B4',
    accent: '#6388FF',
    accentSoft: 'rgba(99, 136, 255, 0.14)',
    highlight: '#F59E0B',
    scrimBg: 'rgba(11, 14, 20, 0.90)',
    scrimInk: '#F8FAFC',
    scrimBorder: 'rgba(255, 255, 255, 0.16)',
    shadow: '0 16px 40px rgba(0, 0, 0, 0.34)',
  },
  paper: {
    id: 'paper',
    bg: '#F4F0E8',
    bgGradient: 'radial-gradient(ellipse 92% 82% at 50% 38%, #FBF9F4 0%, #EAE3D5 100%)',
    surface: '#FFFEFA',
    surfaceAlt: '#EFEAE0',
    hairline: '#D6CEBE',
    ink: '#182026',
    muted: '#57626D',
    accent: '#C4452B',
    accentSoft: 'rgba(196, 69, 43, 0.10)',
    highlight: '#245E9E',
    scrimBg: 'rgba(24, 32, 38, 0.92)',
    scrimInk: '#FAF8F3',
    scrimBorder: 'rgba(255, 255, 255, 0.14)',
    shadow: '0 14px 32px rgba(24, 32, 38, 0.08)',
  },
  'jade-ink': {
    id: 'jade-ink',
    bg: '#0F1615',
    bgGradient: 'radial-gradient(ellipse 86% 78% at 50% 36%, #182522 0%, #0F1615 100%)',
    surface: '#16211F',
    surfaceAlt: '#1E2C29',
    hairline: '#2A3C38',
    ink: '#EFECE4',
    muted: '#98A8A2',
    accent: '#D6A254',
    accentSoft: 'rgba(214, 162, 84, 0.14)',
    highlight: '#4EA395',
    scrimBg: 'rgba(15, 22, 21, 0.92)',
    scrimInk: '#F4F1EA',
    scrimBorder: 'rgba(214, 162, 84, 0.28)',
    shadow: '0 16px 40px rgba(0, 0, 0, 0.36)',
  },
};

export const SWISS_SAFE = {
  marginX: 56,
  top: 40,
  contentWidth: 1168,
  headerHeight: 42,
  contentTopWithHeader: 98,
  contentBottom: 616, // Leaves 71px clearance for ScrimSubtitle before BAR_TOP=687
  subtitleTop: 626,
  subtitleMaxWidth: 1080,
} as const;

export function resolveEditorialTheme(theme?: EditorialThemeId | EditorialTheme): EditorialTheme {
  if (!theme) return EDITORIAL_THEMES.obsidian;
  return typeof theme === 'string' ? EDITORIAL_THEMES[theme] : theme;
}

function useStageTiming(frameProp?: number, fpsProp?: number, widthProp?: number, heightProp?: number) {
  let ctxFrame = 0;
  let ctxFps = FPS;
  let ctxW = W;
  let ctxH = H;
  if (frameProp === undefined) {
    try {
      ctxFrame = useCurrentFrame();
    } catch {
      ctxFrame = 0;
    }
  }
  if (fpsProp === undefined || widthProp === undefined || heightProp === undefined) {
    try {
      const cfg = useVideoConfig();
      ctxFps = cfg.fps;
      ctxW = cfg.width;
      ctxH = cfg.height;
    } catch {
      ctxFps = FPS;
      ctxW = W;
      ctxH = H;
    }
  }
  return {
    frame: frameProp ?? ctxFrame,
    fps: fpsProp ?? ctxFps,
    width: widthProp ?? ctxW,
    height: heightProp ?? ctxH,
  };
}

export type EditorialCanvasProps = {
  theme?: EditorialThemeId | EditorialTheme;
  eyebrow?: string;
  sectionLabel?: string;
  showGrid?: boolean;
  frame?: number;
  width?: number;
  height?: number;
  children: React.ReactNode;
};

/**
 * Constraint-driven 1280x720 editorial stage with refined tonal backdrop, header rule, and subtitle-safe bounds.
 */
export const EditorialCanvas: React.FC<EditorialCanvasProps> = ({
  theme = 'obsidian',
  eyebrow,
  sectionLabel,
  showGrid = true,
  frame,
  width,
  height,
  children,
}) => {
  const pal = resolveEditorialTheme(theme);
  const timing = useStageTiming(frame, undefined, width, height);
  const scale = Math.min(timing.width / W, timing.height / H);
  const hasHeader = Boolean(eyebrow || sectionLabel);
  const headerP = slideIn(timing.frame, 14, 2.4);
  const contentTop = hasHeader ? SWISS_SAFE.contentTopWithHeader : SWISS_SAFE.top;
  const contentHeight = SWISS_SAFE.contentBottom - contentTop;

  return (
    <AbsoluteFill
      data-editorial-stage="canvas"
      data-theme={pal.id}
      style={{
        background: pal.bgGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: FONT_HEAVY,
        color: pal.ink,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: W,
          height: H,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          flexShrink: 0,
        }}
      >
        {showGrid ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(${pal.muted} 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
              opacity: pal.id === 'paper' ? 0.14 : 0.08,
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {hasHeader ? (
          <header
            style={{
              position: 'absolute',
              left: SWISS_SAFE.marginX,
              top: SWISS_SAFE.top,
              width: SWISS_SAFE.contentWidth,
              height: SWISS_SAFE.headerHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${pal.hairline}`,
              opacity: headerP,
              transform: `translateY(${((1 - headerP) * 8).toFixed(2)}px)`,
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: pal.accent,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  color: pal.muted,
                }}
              >
                {eyebrow}
              </span>
            </div>
            {sectionLabel ? (
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  color: pal.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {sectionLabel}
              </span>
            ) : null}
          </header>
        ) : null}

        <div
          data-editorial-content="safe-zone"
          style={{
            position: 'absolute',
            left: SWISS_SAFE.marginX,
            top: contentTop,
            width: SWISS_SAFE.contentWidth,
            height: contentHeight,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type HeroMetricStageProps = {
  theme?: EditorialThemeId | EditorialTheme;
  eyebrow?: string;
  sectionLabel?: string;
  category?: string;
  metric: string;
  unit?: string;
  headline: string;
  subtitle?: string;
  benchmark?: {
    baselineLabel: string;
    targetLabel: string;
    baselineRatio: number; // 0..1
    targetRatio: number;   // 0..1
  };
  frame?: number;
};

/**
 * Editorial hero metric stage with disciplined whitespace and proportional benchmark bar.
 */
export const HeroMetricStage: React.FC<HeroMetricStageProps> = ({
  theme = 'obsidian',
  eyebrow,
  sectionLabel,
  category,
  metric,
  unit,
  headline,
  subtitle,
  benchmark,
  frame,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const metricP = followSpring((n) => (n >= 4 ? 1 : 0), f, {stiffness: 0.16, damping: 0.70, historyFrames: 24}).value;
  const textP = slideIn(Math.max(0, f - 6), 18, 2.5);
  const barP = slideIn(Math.max(0, f - 14), 22, 2.6);
  const headSize = fitSize(headline, 1020, 40, 28);

  return (
    <EditorialCanvas theme={pal} eyebrow={eyebrow} sectionLabel={sectionLabel} frame={f}>
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 22,
          padding: '12px 8px',
        }}
      >
        {category ? (
          <div style={{opacity: textP}}>
            <span
              style={{
                display: 'inline-block',
                padding: '6px 14px',
                borderRadius: 999,
                background: pal.accentSoft,
                color: pal.accent,
                border: `1px solid ${pal.hairline}`,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.0,
              }}
            >
              {category}
            </span>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            opacity: clamp01(metricP * 1.1),
            transform: `translateY(${((1 - metricP) * 24).toFixed(2)}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONT_ORB,
              fontSize: 112,
              fontWeight: 900,
              lineHeight: 0.96,
              letterSpacing: '-0.03em',
              color: pal.ink,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {metric}
          </span>
          {unit ? (
            <span
              style={{
                fontFamily: FONT_HEAVY,
                fontSize: 28,
                fontWeight: 700,
                color: pal.accent,
              }}
            >
              {unit}
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: textP,
            transform: `translateY(${((1 - textP) * 14).toFixed(2)}px)`,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: headSize,
              fontWeight: 800,
              lineHeight: 1.24,
              color: pal.ink,
            }}
          >
            {headline}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 500,
                lineHeight: 1.45,
                color: pal.muted,
                maxWidth: 940,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {benchmark ? (
          <div
            style={{
              marginTop: 8,
              padding: '18px 22px',
              background: pal.surface,
              border: `1px solid ${pal.hairline}`,
              borderRadius: 12,
              boxShadow: pal.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              opacity: slideIn(Math.max(0, f - 10), 16, 2.4),
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <span style={{width: 240, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 15, fontWeight: 600, color: pal.muted}}>
                {benchmark.baselineLabel}
              </span>
              <div style={{flex: 1, height: 10, borderRadius: 999, background: pal.surfaceAlt, overflow: 'hidden'}}>
                <div
                  style={{
                    width: `${(clamp01(benchmark.baselineRatio) * barP * 100).toFixed(1)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: pal.muted,
                  }}
                />
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <span style={{width: 240, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 15, fontWeight: 700, color: pal.ink}}>
                {benchmark.targetLabel}
              </span>
              <div style={{flex: 1, height: 10, borderRadius: 999, background: pal.surfaceAlt, overflow: 'hidden'}}>
                <div
                  style={{
                    width: `${(clamp01(benchmark.targetRatio) * barP * 100).toFixed(1)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: pal.accent,
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </EditorialCanvas>
  );
};

export type EditorialSplitStageProps = {
  theme?: EditorialThemeId | EditorialTheme;
  eyebrow?: string;
  sectionLabel?: string;
  title: string;
  summary?: string;
  points: ReadonlyArray<{title: string; detail?: string}>;
  ratio?: '5:7' | '7:5';
  diagramSide?: 'right' | 'left';
  frame?: number;
  children: React.ReactNode;
};

/**
 * Asymmetric 5:7 / 7:5 split editorial stage pairing structured thesis points with a framed diagram viewport.
 */
export const EditorialSplitStage: React.FC<EditorialSplitStageProps> = ({
  theme = 'obsidian',
  eyebrow,
  sectionLabel,
  title,
  summary,
  points,
  ratio = '5:7',
  diagramSide = 'right',
  frame,
  children,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const titleP = slideIn(f, 16, 2.5);
  const viewP = followSpring((n) => (n >= 6 ? 1 : 0), f, {stiffness: 0.16, damping: 0.74, historyFrames: 24}).value;
  const cols =
    diagramSide === 'right'
      ? ratio === '5:7'
        ? '5fr 7fr'
        : '7fr 5fr'
      : ratio === '5:7'
        ? '7fr 5fr'
        : '5fr 7fr';

  const copyColumn = (
    <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, minWidth: 0}}>
      <div style={{opacity: titleP, transform: `translateY(${((1 - titleP) * 12).toFixed(2)}px)`}}>
        <h2
          style={{
            margin: 0,
            fontSize: fitSize(title, 440, 34, 24),
            fontWeight: 800,
            lineHeight: 1.24,
            color: pal.ink,
          }}
        >
          {title}
        </h2>
        {summary ? (
          <p style={{margin: '10px 0 0', fontSize: 17, lineHeight: 1.5, color: pal.muted}}>
            {summary}
          </p>
        ) : null}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {points.map((pt, idx) => {
          const p = slideIn(Math.max(0, f - (6 + idx * 6)), 16, 2.4);
          return (
            <div
              key={pt.title}
              style={{
                padding: '13px 16px',
                background: pal.surface,
                border: `1px solid ${pal.hairline}`,
                borderLeft: `3px solid ${pal.accent}`,
                borderRadius: 10,
                opacity: p,
                transform: `translateX(${((1 - p) * -14).toFixed(2)}px)`,
              }}
            >
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                <span style={{fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: pal.accent}}>
                  0{idx + 1}
                </span>
                <span style={{fontSize: 18, fontWeight: 700, color: pal.ink}}>{pt.title}</span>
              </div>
              {pt.detail ? (
                <div style={{marginTop: 4, paddingLeft: 28, fontSize: 15, lineHeight: 1.4, color: pal.muted}}>
                  {pt.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const visualColumn = (
    <div
      style={{
        position: 'relative',
        height: '100%',
        background: pal.surface,
        border: `1px solid ${pal.hairline}`,
        borderRadius: 14,
        boxShadow: pal.shadow,
        overflow: 'hidden',
        opacity: clamp01(viewP * 1.05),
        transform: `scale(${(0.96 + 0.04 * viewP).toFixed(4)})`,
      }}
    >
      {children}
    </div>
  );

  return (
    <EditorialCanvas theme={pal} eyebrow={eyebrow} sectionLabel={sectionLabel} frame={f}>
      <div
        style={{
          height: '100%',
          display: 'grid',
          gridTemplateColumns: cols,
          gap: 28,
          alignItems: 'stretch',
        }}
      >
        {diagramSide === 'right' ? copyColumn : visualColumn}
        {diagramSide === 'right' ? visualColumn : copyColumn}
      </div>
    </EditorialCanvas>
  );
};

export type ProcessStep = Readonly<{
  tag: string;
  title: string;
  detail: string;
  metric?: string;
}>;

export type ProcessFlowStageProps = {
  theme?: EditorialThemeId | EditorialTheme;
  eyebrow?: string;
  sectionLabel?: string;
  headline: string;
  steps: ReadonlyArray<ProcessStep>;
  activeStep?: number;
  frame?: number;
};

/**
 * Connected N-step process pipeline with automatic card spacing and active-step spotlighting.
 */
export const ProcessFlowStage: React.FC<ProcessFlowStageProps> = ({
  theme = 'obsidian',
  eyebrow,
  sectionLabel,
  headline,
  steps,
  activeStep,
  frame,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const headP = slideIn(f, 16, 2.5);
  const beamP = slideIn(Math.max(0, f - 8), 24, 2.4);

  return (
    <EditorialCanvas theme={pal} eyebrow={eyebrow} sectionLabel={sectionLabel} frame={f}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
        <h2
          style={{
            margin: 0,
            fontSize: fitSize(headline, 1100, 38, 26),
            fontWeight: 800,
            color: pal.ink,
            opacity: headP,
            transform: `translateY(${((1 - headP) * 10).toFixed(2)}px)`,
          }}
        >
          {headline}
        </h2>

        <div style={{position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, steps.length)}, 1fr)`, gap: 20}}>
          {steps.length > 1 ? (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '10%',
                right: '10%',
                top: 44,
                height: 2,
                background: pal.hairline,
                zIndex: 0,
              }}
            >
              <div
                style={{
                  width: `${(beamP * 100).toFixed(1)}%`,
                  height: '100%',
                  background: pal.accent,
                }}
              />
            </div>
          ) : null}

          {steps.map((step, i) => {
            const p = followSpring((n) => (n >= i * 6 + 4 ? 1 : 0), f, {
              stiffness: 0.16,
              damping: 0.72,
              historyFrames: 24,
            }).value;
            const isFocus = activeStep === undefined || activeStep === i;
            return (
              <div
                key={step.tag + step.title}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  padding: '24px 22px',
                  borderRadius: 14,
                  background: isFocus ? pal.surface : pal.surfaceAlt,
                  border: `1px solid ${activeStep === i ? pal.accent : pal.hairline}`,
                  boxShadow: isFocus ? pal.shadow : undefined,
                  opacity: clamp01(p),
                  transform: `translateY(${((1 - p) * 18).toFixed(2)}px)`,
                }}
              >
                <div style={{opacity: isFocus ? 1 : 0.65, display: 'flex', flexDirection: 'column', gap: 12}}>
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: isFocus ? pal.accentSoft : pal.surface,
                        color: isFocus ? pal.accent : pal.muted,
                        fontFamily: FONT_MONO,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 1.0,
                      }}
                    >
                      {step.tag}
                    </span>
                    {step.metric ? (
                      <span style={{fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: pal.highlight}}>
                        {step.metric}
                      </span>
                    ) : null}
                  </div>
                  <div style={{fontSize: 22, fontWeight: 800, color: pal.ink, lineHeight: 1.25}}>{step.title}</div>
                  <div style={{fontSize: 16, fontWeight: 500, color: pal.muted, lineHeight: 1.5}}>{step.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </EditorialCanvas>
  );
};

export type ComparisonColumn = Readonly<{
  badge: string;
  title: string;
  accent?: boolean;
  rows: ReadonlyArray<{label: string; value: string}>;
}>;

export type ComparisonSplitStageProps = {
  theme?: EditorialThemeId | EditorialTheme;
  eyebrow?: string;
  sectionLabel?: string;
  headline: string;
  left: ComparisonColumn;
  right: ComparisonColumn;
  frame?: number;
};

/**
 * Clean side-by-side comparison stage with aligned hairline specification rows.
 */
export const ComparisonSplitStage: React.FC<ComparisonSplitStageProps> = ({
  theme = 'obsidian',
  eyebrow,
  sectionLabel,
  headline,
  left,
  right,
  frame,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const headP = slideIn(f, 16, 2.4);

  const renderCol = (col: ComparisonColumn, delay: number) => {
    const p = slideIn(Math.max(0, f - delay), 18, 2.5);
    return (
      <div
        style={{
          padding: '24px 26px',
          borderRadius: 14,
          background: pal.surface,
          border: `1px solid ${col.accent ? pal.accent : pal.hairline}`,
          boxShadow: pal.shadow,
          opacity: p,
          transform: `translateY(${((1 - p) * 14).toFixed(2)}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              background: col.accent ? pal.accentSoft : pal.surfaceAlt,
              color: col.accent ? pal.accent : pal.muted,
              fontFamily: FONT_MONO,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.0,
            }}
          >
            {col.badge}
          </span>
        </div>
        <h3 style={{margin: 0, fontSize: 26, fontWeight: 800, color: pal.ink}}>{col.title}</h3>
        <div style={{display: 'flex', flexDirection: 'column', marginTop: 4}}>
          {col.rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '11px 0',
                borderTop: `1px solid ${pal.hairline}`,
                gap: 16,
              }}
            >
              <span style={{fontSize: 15, fontWeight: 500, color: pal.muted}}>{r.label}</span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: col.accent ? pal.ink : pal.muted,
                  textAlign: 'right',
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <EditorialCanvas theme={pal} eyebrow={eyebrow} sectionLabel={sectionLabel} frame={f}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22}}>
        <h2 style={{margin: 0, fontSize: fitSize(headline, 1100, 36, 24), fontWeight: 800, color: pal.ink, opacity: headP}}>
          {headline}
        </h2>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24}}>
          {renderCol(left, 4)}
          {renderCol(right, 10)}
        </div>
      </div>
    </EditorialCanvas>
  );
};

export type CalloutBadgeSpec = Readonly<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  detail?: string;
  align?: 'left' | 'right';
}>;

export type CalloutGeometry = Readonly<{
  anchor: Vec2;
  elbow: Vec2;
  badgeEdge: Vec2;
  badgeBox: {x: number; y: number; width: number; height: number};
}>;

/**
 * Computes exact anchor -> elbow -> badge border coordinates so callout leader lines never float in empty air.
 */
export function computeCalloutGeometry(anchor: Vec2, badge: CalloutBadgeSpec): CalloutGeometry {
  const width = badge.width ?? Math.max(148, Math.round(badge.label.length * 14 + 34));
  const height = badge.height ?? (badge.detail ? 52 : 34);
  const align = badge.align ?? (badge.x >= anchor.x ? 'right' : 'left');
  const boxX = align === 'right' ? badge.x : badge.x - width;
  const boxY = badge.y - height / 2;
  const edgeX = align === 'right' ? boxX : boxX + width;
  const edgeY = badge.y;
  const elbowX = (anchor.x + edgeX) / 2;
  return {
    anchor,
    elbow: {x: elbowX, y: edgeY},
    badgeEdge: {x: edgeX, y: edgeY},
    badgeBox: {x: boxX, y: boxY, width, height},
  };
}

export type AnchoredCalloutProps = {
  anchor: Vec2;
  badge: CalloutBadgeSpec;
  theme?: EditorialThemeId | EditorialTheme;
  delayFrames?: number;
  frame?: number;
  canvasWidth?: number;
  canvasHeight?: number;
};

/**
 * Target-anchored diagram callout: renders concentric anchor dot, exact SVG elbow leader, and crisp badge.
 */
export const AnchoredCallout: React.FC<AnchoredCalloutProps> = ({
  anchor,
  badge,
  theme = 'obsidian',
  delayFrames = 0,
  frame,
  canvasWidth = 660,
  canvasHeight = 516,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const p = slideIn(Math.max(0, f - delayFrames), 16, 2.4);
  const geom = computeCalloutGeometry(anchor, badge);
  const d = `M ${geom.anchor.x.toFixed(2)} ${geom.anchor.y.toFixed(2)} L ${geom.elbow.x.toFixed(2)} ${geom.elbow.y.toFixed(2)} L ${geom.badgeEdge.x.toFixed(2)} ${geom.badgeEdge.y.toFixed(2)}`;

  return (
    <div
      data-anchored-callout="true"
      data-anchor-x={geom.anchor.x}
      data-anchor-y={geom.anchor.y}
      data-edge-x={geom.badgeEdge.x}
      data-edge-y={geom.badgeEdge.y}
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: p}}
    >
      <svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{position: 'absolute', inset: 0, overflow: 'visible'}}
      >
        <path d={d} fill="none" stroke={pal.accent} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={geom.anchor.x} cy={geom.anchor.y} r={8} fill={pal.accentSoft} stroke={pal.accent} strokeWidth={1.5} />
        <circle cx={geom.anchor.x} cy={geom.anchor.y} r={3.5} fill={pal.accent} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: geom.badgeBox.x,
          top: geom.badgeBox.y,
          width: geom.badgeBox.width,
          minHeight: geom.badgeBox.height,
          padding: '6px 14px',
          boxSizing: 'border-box',
          borderRadius: 8,
          background: pal.surfaceAlt,
          border: `1px solid ${pal.accent}`,
          boxShadow: pal.shadow,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <span style={{fontSize: 14, fontWeight: 700, color: pal.ink, lineHeight: 1.25}}>{badge.label}</span>
        {badge.detail ? (
          <span style={{fontFamily: FONT_MONO, fontSize: 12, color: pal.muted, marginTop: 2}}>{badge.detail}</span>
        ) : null}
      </div>
    </div>
  );
};

export type ScrimSubtitleProps = {
  text?: string;
  subs?: ReadonlyArray<{from: number; to: number; text: string}>;
  theme?: EditorialThemeId | EditorialTheme;
  frame?: number;
};

/**
 * High-contrast frosted pill subtitle bar anchored cleanly in the bottom safe zone (above BAR_TOP=687).
 */
export const ScrimSubtitle: React.FC<ScrimSubtitleProps> = ({
  text,
  subs,
  theme = 'obsidian',
  frame,
}) => {
  const pal = resolveEditorialTheme(theme);
  const {frame: f} = useStageTiming(frame);
  const absN = f + 1;
  const activeText =
    text ??
    subs?.find((entry) => absN >= entry.from && absN <= entry.to)?.text ??
    '';
  if (!activeText) return null;
  const size = fitSize(activeText, SWISS_SAFE.subtitleMaxWidth - 48, 30, 22);

  return (
    <div
      data-scrim-subtitle="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: SWISS_SAFE.subtitleTop,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: SWISS_SAFE.subtitleMaxWidth,
          padding: '8px 22px',
          borderRadius: 999,
          background: pal.scrimBg,
          color: pal.scrimInk,
          border: `1px solid ${pal.scrimBorder}`,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          fontFamily: FONT_HEAVY,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.25,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {activeText}
      </div>
    </div>
  );
};
