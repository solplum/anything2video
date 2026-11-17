#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11,<3.15"
# dependencies = ["numpy>=2.2", "pillow>=11", "scipy>=1.15"]
# ///
"""Objective composition, contrast, and subtitle-band pierce diagnostics for rendered frames or MP4s.

Scope note: Computes measurable pixel signals (bottom-band WCAG contrast, saliency balance,
and structural strokes piercing the subtitle zone). Never certifies subjective artistic merit.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    """Compute WCAG 2.x relative luminance from uint8/float RGB [0..255] array."""
    srgb = np.clip(rgb.astype(np.float64) / 255.0, 0.0, 1.0)
    lin = np.where(srgb <= 0.03928, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def analyze_frame_array(rgb: np.ndarray, *, min_contrast: float = 4.5) -> dict[str, Any]:
    """Analyze one HxWx3 RGB uint8 frame for contrast, visual balance, and subtitle-band piercing."""
    if rgb.ndim != 3 or rgb.shape[2] < 3:
        raise ValueError(f'Expected HxWx3 RGB image, got shape {rgb.shape}')
    rgb = rgb[..., :3]
    h, w, _ = rgb.shape
    lum = relative_luminance(rgb)
    gray = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    issues: list[dict[str, Any]] = []

    # 1. Bottom-band contrast check (y in 84%..99%, x in 10%..90%)
    y0, y1 = int(round(0.84 * h)), int(round(0.99 * h))
    x0, x1 = int(round(0.10 * w)), int(round(0.90 * w))
    band_lum = lum[y0:y1, x0:x1]
    band_max = ndi.maximum_filter(band_lum, size=17)
    band_min = ndi.minimum_filter(band_lum, size=17)
    band_range = band_max - band_min
    ratio_map = (band_max + 0.05) / (band_min + 0.05)
    # Ignore imperceptible surface paper/vignette grain (<1.30:1) so textured paper backdrops do not mask crisp scrims.
    active_mask = (band_range > 0.04) & (ratio_map >= 1.30)
    active_ratio = float(active_mask.mean()) if band_lum.size else 0.0
    contrast_median: float | None = None
    if active_ratio >= 0.003:
        local_contrast = ratio_map[active_mask]
        contrast_median = float(np.median(local_contrast))
        if contrast_median < min_contrast:
            issues.append({
                'code': 'low_contrast_band',
                'detail': f'Bottom band median local WCAG contrast {contrast_median:.2f} < {min_contrast:.2f}',
                'measured': round(contrast_median, 3),
            })

    # 2. Visual balance & deadzone check (content zone y in 4%..85%)
    cy0, cy1 = int(round(0.04 * h)), int(round(0.85 * h))
    content_gray = gray[cy0:cy1, :]
    dx = np.abs(np.diff(content_gray, axis=1, prepend=content_gray[:, :1]))
    dy = np.abs(np.diff(content_gray, axis=0, prepend=content_gray[:1, :]))
    edge = np.maximum(0.0, (dx + dy) - 6.0)
    total_edge = float(edge.sum())
    cx_norm = 0.5
    cy_norm = 0.5
    top_share = 0.5
    bottom_share = 0.0
    if total_edge < max(1.0, content_gray.size * 0.02):
        issues.append({
            'code': 'empty_or_low_signal',
            'detail': 'Content area has negligible visual contrast or structure',
        })
    else:
        ys = np.arange(content_gray.shape[0], dtype=np.float64)[:, None]
        xs = np.arange(content_gray.shape[1], dtype=np.float64)[None, :]
        cx_norm = float((edge * xs).sum() / total_edge / max(1, content_gray.shape[1] - 1))
        cy_norm = float((edge * ys).sum() / total_edge / max(1, content_gray.shape[0] - 1))
        top_cut = int(round(0.45 * content_gray.shape[0]))
        bot_cut = int(round(0.55 * content_gray.shape[0]))
        top_share = float(edge[:top_cut].sum() / total_edge)
        bottom_share = float(edge[bot_cut:].sum() / total_edge)
        if top_share < 0.03 and bottom_share > 0.78:
            issues.append({
                'code': 'severe_top_deadzone',
                'detail': f'Top 45% carries only {top_share*100:.1f}% saliency while lower band holds {bottom_share*100:.1f}%',
                'top_share': round(top_share, 4),
                'bottom_share': round(bottom_share, 4),
            })
        if cx_norm < 0.22 or cx_norm > 0.78:
            issues.append({
                'code': 'extreme_offcenter',
                'detail': f'Horizontal visual center {cx_norm:.3f} outside [0.22, 0.78]',
                'cx_norm': round(cx_norm, 4),
            })

    # 3. Structural strokes piercing from content zone (y<80%) straight across subtitle band (y>93%)
    py0, py1 = int(round(0.76 * h)), int(round(0.96 * h))
    px0, px1 = int(round(0.08 * w)), int(round(0.92 * w))
    zone = gray[py0:py1, px0:px1]
    row_med = np.median(zone, axis=1, keepdims=True)
    z_dx = np.abs(np.diff(zone, axis=1, prepend=zone[:, :1]))
    stroke_mask = (np.abs(zone - row_med) > 18.0) | (z_dx > 18.0)
    lab, n_comp = ndi.label(stroke_mask, structure=np.ones((3, 3), dtype=bool))
    top_rel = int(round(0.04 * h))     # ~80% absolute H
    bot_rel = int(round(0.17 * h))     # ~93% absolute H
    piercers = 0
    if n_comp > 0:
        for sl in ndi.find_objects(lab):
            if sl is None:
                continue
            comp_w = sl[1].stop - sl[1].start
            if sl[0].start <= top_rel and sl[0].stop >= bot_rel and comp_w < 0.18 * w:
                piercers += 1
    if piercers > 0:
        issues.append({
            'code': 'subtitle_band_pierce',
            'detail': f'{piercers} structural stroke(s) cut across content boundary through subtitle band',
            'count': piercers,
        })

    return {
        'dimensions': [int(w), int(h)],
        'bottom_band_active_ratio': round(active_ratio, 4),
        'bottom_band_contrast': round(contrast_median, 3) if contrast_median is not None else None,
        'saliency_center': [round(cx_norm, 4), round(cy_norm, 4)],
        'top_45_saliency_share': round(top_share, 4),
        'subtitle_piercers': piercers,
        'issues': issues,
    }


def _probe_video_meta(video: Path) -> float:
    out = subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(video)],
        text=True,
    ).strip()
    dur = float(out)
    if not math.isfinite(dur) or dur <= 0:
        raise ValueError(f'Invalid video duration: {out}')
    return dur


def probe_frames_dir(frames_dir: Path, *, min_contrast: float = 4.5) -> dict[str, Any]:
    files = sorted(p for p in frames_dir.iterdir() if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp'))
    if not files:
        raise ValueError(f'No image frames found in {frames_dir}')
    frames = []
    for p in files:
        arr = np.asarray(Image.open(p).convert('RGB'))
        res = analyze_frame_array(arr, min_contrast=min_contrast)
        res['file'] = p.name
        frames.append(res)
    return _summarize(str(frames_dir), frames)


def probe_video(video: Path, *, sample_rate: float = 1.0, min_contrast: float = 4.5) -> dict[str, Any]:
    dur = _probe_video_meta(video)
    sample_rate = max(0.1, float(sample_rate))
    times = [round(t, 3) for t in np.arange(0.25, dur, sample_rate)] or [min(0.25, dur * 0.5)]
    frames = []
    with tempfile.TemporaryDirectory(prefix='a2v-aes-') as tmp:
        tmp_dir = Path(tmp)
        for idx, t in enumerate(times):
            img_path = tmp_dir / f'f_{idx:04d}.png'
            subprocess.run(
                ['ffmpeg', '-v', 'error', '-nostdin', '-y', '-ss', str(t), '-i', str(video), '-frames:v', '1', str(img_path)],
                check=True,
            )
            arr = np.asarray(Image.open(img_path).convert('RGB'))
            res = analyze_frame_array(arr, min_contrast=min_contrast)
            res['time_s'] = t
            frames.append(res)
    return _summarize(str(video), frames)


def _summarize(source: str, frames: list[dict[str, Any]]) -> dict[str, Any]:
    all_issues = [
        {'frame': f.get('file') or f"t={f.get('time_s')}s", **iss}
        for f in frames
        for iss in f['issues']
    ]
    return {
        'schemaVersion': 1,
        'source': source,
        'framesChecked': len(frames),
        'status': 'failed' if all_issues else 'needs_review',
        'issueCount': len(all_issues),
        'issues': all_issues,
        'frames': frames,
        'note': 'Objective pixel/contrast/balance diagnostics only. Review actual frames and playback separately.',
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--video', help='Path to MP4/video file')
    src.add_argument('--frames', help='Directory of extracted frame images')
    ap.add_argument('--sample-rate', type=float, default=1.0, help='Sample interval in seconds for --video')
    ap.add_argument('--min-contrast', type=float, default=4.5, help='Minimum bottom-band WCAG contrast ratio')
    ap.add_argument('--json', action='store_true', help='Print machine-readable JSON')
    args = ap.parse_args(argv)

    try:
        report = (
            probe_video(Path(args.video), sample_rate=args.sample_rate, min_contrast=args.min_contrast)
            if args.video
            else probe_frames_dir(Path(args.frames), min_contrast=args.min_contrast)
        )
    except Exception as exc:
        print(json.dumps({'status': 'failed', 'error': str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"probe_aesthetics: checked {report['framesChecked']} frame(s), status={report['status']}, issues={report['issueCount']}")
        for iss in report['issues']:
            print(f"  - [{iss['frame']}] {iss['code']}: {iss['detail']}")
    return 1 if report['status'] == 'failed' else 0


if __name__ == '__main__':
    sys.exit(main())
