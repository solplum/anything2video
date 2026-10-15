import React from 'react';
import {
  Projection,
  Plan,
  iso,
  slabOf,
  cylinder,
  knurl,
  coil,
  haloOf,
  roundedPlan,
  corners,
  insetPlan,
  tubePieces,
  IsoSolid,
  IsoLine,
  ISO_THEMES,
  IsoTheme,
} from '../../template/src/common/kit/iso';

export interface AnatomyProps {
  projection: Projection;
  theme?: 'dark' | 'light';
}

/** 仪器重型底座带脚垫、边框槽与角部螺丝 */
export const AnatomyBase: React.FC<AnatomyProps & { plan: Plan; height?: number; z?: number }> = ({
  projection,
  theme = 'dark',
  plan,
  height = 12,
  z = 0,
}) => {
  const t = ISO_THEMES[theme];
  const halo = haloOf(plan, z, 12, projection);
  const slab = slabOf(plan, z, height, projection, 8, 1.2);
  const groove = roundedPlan(insetPlan(plan, 6), 8).map(p => iso([p[0], p[1], z + height], projection));
  const groovePath = groove.length ? `M${groove.map(p => `${p[0]} ${p[1]}`).join('L')}Z` : '';
  const screwCorners = corners(plan, 10);

  return (
    <g>
      {/* 底部柔和阴影 */}
      <path d={halo} fill={theme === 'dark' ? '#000000' : '#cbd5e1'} opacity={0.4} filter="blur(8px)" />
      {/* 脚垫 */}
      {corners(plan, 18).map(([fx, fy], idx) => {
        const foot = cylinder(fx, fy, 8, z - 8, 8, projection, 16);
        return <IsoSolid key={idx} paths={foot} tone="lo" theme={theme} />;
      })}
      {/* 主底板 */}
      <IsoSolid paths={slab} tone="mid" theme={theme} />
      {/* 表面凹槽 */}
      {groovePath && <path d={groovePath} fill="none" stroke={t.strokeFaint} strokeWidth={0.8} />}
      {/* 角部精密螺栓 */}
      {screwCorners.map(([sx, sy], idx) => {
        const pt = iso([sx, sy, z + height], projection);
        return (
          <circle
            key={idx}
            cx={pt[0]}
            cy={pt[1]}
            r={2.5 * projection.scale}
            fill={t.fillLo}
            stroke={t.stroke}
            strokeWidth={0.6}
          />
        );
      })}
    </g>
  );
};

/** 双导轨与限位块 */
export const AnatomyRails: React.FC<AnatomyProps & {
  x: number;
  y1: number;
  y2: number;
  length: number;
  z: number;
  width?: number;
  height?: number;
}> = ({ projection, theme = 'dark', x, y1, y2, length, z, width = 6, height = 5 }) => {
  const rail1 = slabOf({ x, y: y1 - width / 2, w: length, d: width, r: 1.5 }, z, height, projection, 4);
  const rail2 = slabOf({ x, y: y2 - width / 2, w: length, d: width, r: 1.5 }, z, height, projection, 4);
  const stop1 = slabOf({ x: x - 4, y: y1 - 10, w: 6, d: y2 - y1 + 20, r: 2 }, z, height + 4, projection, 4);
  const stop2 = slabOf({ x: x + length - 2, y: y1 - 10, w: 6, d: y2 - y1 + 20, r: 2 }, z, height + 4, projection, 4);

  return (
    <g>
      <IsoSolid paths={rail1} tone="lo" theme={theme} />
      <IsoSolid paths={rail2} tone="lo" theme={theme} />
      <IsoSolid paths={stop1} tone="mid" theme={theme} />
      <IsoSolid paths={stop2} tone="mid" theme={theme} />
    </g>
  );
};

/** 精密滑台 */
export const AnatomyCarriage: React.FC<AnatomyProps & {
  x: number;
  y: number;
  w: number;
  d: number;
  z: number;
  height?: number;
}> = ({ projection, theme = 'dark', x, y, w, d, z, height = 8 }) => {
  const slab = slabOf({ x: x - w / 2, y: y - d / 2, w, d, r: 3 }, z, height, projection, 6);
  return (
    <g>
      <IsoSolid paths={slab} tone="hi" theme={theme} />
    </g>
  );
};

