"""Bar-aligned single-track BGM fitting using beat_grid downbeats."""
import math
import numpy as np
from scipy.signal import resample_poly
import beat_grid

MIN_DOWNBEATS = 8


def _stitch_segments(track, segments, xf):
    """Concatenate [(start, end), ...] from track with xf-sample equal-power crossfades."""
    if not segments:
        return np.zeros((0, *track.shape[1:]), dtype=np.float64)
    theta = np.linspace(0.0, 0.5 * math.pi, xf, dtype=np.float64)
    fade_out = np.cos(theta)
    fade_in = np.sin(theta)
    if track.ndim == 2:
        fade_out = fade_out[:, None]
        fade_in = fade_in[:, None]

    parts = []
    s0, e0 = segments[0]
    parts.append(track[s0:e0])
    for idx in range(1, len(segments)):
        _, prev_e = segments[idx - 1]
        cur_s, cur_e = segments[idx]
        blend = track[prev_e:prev_e + xf] * fade_out + track[cur_s:cur_s + xf] * fade_in
        parts.append(blend)
        body_start = cur_s + xf
        if cur_e > body_start:
            parts.append(track[body_start:cur_e])
    return np.concatenate(parts, axis=0)


def _pad_or_trim_tail(audio, total_samples, sr):
    """Pad silence after natural outro or smoothly fade any tiny overshoot trim."""
    n = len(audio)
    if n == total_samples:
        return audio
    if n < total_samples:
        pad_shape = (total_samples - n, *audio.shape[1:])
        return np.concatenate([audio, np.zeros(pad_shape, dtype=np.float64)], axis=0)
    out = audio[:total_samples].copy()
    fo = min(int(round(0.15 * sr)), len(out) // 4)
    if fo > 1:
        w = 0.5 + 0.5 * np.cos(np.linspace(0.0, math.pi, fo, dtype=np.float64))
        out[-fo:] *= w[:, None] if out.ndim == 2 else w
    return out


def fit(track, sr, total_samples, downbeats_s):
    """Align single-track BGM to total_samples on bar downbeats. Returns (audio, report) or None."""
    src = np.asarray(track, dtype=np.float64)
    total_samples = int(total_samples)
    if len(src) == 0 or total_samples <= 0 or not downbeats_s or len(downbeats_s) < MIN_DOWNBEATS:
        return None

    track_dur_s = len(src) / sr
    dbs = sorted({float(t) for t in downbeats_s if 0.0 <= float(t) <= track_dur_s})
    if len(dbs) < MIN_DOWNBEATS:
        return None

    diffs = np.diff(dbs)
    valid_diffs = diffs[diffs > 0.2]
    if len(valid_diffs) == 0:
        return None
    bar_dur_s = float(np.median(valid_diffs))
    if bar_dur_s <= 0.2:
        return None

    beat_dur_s = bar_dur_s / 4.0
    xf = max(16, int(round(beat_dur_s * sr)))
    db_idx = [int(round(t * sr)) for t in dbs if int(round(t * sr)) + xf <= len(src)]
    if len(db_idx) < 4:
        return None

    L = len(src)
    # Case 1: Track is at least as long as video -> head + tail downbeat splice
    if L >= total_samples:
        best_fit = None
        best_over = None
        for ia in range(1, len(db_idx) - 1):
            a_idx = db_idx[ia]
            if a_idx < xf:
                continue
            for ib in range(ia + 1, len(db_idx)):
                b_idx = db_idx[ib]
                tail_len = L - b_idx
                if tail_len < xf:
                    continue
                spliced_len = a_idx + tail_len
                gap = total_samples - spliced_len
                tail_ratio = tail_len / max(1, total_samples)
                tie = abs(tail_ratio - 0.35)
                if gap >= 0:
                    key = (gap, tie)
                    if best_fit is None or key < best_fit[0]:
                        best_fit = (key, ia, ib, spliced_len)
                else:
                    key = (-gap, tie)
                    if best_over is None or key < best_over[0]:
                        best_over = (key, ia, ib, spliced_len)

        pick = best_fit or best_over
        if pick is None:
            return None
        _, ia, ib, spliced_len = pick
        a_idx, b_idx = db_idx[ia], db_idx[ib]
        spliced = _stitch_segments(src, [(0, a_idx), (b_idx, L)], xf)
        audio = _pad_or_trim_tail(spliced, total_samples, sr)
        return audio, {
            'used': True,
            'mode': 'head_tail_splice',
            'bars': len(dbs),
            'bpm_approx': round(240.0 / bar_dur_s, 1),
            'cut_a_s': round(a_idx / sr, 3),
            'cut_b_s': round(b_idx / sr, 3),
            'xfade_s': round(xf / sr, 3),
            'natural_end_s': round(spliced_len / sr, 3),
        }

    # Case 2: Track shorter than video -> integer-bar loop + natural tail
    i_start = 1 if len(db_idx) >= 5 else 0
    i_end = len(db_idx) - 2 if len(db_idx) - 2 > i_start else len(db_idx) - 1
    loop_s = db_idx[i_start]
    loop_e = db_idx[i_end]
    tail_len = L - loop_e
    if loop_e <= loop_s or tail_len < xf:
        return None

    budget = max(total_samples - tail_len, loop_e)
    segments = [(0, loop_e)]
    acc = loop_e
    loops = 0
    loop_span = loop_e - loop_s
    while acc + loop_span <= budget:
        segments.append((loop_s, loop_e))
        acc += loop_span
        loops += 1

    # Add up to one partial integer-bar span inside [i_start..i_end) if it fits within budget
    rem = budget - acc
    best_j = None
    for j in range(i_start + 1, i_end):
        span = db_idx[j] - loop_s
        if span >= xf and span <= rem:
            best_j = j
    if best_j is not None:
        segments.append((loop_s, db_idx[best_j]))
        acc += db_idx[best_j] - loop_s

    segments.append((loop_e, L))
    stitched = _stitch_segments(src, segments, xf)
    audio = _pad_or_trim_tail(stitched, total_samples, sr)
    return audio, {
        'used': True,
        'mode': 'bar_loop_tail',
        'bars': len(dbs),
        'bpm_approx': round(240.0 / bar_dur_s, 1),
        'loop_start_s': round(loop_s / sr, 3),
        'loop_end_s': round(loop_e / sr, 3),
        'loops': loops,
        'xfade_s': round(xf / sr, 3),
        'natural_end_s': round(len(stitched) / sr, 3),
    }


def _to_beat_grid_rate(track, sr):
    mono = np.mean(track, axis=1) if track.ndim == 2 else track
    sr_i = int(round(sr))
    if sr_i == beat_grid.RATE:
        return mono
    g = math.gcd(sr_i, beat_grid.RATE)
    return resample_poly(mono, beat_grid.RATE // g, sr_i // g)


def fit_single_track(track, sr, total_samples, fps=30):
    """Run beat_grid on track; return (fitted_audio, report) if reliable & >= 8 downbeats, else None."""
    try:
        mono_22k = _to_beat_grid_rate(np.asarray(track, dtype=np.float64), sr)
        grid = beat_grid.analyze(mono_22k, int(fps))
    except SystemExit:
        return None
    if grid.get('bpm_confidence', 0.0) < beat_grid.CONF_MIN:
        return None
    res = fit(track, sr, total_samples, grid.get('downbeats_s') or [])
    if res is None:
        return None
    audio, report = res
    report['bpm'] = grid.get('bpm')
    report['bpm_confidence'] = grid.get('bpm_confidence')
    return audio, report
