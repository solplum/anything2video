import React from "react";
import { SolidPaths } from "./primitives";

export interface IsoTheme {
  bg: string;
  fillLo: string;
  fillMid: string;
  fillHi: string;
  fillLit: string;
  stroke: string;
  strokeFaint: string;
  strokeAccent: string;
  text: string;
}

export const ISO_THEMES: Record<"dark" | "light", IsoTheme> = {
  dark: {
    bg: "#0c0d0e",
    fillLo: "#16181a",
    fillMid: "#222529",
    fillHi: "#32373e",
    fillLit: "#ffffff",
    stroke: "#525964",
    strokeFaint: "#2d3239",
    strokeAccent: "#60a5fa",
    text: "#f1f5f9",
  },
  light: {
    bg: "#f8fafc",
    fillLo: "#f1f5f9",
    fillMid: "#e2e8f0",
    fillHi: "#cbd5e1",
    fillLit: "#0f172a",
    stroke: "#475569",
    strokeFaint: "#cbd5e1",
    strokeAccent: "#2563eb",
    text: "#0f172a",
  },
};

export const IsoSolid: React.FC<{
  paths: SolidPaths;
  tone?: "lo" | "mid" | "hi" | "lit";
  theme?: "dark" | "light";
  strokeWidth?: number;
  opacity?: number;
}> = ({ paths, tone = "mid", theme = "dark", strokeWidth = 0.8, opacity = 1 }) => {
  const t = ISO_THEMES[theme];
  const fill = tone === "lo" ? t.fillLo : tone === "hi" ? t.fillHi : tone === "lit" ? t.fillLit : t.fillMid;
  
  return (
    <g opacity={opacity}>
      {paths.top && <path d={paths.top} fill={fill} stroke="none" />}
      {paths.shades && paths.shades.map((d, i) => (
        d ? <path key={i} d={d} fill={t.strokeFaint} opacity={0.15 * (i + 1)} stroke="none" /> : null
      ))}
      {paths.crease && <path d={paths.crease} fill="none" stroke={t.strokeFaint} strokeWidth={strokeWidth * 0.75} />}
      {paths.outline && <path d={paths.outline} fill="none" stroke={t.stroke} strokeWidth={strokeWidth} />}
    </g>
  );
};

export const IsoLine: React.FC<{
  d: string;
  tone?: "faint" | "mid" | "hi" | "accent";
  theme?: "dark" | "light";
  strokeWidth?: number;
  dashed?: boolean;
}> = ({ d, tone = "mid", theme = "dark", strokeWidth = 0.8, dashed = false }) => {
  const t = ISO_THEMES[theme];
  const stroke = tone === "faint" ? t.strokeFaint : tone === "hi" ? t.stroke : tone === "accent" ? t.strokeAccent : t.stroke;
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={dashed ? "3 3" : undefined}
    />
  );
};

export const IsoMachine: React.FC<{
  width: number;
  height: number;
  theme?: "dark" | "light";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ width, height, theme = "dark", children, className, style }) => {
  const t = ISO_THEMES[theme];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      style={{
        backgroundColor: t.bg,
        shapeRendering: "geometricPrecision",
        ...style,
      }}
    >
      {children}
    </svg>
  );
};
