#!/usr/bin/env python3
"""BGM 拍点网格：实测 BPM、拍点与重拍（4/4 假设）秒表/帧表，供分镜卡点（motion-language.md §6）。

手法自研（通用 DSP：频谱通量 onset 包络 + 自相关测速 + 相位扫描对格），只依赖 ffmpeg 解码与 numpy。
v4.3.0 硬化（方法论吸收 mexicat/pdoom-video analysis/analyze.py，MIT）：
  - kick 攻击相位精修：<120Hz 带内瞬态与拍点残差取中位数修正相位，残差 n/median/sd 记档；
  - 鼓件三分类：kick(<120Hz) / snare(1.5-5k 攻击 + 40-120ms 噪声尾验证抗串音) / hat(>7k，减 kick/snare 邻近项)，
    各带强度 0.2..1.0（5/95 百分位归一）——命中表是候选池不是触发器（music-beat-sync §2）；
  - 小节相位证据：snare 落 8 分位直方图（4/4 应聚在 2&6 位），比例 ≥0.4 时以 snare 证据定 downbeat、
    并列双小节歧义按重拍 kick 强度裁决；证据不足回退 onset 能量法并记 source。
流程位置：阶段 2 选定 BGM 后、阶段 3 分镜前由主脚本跑；程序编曲（score_gen）BPM 已知直接引用，静音片跳过。

用法（项目根跑）：
  python scripts/beat_grid.py public/assets/<slug>/bgm.wav --out script/beat_grid.json [--fps 30]
产出 JSON：bpm / bpm_confidence / reliable（conf<CONF_MIN=false，此曲无清晰拍点勿卡拍）/ beat_interval_s /
first_beat_s / beats_s / downbeats_s（含帧表）/ onsets（kick/snare/hat，[秒,强度] 与帧表两套）/
kick_phase_refine / bar_phase（offset / snare_2and4_ratio / source / snare_positions / note）。
诚实口径：BPM 由自相关估计（置信度=峰均值比）；4/4 假设的 downbeat 优先采信 snare 位置证据、
证据不足时退回 onset 能量法（meter_assumption 仍是假设，非 4/4 曲目重拍行仅供参考）。
自测：python scripts/beat_grid.py --selftest   # 合成点击轨 + 结构化鼓型，断言测速/对格/小节相位
"""
import argparse, json, math, subprocess, sys
import numpy as np
from pathlib import Path

RATE = 22050
N_FFT = 1024
HOP = 256
BPM_MIN, BPM_MAX = 60.0, 180.0
CONF_MIN = 3.0  # 置信度门槛：低于此值视为无清晰拍点（自测合成轨 ≈2.4、真实乐句 ≈8.6，门槛设在两者之间偏下）


def samples(path: Path) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(RATE),
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0


def onset_envelope(x: np.ndarray) -> np.ndarray:
    """频谱通量（半波整流的幅度谱增量），再做 3 帧滑动平均。"""
    n = (len(x) - N_FFT) // HOP + 1
    if n < 8:
        raise SystemExit('音频太短，无法分析（<0.2s）')
    win = np.hanning(N_FFT)
    frames = np.lib.stride_tricks.as_strided(
        x, shape=(n, N_FFT), strides=(x.strides[0] * HOP, x.strides[0])).copy()
    mag = np.abs(np.fft.rfft(frames * win, axis=1))
    flux = np.maximum(0.0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0.0], flux])
    if flux.max() > 0:
        flux /= flux.max()
    kernel = np.ones(3) / 3.0
    return np.convolve(flux, kernel, mode='same')


def pick_peaks(env: np.ndarray, hop_s: float, min_gap_s=0.12, delta=0.08) -> np.ndarray:
    """自适应阈值取峰：局部均值 + delta，峰间距下限防抖。"""
    half = max(1, int(round(0.35 / hop_s)))
    peaks = []
    for i in range(1, len(env) - 1):
        if env[i] < env[i - 1] or env[i] < env[i + 1]:
            continue
        lo, hi = max(0, i - half), min(len(env), i + half + 1)
        if env[i] >= env[lo:hi].mean() + delta * (env.max() if env.max() > 0 else 1.0):
            if peaks and (i - peaks[-1]) * hop_s < min_gap_s:
                if env[i] > env[peaks[-1]]:
                    peaks[-1] = i
                continue
            peaks.append(i)
    return np.array(peaks, dtype=int)


