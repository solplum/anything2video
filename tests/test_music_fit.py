import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'template' / 'scripts'))
import beat_grid  # noqa: E402
import music_fit  # noqa: E402


def _make_bar_track(sr=48000, bar_s=2.0, bars=10):
    n = int(round(sr * bar_s * bars))
    t = np.arange(n, dtype=np.float64) / sr
    # Phase-continuous harmonic bed so beat-aligned cuts should stay smooth
    y = 0.25 * np.sin(2.0 * np.pi * 110.0 * t) + 0.12 * np.sin(2.0 * np.pi * 220.0 * t)
    downbeats = [b * bar_s for b in range(bars)]
    return np.stack([y, y], axis=1), downbeats


def test_fit_head_tail_splice_longer_track():
    sr = 48000
    track, downbeats = _make_bar_track(sr=sr, bar_s=2.0, bars=12)  # 24s
    total_samples = int(14.0 * sr)  # shorter video -> splice head + tail

    res = music_fit.fit(track, sr, total_samples, downbeats)
    assert res is not None
    audio, report = res
    assert audio.shape == (total_samples, 2)
    assert np.all(np.isfinite(audio))
    assert report['used'] is True
    assert report['mode'] == 'head_tail_splice'
    assert report['cut_a_s'] in downbeats
    assert report['cut_b_s'] in downbeats
    assert report['cut_a_s'] < report['cut_b_s']


def test_fit_bar_loop_tail_shorter_track():
    sr = 48000
    track, downbeats = _make_bar_track(sr=sr, bar_s=2.0, bars=10)  # 20s
    total_samples = int(38.0 * sr)  # longer video -> integer-bar loop + tail

    res = music_fit.fit(track, sr, total_samples, downbeats)
    assert res is not None
    audio, report = res
    assert audio.shape == (total_samples, 2)
    assert np.all(np.isfinite(audio))
    assert report['used'] is True
    assert report['mode'] == 'bar_loop_tail'
    assert report['loops'] >= 1


def test_fit_rejects_too_few_downbeats():
    sr = 48000
    track, downbeats = _make_bar_track(sr=sr, bar_s=2.0, bars=6)
    assert music_fit.fit(track, sr, int(8.0 * sr), downbeats) is None
    assert music_fit.fit(track, sr, int(8.0 * sr), []) is None


def test_fit_single_track_uses_beat_grid_and_guards_ambient():
    sr = 48000
    # Use beat_grid's own synthetic drum pattern (110 BPM, 16s = > 7 bars = >= 8 downbeats)
    rng = np.random.default_rng(7)
    n_drum = int(20.0 * beat_grid.RATE)
    # Build 20s beat_grid._synth_drums pattern by concatenating enough or synthesizing steady clicks
    period = 0.5  # 120 BPM -> 2.0s bars -> 10 bars in 20s
    t22 = np.arange(n_drum, dtype=np.float64) / beat_grid.RATE
    mono = np.zeros_like(t22)
    for b in np.arange(0.5, 19.8, period):
        i = int(round(b * beat_grid.RATE))
        klen = min(int(0.06 * beat_grid.RATE), len(mono) - i)
        if klen > 0:
            tt = np.arange(klen) / beat_grid.RATE
            mono[i:i + klen] += 0.9 * np.sin(2 * np.pi * 75 * tt) * np.exp(-tt * 35.0)
    # Resample to 48k stereo
    from scipy.signal import resample_poly
    import math
    g = math.gcd(beat_grid.RATE, sr)
    s48 = resample_poly(mono, sr // g, beat_grid.RATE // g)
    st = np.stack([s48, s48], axis=1)

    res = music_fit.fit_single_track(st, sr, int(12.0 * sr), fps=30)
    assert res is not None
    audio, report = res
    assert audio.shape == (int(12.0 * sr), 2)
    assert report['bpm_confidence'] >= beat_grid.CONF_MIN

    # Unreliable flat sine ambient track -> returns None gracefully
    t48 = np.arange(16 * sr, dtype=np.float64) / sr
    flat = np.stack([0.2 * np.sin(2 * np.pi * 220 * t48), 0.2 * np.sin(2 * np.pi * 220 * t48)], axis=1)
    assert music_fit.fit_single_track(flat, sr, int(12.0 * sr), fps=30) is None
    assert rng is not None
