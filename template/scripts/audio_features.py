# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy>=2.2", "scipy>=1.15"]
# ///
"""BGM 连续音乐特征 → analysis/music_features.json（「画面骑音乐」连续反应层的数据源）。

定位（v4.3.0，方法论吸收 mexicat/pdoom-video analysis/analyze.py + engine/audio.ts，MIT）：
强节奏片的连续微动数据——100fps 归一化能量包络 + 分类 onset（含强度）+ 节拍网格，一次出齐。
与 beat_grid.py 的关系：网格口径同源（内部直接调 beat_grid.analyze，含 kick 相位精修与小节相位证据）；
纯卡点流程用 beat_grid.json 即可，需要连续反应层就用本文件，同一工程以 music_features.json 的
grid 字段为卡点真值（单一事实源，两份不混用）。
消费方：template/src/common/music.ts 的 createMusic(data, fps) → env / envPeak / hit / beatAt / events。
纪律（统一合同「音频」、music-beat-sync §7）：
  - 包络只驱动平滑连续运动（相机微漂 / 辉光呼吸 / 密度涨落）；
  - 冲击事件仍走 hit 候选池，并受 aesthetic-rules R4 全画面冲击硬上限（全片 ≤3 处）；
  - 数据文件不存在的工程不骑音乐——卡片禁止手写正弦假装在骑拍。
通道（v1，无 stem 分离）：rms / low(<150Hz) / mid(150-2k) / high(>4k) / percussive(HPSS 中值滤波
打击成分，Fitzgerald 2010 软掩码)。vocal/drums/bass/other stem 通道等分离管线（Demucs Tier）落地后再加，
登记于 music-beat-sync §7。

用法（项目根跑）：
  uv run python scripts/audio_features.py public/assets/<slug>/bgm.wav [--out analysis/music_features.json] [--fps 30]
自测：uv run python scripts/audio_features.py --selftest
"""
import argparse, hashlib, json, math, sys
import numpy as np
from pathlib import Path
from scipy.ndimage import median_filter
from scipy.signal import stft, istft

sys.path.insert(0, str(Path(__file__).resolve().parent))
import beat_grid as bg  # 同目录同源 DSP：samples / band_signal / analyze / classify_drums

RATE = bg.RATE  # 22050
ENV_FPS = 100   # 包络帧率：100fps 足够平滑且数据量可控（3 分钟 ≈ 450KB/通道）
N_FFT_HP = 1024
HOP_HP = 256


def frame_rms(x: np.ndarray, fps=ENV_FPS, win_s=0.046) -> np.ndarray:
    """滑动 RMS 包络，帧 i 中心 ≈ i/fps。"""
    w = max(4, int(win_s * RATE))
    h = max(1, int(RATE / fps))
    n = int(math.ceil(len(x) / RATE * fps))
    e = np.convolve(x.astype(np.float64) ** 2, np.ones(w) / w, mode='same')[::h]
    out = np.sqrt(np.maximum(e, 0.0))
    if len(out) < n:
        out = np.pad(out, (0, n - len(out)))
    return out[:n]


def smooth_env(v: np.ndarray, fps=ENV_FPS, attack=0.010, release=0.090) -> np.ndarray:
    """单极子跟随器：快攻击慢释放（pdoom 口径）——视觉友好的能量包络。"""
    aa = math.exp(-1 / (attack * fps))
    ar = math.exp(-1 / (release * fps))
    y = np.empty_like(v)
    s = 0.0
    for i, x in enumerate(v):
        a = aa if x > s else ar
        s = a * s + (1 - a) * x
        y[i] = s
    return y


def norm01(v: np.ndarray, pct=99.0) -> np.ndarray:
    """按自身 99 分位归一到 0..1（单条相对档，不跨曲可比——与 bgm 档位口径一致）。"""
    ref = np.percentile(v, pct)
    return np.clip(v / (ref + 1e-12), 0.0, 1.0)


def band_env(x: np.ndarray, lo, hi) -> np.ndarray:
    return frame_rms(bg.band_signal(x, lo, hi))


def percussive_signal(x: np.ndarray) -> np.ndarray:
    """HPSS 打击成分（Fitzgerald 2010 中值滤波 + Wiener 软掩码）：频率向中值=谐波，时间向中值=打击。"""
    f, t, Z = stft(x, fs=RATE, nperseg=N_FFT_HP, noverlap=N_FFT_HP - HOP_HP)
    mag = np.abs(Z)
    H = median_filter(mag, size=(1, 17))
    P = median_filter(mag, size=(17, 1))
    mask = P ** 2 / (H ** 2 + P ** 2 + 1e-12)
    _, x_rec = istft(Z * mask, fs=RATE, nperseg=N_FFT_HP, noverlap=N_FFT_HP - HOP_HP)
    return np.asarray(x_rec)[:len(x)]