def estimate_bpm(env: np.ndarray, hop_s: float):
    """自相关测速：60–180 BPM 拉格窗内取最大峰；置信度=峰/均值。"""
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lag_lo = int(round(60.0 / BPM_MAX / hop_s))
    lag_hi = min(len(ac) - 1, int(round(60.0 / BPM_MIN / hop_s)))
    if lag_hi <= lag_lo + 2:
        return None, 0.0
    seg = ac[lag_lo:lag_hi + 1]
    k = int(np.argmax(seg)) + lag_lo
    # 二分精化：抛物线插值峰位
    if 0 < k - lag_lo < len(seg) - 1:
        y0, y1, y2 = seg[k - lag_lo - 1], seg[k - lag_lo], seg[k - lag_lo + 1]
        denom = (y0 - 2 * y1 + y2)
        shift = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-12 else 0.0
        k = k + shift
    bpm = 60.0 / (k * hop_s)
    conf = float(seg.max() / max(seg.mean(), 1e-9))
    return bpm, conf


def beat_phase(env: np.ndarray, hop_s: float, period_s: float) -> float:
    """相位扫描：在 [0, period) 内找与 onset 包络对齐最好的第一个拍点。"""
    n_phase = max(8, int(round(period_s / hop_s)))
    best, best_score = 0.0, -1.0
    for p in range(n_phase):
        t0 = p * hop_s
        idx = np.arange(t0, len(env) * hop_s, period_s) / hop_s
        idx = idx[idx < len(env)].astype(int)
        if len(idx) == 0:
            continue
        score = float(env[idx].mean())
        if score > best_score:
            best_score, best = score, t0
    return best


def downbeat_offset(beats_s: np.ndarray, env: np.ndarray, meter=4):
    """4/4 回退法：在 meter 个候选小节头对齐里选 onset 能量总和最大的一路。"""
    if len(beats_s) < meter:
        return 0
    hop_s = HOP / RATE
    best, best_score = 0, -1.0
    for off in range(meter):
        idx = ((beats_s[off::meter]) / hop_s).astype(int)
        idx = idx[idx < len(env)]
        score = float(env[idx].mean()) if len(idx) else -1.0
        if score > best_score:
            best_score, best = score, off
    return best


# ---------------------------------------------------------------------------
# 鼓件分类与相位证据（v4.3.0，方法论吸收 mexicat/pdoom-video analysis/analyze.py，MIT）
# ---------------------------------------------------------------------------

def band_signal(x: np.ndarray, lo=None, hi=None, soft_hz=150.0) -> np.ndarray:
    """FFT 带通（升余弦过渡带 soft_hz，零相位）；lo/hi 任一为 None 即开口端。纯 numpy。"""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / RATE)
    gain = np.ones_like(f)
    if lo is not None:
        t = np.clip((f - lo) / soft_hz, 0.0, 1.0)
        gain = gain * (0.5 - 0.5 * np.cos(np.pi * t))
    if hi is not None:
        t = np.clip((f - (hi - soft_hz)) / soft_hz, 0.0, 1.0)
        gain = gain * (0.5 + 0.5 * np.cos(np.pi * t))
    return np.fft.irfft(spec * gain, n=len(x))


def _env_db(xb: np.ndarray, win_s=0.010, hop_s=0.002):
    """带内能量 dB 短时包络（滑动 RMS 盒窗）。返回 (db, 帧率)。"""
    w = max(4, int(win_s * RATE))
    h = max(1, int(hop_s * RATE))
    e = np.convolve(xb.astype(np.float64) ** 2, np.ones(w) / w, mode='same')[::h]
    return 10.0 * np.log10(e + 1e-12), RATE / h


