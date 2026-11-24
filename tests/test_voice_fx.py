import sys
from pathlib import Path
import numpy as np
import pyloudnorm as pyln

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'template' / 'scripts'))
import voice_fx  # noqa: E402


def _make_speech_like_signal(sr=48000, sec=6.0):
    rng = np.random.default_rng(42)
    n = int(round(sr * sec))
    t = np.arange(n, dtype=np.float64) / sr
    carrier = (
        0.35 * np.sin(2 * np.pi * 160.0 * t)
        + 0.25 * np.sin(2 * np.pi * 480.0 * t)
        + 0.15 * np.sin(2 * np.pi * 1800.0 * t)
        + 0.08 * np.sin(2 * np.pi * 6500.0 * t)
        + 0.05 * rng.normal(0.0, 1.0, n)
    )
    env = np.zeros(n, dtype=np.float64)
    for start, end, amp in [(0.3, 1.4, 0.35), (1.7, 3.0, 0.65), (3.3, 4.7, 0.25), (4.9, 5.7, 0.85)]:
        ia, ib = int(start * sr), int(end * sr)
        win = np.hanning(ib - ia)
        env[ia:ib] = amp * (0.4 + 0.6 * win)
    x = carrier * env
    x[int(2.2 * sr)] += 1.4
    x[int(2.2 * sr) + 1] -= 1.2
    return x.astype(np.float32)


def test_voice_fx_lufs_true_peak_and_length():
    sr = 48000
    x = _make_speech_like_signal(sr=sr, sec=6.0)
    out, report = voice_fx.process(x, sr)

    assert len(out) == len(x)
    assert out.dtype == np.float32
    assert -18.5 <= report['lufs_out'] <= -17.5
    assert report['tp_out'] <= -1.0

    measured = float(pyln.Meter(sr).integrated_loudness(out.astype(np.float64)))
    assert abs(measured - report['lufs_out']) < 0.05
    assert -18.5 <= measured <= -17.5


def test_voice_fx_stereo_dual_mono_lufs():
    sr = 48000
    mono = _make_speech_like_signal(sr=sr, sec=6.0)
    st = np.stack([mono, mono], axis=1)
    out, report = voice_fx.process(st, sr)

    assert out.shape == st.shape
    assert out.dtype == np.float32
    assert -18.5 <= report['lufs_out'] <= -17.5
    assert report['tp_out'] <= -1.0

    measured = float(pyln.Meter(sr).integrated_loudness(out.astype(np.float64)))
    assert abs(measured - report['lufs_out']) < 0.05
    assert -18.5 <= measured <= -17.5


def test_voice_fx_silent_input_safe():
    sr = 48000
    x = np.zeros(sr * 2, dtype=np.float32)
    out, report = voice_fx.process(x, sr)
    assert len(out) == len(x)
    assert float(np.max(np.abs(out))) == 0.0
    assert report['lufs_in'] <= -70.0
    assert report['tp_out'] <= -1.0
