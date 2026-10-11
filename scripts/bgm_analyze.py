#!/usr/bin/env python3
"""bgm_analyze — 曲库曲档案分析（客观层）：能量曲线、结构分段、入出点候选、响度、BPM。

2026-10-11 定案（grilling 三层目标）的客观层实现：程序测出可测的，主观层（段落命名/气质/
适用片型）由用户试听标注轮亲笔校准后落 reference/bgm-library.md 与本 profile 的人工字段。
机制侧消费（v4.2.0）：mix_audio 多段 playlist 与音乐编排表按 profile 的 segments/in_candidates
定曲内进出点——从此贴片不再默认从 0s 进。

手法：自研通用 DSP，只依赖 ffmpeg 解码 + numpy（同 beat_grid 纪律）。BPM 直接复用
template/scripts/beat_grid.py 的 analyze（单一真值源，import 不复制）。

用法（曲库批量建档）：
  uv run python scripts/bgm_analyze.py assets/audio/bgm/*.mp3 --out-dir assets/audio/bgm/profiles
单文件 + 来源登记：
  uv run python scripts/bgm_analyze.py <audio> --url https://... --license "Mixkit Free License"
自测：
  uv run python scripts/bgm_analyze.py --selftest

诚实口径（写入每个 profile 的 method_notes，机制消费时不得越界）：
  - 能量档位（level 1-5）是**本曲 P95 归一后的相对档**，均匀曲自然少段；不跨曲可比。
  - 分段边界=能量档变化点，不是乐理结构；与真实乐句可差数秒，以人工标注轮为准。
  - BPM=自相关估计（beat_grid 口径），置信度<3.0 不可靠。
  - 亮度=频谱质心近似，仅同曲内段落横向参考。
  - 入出点候选是能量稳态/跳变的统计结果，听感命名待人工标注轮校准；机制侧消费前必查
    profile 的 `human_reviewed` 字段——false 时只作参考、不得自动定切点。
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

RATE = 22050
BLOCK = 0.25            # 能量块长（秒）
SMOOTH_S = 2.0          # 能量平滑窗（秒）
MIN_SEG_S = 6.0         # 最短段落（秒）
LEVEL_CUTS = (0.2, 0.4, 0.6, 0.8)   # P95 归一能量 → level 1-5 的绝对档线
SLOPE_CUT = 0.15        # level/10s，超过记 rise/fall
TAIL_S = 3.0            # 尾部判定窗
CONF_MIN = 3.0          # BPM 可靠门（与 beat_grid 一致）

_PRESET_LABELS = ('开场铺垫段', '低伏垫底段', '主题段', '推进蓄力段', '高能主段', '收尾段')


def samples(path: Path) -> np.ndarray:
    raw = subprocess_run_ffmpeg(path)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0


def subprocess_run_ffmpeg(path: Path) -> bytes:
    import subprocess
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(RATE),
                        '-f', 's16le', '-'], capture_output=True, check=True)
    return r.stdout


def energy_blocks(x: np.ndarray) -> np.ndarray:
    """每 0.25s 块的 RMS。"""
    n = len(x) // int(RATE * BLOCK)
    if n < 8:
        raise SystemExit('音频太短，无法分析（<2s）')
    u = x[:n * int(RATE * BLOCK)].reshape(n, -1)
    return np.sqrt((u ** 2).mean(axis=1))


def smooth(a: np.ndarray, k: int) -> np.ndarray:
    kernel = np.ones(k) / k
    return np.convolve(a, kernel, mode='same')


def brightness_track(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """每 0.5s 窗的频谱质心（Hz）与其时间轴。"""
    win = int(RATE * 0.5)
    hop = int(RATE * 0.5)
    n = max(1, (len(x) - win) // hop + 1)
    freqs = np.fft.rfftfreq(win, 1 / RATE)
    cents, times = [], []
    for i in range(n):
        seg = x[i * hop:i * hop + win]
        if len(seg) < win:
            break
        mag = np.abs(np.fft.rfft(seg * np.hanning(win)))
        c = float((mag * freqs).sum() / max(mag.sum(), 1e-12))
        cents.append(c)
        times.append((i * hop + win / 2) / RATE)
    return np.array(times), np.array(cents)


def level_of(e: np.ndarray) -> np.ndarray:
    p95 = np.percentile(e, 95)
    if p95 <= 0:
        return np.ones(len(e), dtype=int)
    n = e / p95
    lv = np.ones(len(e), dtype=int)
    for c in LEVEL_CUTS:
        lv += (n >= c).astype(int)
    return lv


def fit_slope(t: np.ndarray, e: np.ndarray) -> float:
    """能量对时间的线性斜率（level/10s）。"""
    if len(t) < 3 or t[-1] - t[0] < 1e-6:
        return 0.0
    k = np.polyfit(t, e, 1)[0]
    return float(k * 10.0)


def segment(curve_t: np.ndarray, e: np.ndarray, lv: np.ndarray) -> list[dict]:
    """档位变化切段 + 短段并入相邻低档段。"""
    bounds = [0]
    for i in range(1, len(lv)):
        if lv[i] != lv[i - 1]:
            bounds.append(i)
    bounds.append(len(lv))
    segs = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        if b - a <= 0:
            continue
        segs.append({'i0': a, 'i1': b})
    # 短段并入能量更低的邻段（并列取前段），直到全部 >= MIN_SEG_S 或只剩一段
    min_blocks = max(1, int(round(MIN_SEG_S / BLOCK)))
    changed = True
    while changed and len(segs) > 1:
        changed = False
        for si, s in enumerate(segs):
            if s['i1'] - s['i0'] >= min_blocks:
                continue
            left = segs[si - 1] if si > 0 else None
            right = segs[si + 1] if si + 1 < len(segs) else None
            tgt = None
            if left and right:
                tgt = left if lv[left['i0']] <= lv[right['i0']] else right
            else:
                tgt = left or right
            if tgt is left:
                left['i1'] = s['i1']
            elif tgt is right:
                right['i0'] = s['i0']
            segs.pop(si)
            changed = True
            break
    out = []
    for s in segs:
        t0 = float(curve_t[s['i0']])
        t1 = float(curve_t[min(s['i1'], len(curve_t) - 1)])
        m = e[s['i0']:s['i1']]
        out.append({
            'start': round(t0, 2), 'end': round(t1, 2),
            'dur': round(t1 - t0, 2),
            'mean_energy': round(float(m.mean()), 3),
            'level': int(np.median(lv[s['i0']:s['i1']])),
            'slope': round(fit_slope(curve_t[s['i0']:s['i1']], m), 3),
        })
    return out


def prelabel(segs: list[dict]) -> list[str]:
    """程序预命名：按档位/斜率/位置给段落起人话名，供试听标注轮校准。"""
    if not segs:
        return []
    imax = int(np.argmax([s['mean_energy'] for s in segs]))
    labels = ['主题段'] * len(segs)
    for i, s in enumerate(segs):
        if i == 0 and s['level'] <= 2:
            labels[i] = '开场铺垫段'
        elif i == len(segs) - 1 and (s['level'] <= 2 or s['slope'] < -SLOPE_CUT):
            labels[i] = '收尾段'
        elif i == imax:
            labels[i] = '高能主段'
        elif s['slope'] > SLOPE_CUT:
            labels[i] = '推进蓄力段'
        elif s['level'] <= 2:
            labels[i] = '低伏垫底段'
    seen: dict[str, int] = {}
    for i, lb in enumerate(labels):
        seen[lb] = seen.get(lb, 0) + 1
        if seen[lb] > 1:
            labels[i] = f'{lb}{seen[lb]}'
    return labels


def brightness_of(seg: dict, br_t: np.ndarray, br_v: np.ndarray) -> float:
    m = (br_t >= seg['start']) & (br_t < seg['end'])
    return round(float(br_v[m].mean()) if m.any() else 0.0, 0)


def in_candidates(segs: list[dict], labels: list[str], duration: float) -> list[dict]:
    out = [{'t': 0.0, 'kind': 'start', 'level': segs[0]['level'] if segs else 1,
            'note': '从头进（现状默认，任何曲都有）'}]
    imax = int(np.argmax([s['mean_energy'] for s in segs])) if segs else -1
    # 稳态入点：中档且平稳的段首（垫底/叙述进曲用），按段内能量方差挑最稳的两处
    steady = []
    for i, s in enumerate(segs):
        if s['level'] in (2, 3, 4) and abs(s['slope']) <= SLOPE_CUT and s['dur'] >= MIN_SEG_S:
            steady.append(i)
    steady.sort(key=lambda i: i != imax)  # 高能主段稳态优先
    for i in steady[:2]:
        out.append({'t': segs[i]['start'], 'kind': 'steady', 'level': segs[i]['level'],
                    'note': f'「{labels[i]}」起（稳态，适合垫底进）'})
    # hook 入点：最高档段起点 / 档位跳升 ≥2 的边界
    if imax >= 0 and segs[imax]['start'] > 0.5:
        out.append({'t': segs[imax]['start'], 'kind': 'hook', 'level': segs[imax]['level'],
                    'note': f'「{labels[imax]}」起点（全曲最猛段，hero 对位候选）'})
    for i in range(1, len(segs)):
        if segs[i]['level'] - segs[i - 1]['level'] >= 2 and segs[i]['start'] not in [c['t'] for c in out]:
            out.append({'t': segs[i]['start'], 'kind': 'hook', 'level': segs[i]['level'],
                        'note': f'能量跳升点（{labels[i]} 起）'})
    return sorted(out, key=lambda c: c['t'])


def out_candidates(segs: list[dict], labels: list[str], e: np.ndarray, curve_t: np.ndarray,
                   duration: float) -> list[dict]:
    out = []
    tail_mask = curve_t >= max(0.0, duration - TAIL_S)
    tail = float(e[tail_mask].mean()) if tail_mask.any() else 0.0
    med = float(np.median(e))
    if tail < 0.3 * med:
        out.append({'t': round(duration, 2), 'kind': 'natural_end',
                    'note': f'自然收尾（尾 {TAIL_S:.0f}s 能量≈全曲中位 {tail / max(med, 1e-9) * 100:.0f}%，可直接用到结尾）'})
    else:
        out.append({'t': round(duration, 2), 'kind': 'natural_end',
                    'note': '无自然收尾（尾部能量未衰减，出点需淡出）'})
    loud = [i for i, s in enumerate(segs) if s['level'] >= 4]
    if loud:
        i = loud[-1]
        out.append({'t': segs[i]['end'], 'kind': 'clean_cut',
                    'note': f'「{labels[i]}」末干净切点（高能走完即收）'})
    for i in range(1, len(segs)):
        if segs[i]['level'] <= segs[i - 1]['level'] - 2:
            out.append({'t': segs[i]['start'], 'kind': 'drop_cut',
                        'note': f'能量落点（{labels[i - 1]} → {labels[i]}）'})
    return out


def beat_info(x: np.ndarray) -> dict:
    """复用 beat_grid 的 analyze（单一真值源）；失败则诚实降级。"""
    sibling = Path(__file__).resolve().parent.parent / 'template' / 'scripts'
    try:
        sys.path.insert(0, str(sibling))
        import beat_grid  # noqa: PLC0415
        g = beat_grid.analyze(x, 30)
        return {'bpm': g['bpm'], 'bpm_confidence': g['bpm_confidence'],
                'bpm_reliable': g['bpm_confidence'] >= beat_grid.CONF_MIN}
    except Exception as exc:  # SystemExit（无清晰拍点）或路径缺失，统一诚实降级
        return {'bpm': None, 'bpm_confidence': None, 'bpm_reliable': False,
                'bpm_note': f'beat_grid 不可用：{exc}'}


METHOD_NOTES = [
    '能量档位 level 1-5 = 本曲 P95 归一后的相对档，均匀曲自然少段；不跨曲可比',
    '分段边界=能量档变化点而非乐理结构，与真实乐句可差数秒，以人工标注轮校准为准',
    'BPM 沿用 beat_grid 自相关口径，置信度<3.0 不可靠',
    '亮度=频谱质心近似，仅同曲内段落横向参考',
    '入出点候选=能量稳态/跳变统计结果；human_reviewed=false 时只作参考、不得自动定切点',
]


def analyze_file(path: Path, url: str | None, license_: str | None) -> dict:
    x = samples(path)
    duration = len(x) / RATE
    e_blk = energy_blocks(x)
    curve_t = np.arange(len(e_blk)) * BLOCK + BLOCK / 2
    e_s = smooth(e_blk, max(1, int(round(SMOOTH_S / BLOCK))))
    lv = level_of(e_s)
    segs = segment(curve_t, e_s, lv)
    labels = prelabel(segs)
    br_t, br_v = brightness_track(x)
    for s, lb in zip(segs, labels):
        s['prelabel'] = lb
        s['brightness'] = brightness_of(s, br_t, br_v)
    rms = float(np.sqrt((x ** 2).mean()))
    peak = float(np.abs(x).max())
    info = beat_info(x)
    prof = {
        'track': path.stem,
        'file': str(path).replace('\\', '/'),
        'duration_s': round(duration, 2),
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'loudness': {'rms_dbfs': round(20 * np.log10(max(rms, 1e-9)), 1),
                     'peak_dbfs': round(20 * np.log10(max(peak, 1e-9)), 1)},
        **info,
        'energy_curve_s': [round(float(v), 3) for v in e_s[::4]],  # 1s 分辨率供图谱
        'segments': segs,
        'in_candidates': in_candidates(segs, labels, duration),
        'out_candidates': out_candidates(segs, labels, e_s, curve_t, duration),
        'human_reviewed': False,
        'method_notes': METHOD_NOTES,
    }
    if url:
        prof['source_url'] = url
    if license_:
        prof['license'] = license_
    return prof


def selftest() -> int:
    """合成 32s 已知结构轨（8s 静→8-20s 强→衰减尾），断言分段/入点/尾判定。"""
    rng = np.random.default_rng(11)
    t = np.arange(0, 32.0, 1 / RATE)
    x = rng.normal(0, 0.02, len(t)) + 0.03 * np.sin(2 * np.pi * 220 * t)
    beat = (t >= 8) & (t < 20)
    click_times = np.arange(8.0, 20.0, 0.5)
    for ct in click_times:
        m = (t >= ct) & (t < ct + 0.03)
        x[m] += 0.5 * np.sin(2 * np.pi * 1000 * t[m])
    x[beat] += rng.normal(0, 0.10, int(beat.sum()))
    decay = np.exp(-(t - 20) * 0.6) * (t >= 20)
    x += 0.12 * decay * np.sin(2 * np.pi * 330 * t)
    x[(t >= 20)] *= np.clip(1 - (t[(t >= 20)] - 20) / 11.5, 0.05, 1)
    p = Path('._bgm_analyze_selftest.wav')
    import wave
    with wave.open(str(p), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    try:
        prof = analyze_file(p, None, None)
    finally:
        p.unlink(missing_ok=True)
    segs, ins, outs = prof['segments'], prof['in_candidates'], prof['out_candidates']
    loud_entry = [s for s in segs if s['level'] >= 4 and 6.5 <= s['start'] <= 10.5]
    hook = [c for c in ins if c['kind'] == 'hook' and 6.5 <= c['t'] <= 10.5]
    natural = [c for c in outs if c['kind'] == 'natural_end' and '自然收尾' in c['note']]
    checks = {
        '分段数≥3': len(segs) >= 3,
        '强段起点≈8s': bool(loud_entry),
        'hook 候选≈8s': bool(hook),
        '尾判定=自然收尾': bool(natural),
        '能量曲线长度': len(prof['energy_curve_s']) == 32,
        '人工字段默认 false': prof['human_reviewed'] is False,
    }
    for k, v in checks.items():
        print(f"  {k}: {'PASS' if v else 'FAIL'}")
    print(f"  分段: {[(s['prelabel'], s['start'], s['end'], s['level']) for s in segs]}")
    print(f"  入点: {[(c['kind'], c['t']) for c in ins]}")
    ok = all(checks.values())
    print(f"selftest: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio', nargs='*', help='音频路径（可多个）')
    ap.add_argument('--out-dir', default='assets/audio/bgm/profiles', help='profile 输出目录')
    ap.add_argument('--url', default=None, help='来源 URL（写入 profile）')
    ap.add_argument('--license', dest='license_', default=None, help='许可（写入 profile）')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.audio:
        ap.error('需要至少一个音频路径（或 --selftest）')
    out_dir = Path(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in map(Path, a.audio):
        prof = analyze_file(p, a.url, a.license_)
        out = out_dir / f'{p.stem}.json'
        out.write_text(json.dumps(prof, ensure_ascii=False, indent=1), encoding='utf-8')
        segs_txt = ' / '.join(f"{s['prelabel']} {s['start']}-{s['end']}s(L{s['level']})" for s in prof['segments'])
        bpm_txt = f"BPM≈{prof['bpm']}(conf {prof['bpm_confidence']})" if prof['bpm'] else 'BPM 不可测'
        print(f"bgm_analyze: {p.name} {prof['duration_s']}s {bpm_txt} -> {out}")
        print(f"  分段: {segs_txt}")
        print(f"  入点候选: {[(c['kind'], c['t']) for c in prof['in_candidates']]}")
        print(f"  出点候选: {[(c['kind'], c['t']) for c in prof['out_candidates']]}")


if __name__ == '__main__':
    main()