def transients(x: np.ndarray, lo, hi, min_gap_s=0.08, rel_db=10.0):
    """带内瞬态：dB 包络相对 20ms 前的增量取峰，强度=包络超出 1s 滑动均值的 dB。
    min_gap 内并峰保留最强。返回 (times_s, strength_db)。"""
    db, fps = _env_db(band_signal(x, lo, hi))
    lag = int(0.02 * fps)
    rise = db - np.concatenate([np.full(lag, db[0]), db[:-lag]])
    fl = int(1.0 * fps) | 1
    floor = np.convolve(db, np.ones(fl) / fl, mode='same')
    idx = []
    for i in range(1, len(rise) - 1):
        if rise[i] >= rel_db and rise[i] >= rise[i - 1] and rise[i] > rise[i + 1] and db[i] > floor[i] + 3.0:
            idx.append(i)
    merged = []
    for i in idx:
        if merged and (i - merged[-1]) / fps < min_gap_s:
            if rise[i] > rise[merged[-1]]:
                merged[-1] = i
            continue
        merged.append(i)
    times = np.array(merged, dtype=float) / fps
    strength = np.array([db[i] - floor[i] for i in merged], dtype=float)
    return times, strength


def strength01(db_vals: np.ndarray, lo_pct=5.0, hi_pct=95.0) -> np.ndarray:
    """dB 强度归一到 0.2..1.0（5/95 百分位拉伸），空表原样返回。"""
    if len(db_vals) == 0:
        return np.zeros(0)
    lo, hi = np.percentile(db_vals, lo_pct), np.percentile(db_vals, hi_pct)
    return np.clip((db_vals - lo) / max(hi - lo, 1e-9) * 0.8 + 0.2, 0.0, 1.0)


def classify_drums(x: np.ndarray) -> dict:
    """kick/snare/hat 三分类：<120Hz 攻击 / 1.5-5k 攻击+噪声尾验证 / >7k 减 kick·snare 邻近项。
    尾部验证（pdoom 判据）：snare 攻击后 40-120ms 的 0.5-5k 噪声尾须在全局 95 分位 −25dB 内、
    且与 ±2.5s 局部最响尾差 <8dB——kick-only 拍与乐器串音的尾低 12-30dB，被拒。
    返回 {'kick': [[t,s]...], 'snare': ..., 'hat': ...}，s∈0.2..1.0。"""
    kt, kdb = transients(x, None, 120.0, min_gap_s=0.15, rel_db=12.0)
    st_raw, sdb_raw = transients(x, 1500.0, 5000.0, min_gap_s=0.15, rel_db=10.0)
    keep = np.ones(len(st_raw), dtype=bool)
    if len(st_raw):
        mid_db, _ = _env_db(band_signal(x, 500.0, 5000.0))
        n_mid = len(mid_db)
        tail = np.array([mid_db[min(n_mid - 1, int((t + 0.04) / 0.002)):
                                min(n_mid, int((t + 0.12) / 0.002))].mean()
                         if min(n_mid, int((t + 0.12) / 0.002)) > min(n_mid - 1, int((t + 0.04) / 0.002))
                         else -90.0 for t in st_raw])
        thr = float(np.percentile(tail, 95)) - 25.0
        for i in range(len(st_raw)):
            local = tail[np.abs(st_raw - st_raw[i]) < 2.5].max()
            if tail[i] < thr or tail[i] < local - 8.0:
                keep[i] = False
    st, sdb = st_raw[keep], sdb_raw[keep]
    ht, hdb = transients(x, 7000.0, None, min_gap_s=0.06, rel_db=9.0)
    if len(ht):
        dist_s = np.min(np.abs(ht[:, None] - st[None, :]), axis=1) if len(st) else np.full(len(ht), 9.9)
        dist_k = np.min(np.abs(ht[:, None] - kt[None, :]), axis=1) if len(kt) else np.full(len(ht), 9.9)
        ok = (dist_s > 0.04) & (dist_k > 0.03)  # snare 噪声与 kick 击锤 click 都会窜进 >7k
        ht, hdb = ht[ok], hdb[ok]
    def pairs(ts, s):
        v = strength01(s)
        return [[round(float(t), 3), round(float(vv), 2)] for t, vv in zip(ts, v)]
    return {'kick': pairs(kt, kdb), 'snare': pairs(st, sdb), 'hat': pairs(ht, hdb)}