/** 千分表/压力表盘与活动指针 */
export const AnatomyDial: React.FC<AnatomyProps & {
  cx: number;
  cy: number;
  r: number;
  z: number;
  height?: number;
  angleDeg?: number; // 指针角度
  valueText?: string;
}> = ({ projection, theme = 'dark', cx, cy, r, z, height = 10, angleDeg = 0, valueText }) => {
  const t = ISO_THEMES[theme];
  const bezel = cylinder(cx, cy, r, z, height, projection, 32);
  const topCenter = iso([cx, cy, z + height], projection);
  const knurlLines = knurl(cx, cy, r, z + height - 3, z + height, 48, projection);

  // 指针针尖与尾部
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const needleLength = r * 0.75;
  const tipPt = iso([cx + Math.cos(rad) * needleLength, cy + Math.sin(rad) * needleLength, z + height + 0.5], projection);
  const tailPt = iso([cx - Math.cos(rad) * (needleLength * 0.2), cy - Math.sin(rad) * (needleLength * 0.2), z + height + 0.5], projection);

  return (
    <g>
      <IsoSolid paths={bezel} tone="hi" theme={theme} />
      <path d={knurlLines} fill="none" stroke={t.strokeFaint} strokeWidth={0.5} />
      {/* 刻度环 */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const p0 = iso([cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), z + height + 0.2], projection);
        const p1 = iso([cx + Math.cos(a) * (r - 4.5), cy + Math.sin(a) * (r - 4.5), z + height + 0.2], projection);
        return <line key={i} x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke={i % 3 === 0 ? t.stroke : t.strokeFaint} strokeWidth={i % 3 === 0 ? 1 : 0.6} />;
      })}
      {/* 活动指针 */}
      <line x1={tailPt[0]} y1={tailPt[1]} x2={tipPt[0]} y2={tipPt[1]} stroke={t.strokeAccent} strokeWidth={1.2} strokeLinecap="round" />
      {/* 中心轴盖 */}
      <circle cx={topCenter[0]} cy={topCenter[1]} r={2.5 * projection.scale} fill={t.fillLit} stroke={t.stroke} strokeWidth={0.6} />
      {valueText && (
        <text
          x={topCenter[0]}
          y={topCenter[1] + 16 * projection.scale}
          textAnchor="middle"
          fill={t.text}
          fontSize={10 * projection.scale}
          fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        >
          {valueText}
        </text>
      )}
    </g>
  );
};

/** 悬浮 HUD 标签卡片 */
export const AnatomyCardHUD: React.FC<{
  figNum?: string;
  title: string;
  hint?: string;
  readout?: string;
  theme?: 'dark' | 'light';
}> = ({ figNum = 'Fig 1', title, hint = 'POINTER / KEYBOARD LIVE', readout = '0.00 kPa', theme = 'dark' }) => {
  const t = ISO_THEMES[theme];
  return (
    <div style={{
      position: 'absolute',
      inset: 24,
      pointerEvents: 'none',
      fontFamily: `'JetBrains Mono', 'Space Mono', monospace`,
      color: t.text,
    }}>
      {/* 顶部两角 */}
      <div style={{ position: 'absolute', top: 0, left: 0, fontSize: 13, letterSpacing: 2, color: t.stroke }}>
        {figNum}
      </div>
      <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
        {title}
      </div>
      {/* 底部两角 */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, fontSize: 11, letterSpacing: 1.5, color: t.stroke }}>
        {hint}
      </div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        fontSize: 16,
        fontWeight: 700,
        color: t.strokeAccent,
        background: theme === 'dark' ? 'rgba(34,37,41,0.7)' : 'rgba(226,232,240,0.8)',
        padding: '4px 12px',
        borderRadius: 4,
        border: `1px solid ${t.strokeFaint}`,
      }}>
        {readout}
      </div>
    </div>
  );
};
