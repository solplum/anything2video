"""Post-processing chain for narration: HPF -> RMS comp -> de-esser -> -18 LUFS -> TP limiter."""
import numpy as np
import pyloudnorm as pyln
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, resample_poly, sosfiltfilt


def _envelope_follower_db(target_db, dt_s, attack_s, release_s, hop=1):
    """Smooth negative gain-reduction dB (<= 0) with asymmetric attack/release."""
    if hop > 1:
        n_blk = (len(target_db) + hop - 1) // hop
        pad = n_blk * hop - len(target_db)
        blk = np.pad(target_db, (0, pad), mode='edge').reshape(n_blk, hop).min(axis=1)
        dt = dt_s * hop
    else:
        blk = target_db
        dt = dt_s
    a_att = float(np.exp(-dt / max(attack_s, 1e-4)))
    a_rel = float(np.exp(-dt / max(release_s, 1e-4)))
    out = np.empty_like(blk, dtype=np.float64)
    cur = 0.0
    for i, tgt in enumerate(blk.tolist()):
        coeff = a_att if tgt < cur else a_rel
        cur = tgt + coeff * (cur - tgt)
        out[i] = cur
    if hop <= 1:
        return out
    xs = np.arange(len(blk), dtype=np.float64) * hop + 0.5 * hop
    return np.interp(np.arange(len(target_db), dtype=np.float64), xs, out)


def _rms_compressor(x, sr, thr_db=-20.0, ratio=2.5, attack_s=0.010, release_s=0.120):
    """Broadband RMS compressor with auto makeup on active speech."""
    win = max(1, int(round(0.010 * sr)))
    rms = np.sqrt(np.maximum(uniform_filter1d(x * x, size=win, mode='nearest'), 1e-18))
    lvl_db = 20.0 * np.log10(np.maximum(rms, 1e-9))
    over = np.maximum(0.0, lvl_db - thr_db)
    target_gr_db = -over * (1.0 - 1.0 / ratio)
    hop = max(1, int(round(0.001 * sr)))
    gr_db = _envelope_follower_db(target_gr_db, 1.0 / sr, attack_s, release_s, hop=hop)
    y = x * (10.0 ** (gr_db / 20.0))

    active = lvl_db > -45.0
    if np.any(active):
        in_rms = float(np.sqrt(np.mean(x[active] ** 2)))
        out_rms = float(np.sqrt(np.mean(y[active] ** 2)))
        if out_rms > 1e-9:
            makeup = float(np.clip(in_rms / out_rms, 0.5, 4.0))
            y = y * makeup
    return y


def _deesser(x, sr, low_hz=5000.0, high_hz=9000.0, max_atten_db=6.0):
    """Dynamic split-band sibilance attenuation in 5-9 kHz up to -6 dB."""
    nyq = 0.5 * sr
    hi = min(high_hz, nyq * 0.90)
    lo = min(low_hz, hi * 0.85)
    if lo <= 100.0 or hi <= lo:
        return x
    sos = butter(2, [lo, hi], btype='bandpass', fs=sr, output='sos')
    sib = sosfiltfilt(sos, x)

    win = max(1, int(round(0.005 * sr)))
    sib_rms = np.sqrt(np.maximum(uniform_filter1d(sib * sib, size=win, mode='nearest'), 1e-18))
    bb_rms = np.sqrt(np.maximum(uniform_filter1d(x * x, size=win, mode='nearest'), 1e-18))
    sib_db = 20.0 * np.log10(np.maximum(sib_rms, 1e-9))
    bb_db = 20.0 * np.log10(np.maximum(bb_rms, 1e-9))

    excess = np.maximum(0.0, np.minimum(sib_db - (-30.0), (sib_db - bb_db) - (-12.0)))
    target_gr_db = -np.minimum(max_atten_db, excess * 0.75)
    hop = max(1, int(round(0.0005 * sr)))
    gr_db = _envelope_follower_db(target_gr_db, 1.0 / sr, 0.002, 0.045, hop=hop)
    gain = 10.0 ** (gr_db / 20.0)
    return x - sib * (1.0 - gain)


def _true_peak_4x(x):
    """Return 4x oversampled peak amplitude (linear) and per-sample envelope across channels."""
    n = len(x)
    if x.ndim == 1:
        os_sig = resample_poly(x, 4, 1)
        n4 = n * 4
        if len(os_sig) < n4:
            os_sig = np.pad(os_sig, (0, n4 - len(os_sig)))
        per_sample = np.max(np.abs(os_sig[:n4].reshape(n, 4)), axis=1)
        return float(np.max(per_sample)), per_sample

    per_sample = np.zeros(n, dtype=np.float64)
    n4 = n * 4
    for ch in range(x.shape[1]):
        if ch > 0 and np.array_equal(x[:, ch], x[:, 0]):
            continue
        os_ch = resample_poly(x[:, ch], 4, 1)
        if len(os_ch) < n4:
            os_ch = np.pad(os_ch, (0, n4 - len(os_ch)))
        ch_ps = np.max(np.abs(os_ch[:n4].reshape(n, 4)), axis=1)
        per_sample = np.maximum(per_sample, ch_ps)
    return float(np.max(per_sample)), per_sample