def refine_phase_on_kicks(beats_s: np.ndarray, onsets_kick: list, window_s=0.06):
    """kick 攻击相位精修（pdoom fit_grid 思路）：每拍取 ±window 内最近 kick，残差中位数修正相位。
    返回 (shift_s, 证据 dict)；kick 少于 4 个不动。"""
    if len(beats_s) < 4 or len(onsets_kick) < 4:
        return 0.0, {'n': 0}
    ks = np.array([t for t, _ in onsets_kick])
    res = []
    for b in beats_s:
        d = ks[int(np.argmin(np.abs(ks - b)))] - b
        if abs(d) <= window_s:
            res.append(d)
    if len(res) < 4:
        return 0.0, {'n': len(res)}
    m = float(np.median(res))
    kept = [d for d in res if abs(d - m) <= 0.03]
    return m, {'n': len(kept), 'median_ms': round(m * 1000.0, 1),
               'sd_ms': round(float(np.std(kept)) * 1000.0, 1)}


def snare_positions(first_beat_s: float, period: float, onsets_snare: list):
    """snare 落 8 分位直方图（相对候选小节头）；4/4 乐句 snare 在 2&4 拍 → 位置 {2,6}。"""
    if len(onsets_snare) == 0:
        return None
    ts = np.array([t for t, _ in onsets_snare])
    pos = np.round((ts - first_beat_s) / (period / 2.0)).astype(int) % 8
    return np.bincount(pos, minlength=8).tolist()


def downbeat_by_snare(beats_s: np.ndarray, period: float, onsets_snare: list, onsets_kick: list):
    """小节相位裁决：snare-on-2&4 比例 ≥0.4 时以 snare 证据定 offset；
    ±0.15 内并列（双小节歧义）按重拍 kick 强度均值裁决；证据不足返回 (0, score, source, hist) 交回退。"""
    if len(onsets_snare) < 6:
        return 0, 0.0, 'no-snares', None
    scores = []
    for off in range(4):
        h = snare_positions(float(beats_s[off]), period, onsets_snare)
        scores.append((h[2] + h[6]) / max(1, sum(h)))
    best = max(scores)
    if best < 0.4:
        return 0, best, 'weak-snare-evidence', snare_positions(float(beats_s[0]), period, onsets_snare)
    tied = [o for o in range(4) if scores[o] >= best - 0.15]
    if len(tied) == 1:
        off = tied[0]
    else:
        ks = np.array([t for t, _ in onsets_kick]) if len(onsets_kick) else np.zeros(0)
        ss = np.array([s for _, s in onsets_kick]) if len(onsets_kick) else np.zeros(0)
        def accent(o):
            if len(ks) == 0:
                return 0.0
            vals = []
            for b in beats_s[o::4]:
                i = int(np.argmin(np.abs(ks - b)))
                if abs(ks[i] - b) <= 0.08:
                    vals.append(ss[i])
            return float(np.mean(vals)) if vals else 0.0
        off = max(tied, key=accent)
    return off, scores[off], 'snare-2and4', snare_positions(float(beats_s[off]), period, onsets_snare)