def extract(x: np.ndarray, fps=30, input_path='') -> dict:
    grid = bg.analyze(x, fps)
    n = int(math.ceil(len(x) / RATE * ENV_FPS))
    env = {
        'rms': frame_rms(x),
        'low': band_env(x, None, 150.0),
        'mid': band_env(x, 150.0, 2000.0),
        'high': band_env(x, 4000.0, None),
        'percussive': frame_rms(percussive_signal(x)),
    }
    for k in env:
        v = norm01(smooth_env(env[k]))
        assert len(v) == n, f'包络长度不一致: {k}'
        env[k] = [round(float(a), 3) for a in v]
    return {
        'duration_s': round(len(x) / RATE, 3),
        'fps_env': ENV_FPS,
        'input': input_path,
        'input_sha256': hashlib.sha256(x.tobytes()).hexdigest()[:16] + '…(pcm 截断哈希，完整文件哈希走素材台账)',
        'grid': grid,
        'envelopes': env,
        'notes': 'envelopes=100fps 归一化包络（单极子 10ms 攻击/90ms 释放，99 分位归一，单曲内相对档）；'
                 'channels: rms/low(<150Hz)/mid(150-2k)/high(>4k)/percussive(HPSS 打击成分)；'
                 'grid=beat_grid.analyze 同源输出（kick 相位精修+snare 小节相位证据）；'
                 'onsets 在 grid.onsets（[秒,强度]，帧表 grid.onsets_frame）；'
                 'v1 无 stem/vocal 通道（分离管线落地后加，见 music-beat-sync §7）。',
    }


def _synth(dur=20.0) -> np.ndarray:
    """合成测试信号：AM 旋律（谐波、慢包络）+ 0.5s 周期鼓型（打击、快攻击）。"""
    rng = np.random.default_rng(23)
    t = np.arange(int(dur * RATE)) / RATE
    melody = (0.25 + 0.1 * np.sin(2 * np.pi * 0.5 * t)) * np.sin(2 * np.pi * 220.0 * t)
    x = bg._synth_drums(bpm=120.0, dur=dur, bar0=0.0) * 0.8 + melody
    return x + rng.normal(0, 0.002, len(x))


def selftest() -> int:
    """断言通道齐/长度齐/值域 0..1/打击通道对鼓型反应/网格字段齐/JSON 可序列化。"""
    x = _synth()
    doc = extract(x, 30, 'selftest')
    n = int(math.ceil(len(x) / RATE * ENV_FPS))
    ok = True

    def check(name, cond, detail=''):
        nonlocal ok
        ok = ok and bool(cond)
        print(f"  {name}: {'PASS' if cond else 'FAIL'} {detail}")

    env = doc['envelopes']
    check('channels', set(env) == {'rms', 'low', 'mid', 'high', 'percussive'}, sorted(env))
    check('lengths', all(len(v) == n for v in env.values()), f'n={n}')
    check('range01', all(min(v) >= 0.0 and max(v) <= 1.0 for v in env.values()),
          f"rms max={max(env['rms'])}")
    # 打击通道对鼓型帧的反应显著高于其前 0.15s 的安静参考帧（旋律是慢包络，只有 percussive 该拉开）
    burst_f, ref_f = int(1.0 * ENV_FPS), int(0.85 * ENV_FPS)  # 鼓点在整数拍 0.5s 周期上
    w = 2
    p_burst = max(env['percussive'][burst_f - w:burst_f + w + 1])
    p_ref = max(env['percussive'][ref_f - w:ref_f + w + 1])
    check('percussive_reacts', p_burst > p_ref + 0.3, f'burst={p_burst:.2f} ref={p_ref:.2f}')
    g = doc['grid']
    check('grid_fields', all(k in g for k in ('bpm', 'beats_s', 'downbeats_s', 'onsets', 'bar_phase')),
          f"bpm={g['bpm']} bar={g['bar_phase']['source']}")
    check('onsets', len(g['onsets']['kick']) >= 30, f"kick={len(g['onsets']['kick'])}")
    blob = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
    check('json_size', len(blob) < 8 * 1024 * 1024, f'{len(blob) // 1024}KB')
    print(f"selftest[audio_features] -> {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio', nargs='?', help='BGM 音频路径（wav/mp3）')
    ap.add_argument('--out', default='analysis/music_features.json', help='输出 JSON 路径')
    ap.add_argument('--fps', type=int, default=30, help='工程帧率（grid 帧表换算，默认 30）')
    ap.add_argument('--selftest', action='store_true', help='跑内置合成信号自测')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.audio:
        ap.error('需要 audio 路径（或 --selftest）')
    doc = extract(bg.samples(Path(a.audio)), a.fps, str(a.audio))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    g = doc['grid']
    print(f"audio_features: {doc['duration_s']}s @100fps×{len(doc['envelopes'])}通道, "
          f"BPM≈{g['bpm']} (conf {g['bpm_confidence']}) kick/snare/hat="
          f"{len(g['onsets']['kick'])}/{len(g['onsets']['snare'])}/{len(g['onsets']['hat'])} -> {out}")
    print(f"  消费：卡片 import 数据后走 common/music.ts createMusic(data, FPS)；"
          f"纪律见统一合同「音频」与 music-beat-sync §7")


if __name__ == '__main__':
    main()