def _lookahead_limiter(x, sr, ceiling_db=-1.5, lookahead_s=0.005, release_s=0.050):
    """Lookahead linked true-peak limiter keeping 4x oversampled true peak <= -1.0 dBTP."""
    ceiling = 10.0 ** (ceiling_db / 20.0)
    _, os_env = _true_peak_4x(x)
    la = max(1, int(round(lookahead_s * sr)))
    abs_base = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=1)
    peak_env = np.maximum(abs_base, os_env)
    ahead = maximum_filter1d(peak_env, size=2 * la + 1, mode='nearest')

    hop = max(1, int(round(0.0005 * sr)))
    n_blk = (len(ahead) + hop - 1) // hop
    pad = n_blk * hop - len(ahead)
    blk_max = np.pad(ahead, (0, pad), mode='edge').reshape(n_blk, hop).max(axis=1)
    a_rel = float(np.exp(-(hop / sr) / max(release_s, 1e-4)))
    rel_blk = np.empty_like(blk_max)
    cur = 0.0
    for i, val in enumerate(blk_max.tolist()):
        cur = val if val > cur else val + a_rel * (cur - val)
        rel_blk[i] = cur
    xs = np.arange(n_blk, dtype=np.float64) * hop + 0.5 * hop
    rel = np.interp(np.arange(len(ahead), dtype=np.float64), xs, rel_blk)

    smooth_env = uniform_filter1d(np.maximum(ahead, rel), size=max(1, la), mode='nearest')
    env = np.maximum(ahead, smooth_env)
    gain = np.minimum(1.0, ceiling / np.maximum(env, 1e-12))
    y = x * gain if x.ndim == 1 else x * gain[:, None]

    tp_lin, _ = _true_peak_4x(y)
    tp_max_lin = 10.0 ** (-1.05 / 20.0)
    if tp_lin > tp_max_lin:
        y = y * (tp_max_lin / tp_lin)
    return y


def _measure_lufs(x, sr):
    dur = len(x) / max(1, sr)
    block = 0.400 if dur >= 0.45 else max(0.05, dur * 0.8)
    meter = pyln.Meter(sr, block_size=block)
    return float(meter.integrated_loudness(x)), meter


def _process_channel_dsp(ch, sr):
    """Run mono speech conditioning chain (HPF + RMS comp + de-esser) without global LUFS norm."""
    if sr > 200:
        sos_hp = butter(2, 80.0, btype='highpass', fs=sr, output='sos')
        ch = sosfiltfilt(sos_hp, ch)
    ch = _rms_compressor(ch, sr, thr_db=-20.0, ratio=2.5, attack_s=0.010, release_s=0.120)
    return _deesser(ch, sr, low_hz=5000.0, high_hz=9000.0, max_atten_db=6.0)


def process(y, sr, target_lufs=-18.0, ceiling_db=-1.5):
    """Apply narration voice FX chain to 1D mono or 2D stereo/multichannel audio."""
    arr = np.asarray(y, dtype=np.float64)
    is_1d = arr.ndim == 1
    if is_1d:
        arr = arr.reshape(-1)
    elif arr.ndim != 2:
        raise ValueError(f'voice_fx expects 1D or 2D array, got shape {arr.shape}')

    if len(arr) < 16 or float(np.max(np.abs(arr))) < 1e-8:
        return arr.astype(np.float32), {'lufs_in': -120.0, 'lufs_out': -120.0, 'tp_out': -120.0}

    lufs_in, _ = _measure_lufs(arr, sr)

    if is_1d:
        x = _process_channel_dsp(arr, sr)
    elif arr.shape[1] == 2 and np.array_equal(arr[:, 0], arr[:, 1]):
        mono = _process_channel_dsp(arr[:, 0], sr)
        x = np.stack([mono, mono], axis=1)
    else:
        x = np.column_stack([_process_channel_dsp(arr[:, c], sr) for c in range(arr.shape[1])])

    lufs_fx, meter = _measure_lufs(x, sr)
    if np.isfinite(lufs_fx) and lufs_fx > -70.0:
        x = x * (10.0 ** ((target_lufs - lufs_fx) / 20.0))

    y_out = _lookahead_limiter(x, sr, ceiling_db=ceiling_db, lookahead_s=0.005, release_s=0.050)
    lufs_out = float(meter.integrated_loudness(y_out))
    if np.isfinite(lufs_out) and lufs_out < target_lufs - 0.2:
        boost = min(2.0, target_lufs - lufs_out)
        y_out = _lookahead_limiter(
            x * (10.0 ** (boost / 20.0)), sr, ceiling_db=ceiling_db, lookahead_s=0.005, release_s=0.050
        )
        lufs_out = float(meter.integrated_loudness(y_out))

    tp_lin, _ = _true_peak_4x(y_out)
    tp_out = float(20.0 * np.log10(max(tp_lin, 1e-12)))
    report = {
        'lufs_in': round(lufs_in, 2) if np.isfinite(lufs_in) else -120.0,
        'lufs_out': round(lufs_out, 2) if np.isfinite(lufs_out) else -120.0,
        'tp_out': round(tp_out, 2),
    }
    return y_out.astype(np.float32), report