def analyze(x: np.ndarray, fps: int) -> dict:
    hop_s = HOP / RATE
    env = onset_envelope(x)
    duration = len(x) / RATE
    bpm, conf = estimate_bpm(env, hop_s)
    if bpm is None:
        raise SystemExit('拍点估计失败：曲目节奏成分不足（60–180 BPM 窗内无自相关峰）')
    period = 60.0 / bpm
    first = beat_phase(env, hop_s, period)
    beats_s = np.arange(first, duration, period)
    onsets = classify_drums(x)
    shift, refine = refine_phase_on_kicks(beats_s, onsets['kick'])
    if shift != 0.0:
        first = first + shift
        beats_s = np.arange(first, duration, period)
    off, snare_score, bar_source, hist = downbeat_by_snare(beats_s, period, onsets['snare'], onsets['kick'])
    if bar_source in ('no-snares', 'weak-snare-evidence'):
        off = downbeat_offset(beats_s, env)
    downbeats_s = beats_s[off::4]
    pairs_frame = lambda seq: [[int(round(t * fps)), s] for t, s in seq]
    return {
        'duration_s': round(duration, 3),
        'bpm': round(float(bpm), 2),
        'bpm_confidence': round(conf, 2),
        'beat_interval_s': round(period, 4),
        'first_beat_s': round(float(first), 4),
        'beats_s': [round(float(t), 3) for t in beats_s],
        'downbeats_s': [round(float(t), 3) for t in downbeats_s],
        'fps': fps,
        'beats_frame': [int(round(t * fps)) for t in beats_s],
        'downbeats_frame': [int(round(t * fps)) for t in downbeats_s],
        'meter_assumption': '4/4',
        'onsets': onsets,
        'onsets_frame': {k: pairs_frame(v) for k, v in onsets.items()},
        'kick_phase_refine': refine,
        'bar_phase': {'offset': off, 'snare_2and4_ratio': round(float(snare_score), 2),
                      'source': bar_source, 'snare_positions': hist,
                      'note': '4/4 假设；snare 应回 2&4 拍（8分位 2/6）；并列双小节歧义按重拍 kick 强度裁决，'
                              '证据不足回退 onset 能量法'},
    }


def _synth_click() -> np.ndarray:
    """合成 120 BPM、强拍在 1/3 拍位的 12s 点击轨（原自测信号）。"""
    rng = np.random.default_rng(7)
    period = 60.0 / 120.0
    t = np.arange(0, 12.0, 1 / RATE)
    x = np.zeros_like(t)
    for i, bt in enumerate(np.arange(0.0, 12.0, period)):
        amp = 0.9 if i % 4 == 0 else 0.55
        n = int(bt * RATE)
        m = min(int(0.05 * RATE), len(x) - n)
        click_t = np.arange(m) / RATE
        x[n:n + m] += amp * np.sin(2 * np.pi * 1000 * click_t) * np.exp(-click_t * 90)
    return x + rng.normal(0, 0.01, len(x))


def _synth_drums(bpm=110.0, dur=12.0, bar0=0.5) -> np.ndarray:
    """合成结构化鼓型：kick 四分铺底（小节头加重）、snare 在 2&4 拍、hat 反拍 8 分位。
    小节头从 bar0 起（非零相位），用于验证 kick 精修与小节相位裁决。"""
    rng = np.random.default_rng(11)
    period = 60.0 / bpm
    x = np.zeros(int(dur * RATE))
    kt = np.arange(int(0.12 * RATE)) / RATE
    kick = np.sin(2 * np.pi * 60.0 * kt) * np.exp(-kt / 0.03)

    def band_noise(lo, hi, dur_s, gain):
        raw = rng.normal(0, 1, int(dur_s * RATE))
        sig = band_signal(raw, lo, hi)
        peak = float(np.abs(sig).max())
        return sig / (peak if peak > 0 else 1.0) * gain

    snare = band_noise(1500.0, 5000.0, 0.09, 0.7)
    hat = band_noise(7000.0, None, 0.03, 0.22)
    for k, bt in enumerate(np.arange(bar0, dur - 0.2, period)):
        n = int(bt * RATE)
        amp = 0.9 if k % 4 == 0 else 0.55
        x[n:n + len(kick)] += kick * amp
        if k % 4 in (1, 3):
            x[n:n + len(snare)] += snare
        nh = int((bt + period / 2) * RATE)
        if nh + len(hat) < len(x):
            x[nh:nh + len(hat)] += hat
    return x + rng.normal(0, 0.003, len(x))


def selftest() -> int:
    """① 点击轨：测速/相位/对格；② 结构化鼓型：kick 精修、小节相位裁决、三分类计数。"""
    ok = True
    g = analyze(_synth_click(), 30)
    bpm_err = abs(g['bpm'] - 120.0)
    period = 0.5
    expect = np.arange(0.0, 12.0, period)
    got = np.array(g['beats_s'])
    phase_err = float(np.abs(((got[0] - expect[0]) + period / 2) % period - period / 2))
    dev = float(np.abs((got[:, None] - expect[None, :])).min(axis=1).mean())
    c1 = bpm_err <= 2.0 and phase_err <= 0.05 and dev <= 0.05
    ok = ok and c1
    print(f"selftest[click]: bpm={g['bpm']} (err {bpm_err:.2f}) phase_err={phase_err * 1000:.0f}ms "
          f"grid_dev={dev * 1000:.0f}ms conf={g['bpm_confidence']} -> {'PASS' if c1 else 'FAIL'}")

    g2 = analyze(_synth_drums(), 30)
    bpm_err2 = abs(g2['bpm'] - 110.0)
    down_ok = abs(g2['downbeats_s'][0] - 0.5) <= 0.08
    bp = g2['bar_phase']
    hist = bp['snare_positions'] or [0] * 8
    snare_on24 = (hist[2] + hist[6]) / max(1, sum(hist))
    n_snare = len(g2['onsets']['snare'])
    counts_ok = len(g2['onsets']['kick']) >= 18 and n_snare >= 8 and len(g2['onsets']['hat']) >= 16
    c2 = (bpm_err2 <= 2.0 and down_ok and bp['source'] == 'snare-2and4'
          and bp['snare_2and4_ratio'] >= 0.8 and snare_on24 >= 0.8 and counts_ok
          and g2['kick_phase_refine']['n'] >= 12)
    ok = ok and c2
    print(f"selftest[drums]: bpm={g2['bpm']} (err {bpm_err2:.2f}) downbeat0={g2['downbeats_s'][0]} "
          f"(bar0=0.5, {'OK' if down_ok else 'MISS'}) bar_phase={bp['source']} ratio={bp['snare_2and4_ratio']} "
          f"kick_refine={g2['kick_phase_refine']} counts k/s/h="
          f"{len(g2['onsets']['kick'])}/{n_snare}/{len(g2['onsets']['hat'])} -> {'PASS' if c2 else 'FAIL'}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio', nargs='?', help='BGM 音频路径（wav/mp3）')
    ap.add_argument('--out', default='script/beat_grid.json', help='输出 JSON 路径（默认 script/beat_grid.json）')
    ap.add_argument('--fps', type=int, default=30, help='帧率换算（默认 30）')
    ap.add_argument('--selftest', action='store_true', help='跑内置合成轨自测')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.audio:
        ap.error('需要 audio 路径（或 --selftest）')
    g = analyze(samples(Path(a.audio)), a.fps)
    g['input'] = str(a.audio)
    g['reliable'] = g['bpm_confidence'] >= CONF_MIN
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(g, ensure_ascii=False, indent=1), encoding='utf-8')
    bp = g['bar_phase']
    print(f"beat_grid: BPM≈{g['bpm']} (conf {g['bpm_confidence']}, 4/4 假设) 拍点 {len(g['beats_s'])} 个"
          f" / 重拍 {len(g['downbeats_s'])} 个，首拍 {g['first_beat_s']}s -> {out}")
    print(f"  鼓件分类: kick {len(g['onsets']['kick'])} / snare {len(g['onsets']['snare'])} / hat {len(g['onsets']['hat'])} 个"
          f"（kick 相位精修 {g['kick_phase_refine'].get('median_ms', '—')}ms, n={g['kick_phase_refine']['n']}）")
    print(f"  小节相位: source={bp['source']} snare_2&4 比例={bp['snare_2and4_ratio']} "
          f"offset={bp['offset']} 8分位直方图={bp['snare_positions']}")
    print(f"  重拍前 8 个(帧): {g['downbeats_frame'][:8]}")
    if not g['reliable']:
        print(f"  ⚠ 置信度 {g['bpm_confidence']} < {CONF_MIN}：此曲节奏成分弱、拍点网格不可靠——"
              f"节拍列按字幕块起始帧排（不卡拍），见 reference/motion-language.md §6 可靠性门")


if __name__ == '__main__':
    main()
