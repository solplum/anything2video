#!/usr/bin/env python3
"""三层混音：旁白正本 audio_narration.wav + 可选 BGM/音效 → 派生 audio.wav。
用法：uv run python scripts/mix_audio.py [--epic] [--bed 0.055] [--sfx none|sand]
- --epic（epic 无旁白口径，recipes/epic.md §6）：旁白轨为零、片长从 script/timeline.json 读（chapter_timeline.py 产出）、
  响度床缺省 0.12（无旁白压制，音乐可给更大空间）；其余流程同标准模式
- 旁白正本：TTS 同时写 audio_narration.wav；混音只读正本，禁止按 mtime 回拷混音。
  --adopt-legacy 显式迁移旧工程 audio.wav；已有 mix.json 时正本缺失必须重跑 TTS。
- BGM 二模式：①音乐编排表 audio/music_plan.json（v4.2.0，多段接力：逐段[曲/曲内进出点/视频落位/
  crossfade]，schema 与纪律见 reference/music-plan.md，主题反查提名用 scripts/bgm_query.py）——
  逐段解码→段级 RMS 归一到响度床→段内淡入淡出→重叠区等功率 crossfade；
  ②单曲 bgm.wav：解码 → 等功率交叉淡化循环到片长 → RMS 归一到目标响度床 → 1.5s/3.5s 余弦淡入淡出。
- 旁白让位：非对称侧链包络（40ms 快攻 / 350ms 保持 / 900ms 慢释防句间抽吸）+ 850–3600Hz 动态人声挖槽（-8.5dB 中频 / -3.0dB 其余频段）。
- 音效：默认关闭；--sfx sand 显式启用章节铺沙/扫掠。
- 依赖：numpy scipy；ffmpeg 解码音频
"""
import argparse, hashlib, json, math, os, pathlib, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import butter, lfilter, sosfilt
from audio_project import AudioProject

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

SR = 48000
BGM_SCALE_CAP = 8.0
SFX_GAIN = {'pour': 0.15, 'wipe': 0.10}


def compute_speech_duck_envelope(narr_mono, sr=SR, hold_s=0.35, attack_s=0.04, release_s=0.90):
    """非对称侧链包络：短停顿由 hold 稳住不抽吸，长留白（>1s）按 900ms 优雅回升。"""
    x = np.asarray(narr_mono, dtype=np.float64)
    n = len(x)
    if n == 0:
        return np.zeros(0, dtype=np.float64)
    rms_win = max(1, int(round(sr * 0.02)))
    rms = np.sqrt(np.maximum(0.0, uniform_filter1d(x * x, size=rms_win, mode='nearest')))
    gate = np.clip((rms - 0.005) / 0.030, 0.0, 1.0)
    look_n = max(1, int(round(sr * 0.03))) | 1
    gate_pre = maximum_filter1d(gate, size=look_n, mode='constant', cval=0.0, origin=-(look_n // 2))
    hold_n = max(1, int(round(sr * hold_s))) | 1
    held = maximum_filter1d(gate_pre, size=hold_n, mode='constant', cval=0.0, origin=hold_n // 2)
    step = max(1, sr // 1000)
    ctrl_sr = sr / step
    held_ds = held[::step]
    att_a = 1.0 - math.exp(-1.0 / max(1e-6, attack_s * ctrl_sr))
    rel_a = 1.0 - math.exp(-1.0 / max(1e-6, release_s * ctrl_sr))
    sm = np.empty_like(held_ds)
    val = float(held_ds[0])
    for k in range(len(held_ds)):
        target = float(held_ds[k])
        val += (att_a if target > val else rel_a) * (target - val)
        sm[k] = val
    if step == 1 and len(sm) == n:
        return sm
    return np.interp(np.arange(n, dtype=np.float64), np.arange(len(sm), dtype=np.float64) * step, sm)


def apply_spectral_ducking(bgm, duck_env, sr=SR, mid_db=-8.5, body_db=-3.0):
    """动态人声让位：人声清晰度核心区（850–3600Hz）深压 -8.5dB，底鼓/低音（body）轻压 -3.0dB 托底。"""
    b = np.asarray(bgm, dtype=np.float64)
    env = np.asarray(duck_env, dtype=np.float64)
    if len(b) == 0:
        return b.copy()
    hi = min(3600.0, 0.45 * sr)
    lo = min(850.0, 0.5 * hi)
    if lo <= 20.0 or hi <= lo + 10.0:
        gain = 1.0 - (env[:, None] if b.ndim == 2 else env) * (1.0 - 10.0 ** (body_db / 20.0))
        return b * gain
    sos = butter(2, [lo, hi], btype='bandpass', fs=sr, output='sos')
    bgm_mid = sosfilt(sos, b, axis=0)
    bgm_body = b - bgm_mid
    e = env[:, None] if b.ndim == 2 else env
    gain_mid = 1.0 - e * (1.0 - 10.0 ** (mid_db / 20.0))
    gain_body = 1.0 - e * (1.0 - 10.0 ** (body_db / 20.0))
    return bgm_body * gain_body + bgm_mid * gain_mid


def loop_with_crossfade(bgm, total_samples, sr=SR, xfade_s=1.5):
    """单曲长于片长直接裁切；短于片长则用等功率交叉淡化无缝循环，消除接缝爆音。"""
    src = np.asarray(bgm, dtype=np.float64)
    if len(src) >= total_samples:
        return src[:total_samples].copy()
    if len(src) == 0:
        shape = (total_samples, src.shape[1]) if src.ndim == 2 else (total_samples,)
        return np.zeros(shape, dtype=np.float64)
    xf = min(int(round(xfade_s * sr)), len(src) // 3)
    if xf < 16:
        out = np.tile(src, ((total_samples + len(src) - 1) // len(src), 1) if src.ndim == 2 else (total_samples + len(src) - 1) // len(src))
        return out[:total_samples]
    theta = np.linspace(0.0, math.pi * 0.5, xf, dtype=np.float64)
    if src.ndim == 2:
        fade_out = np.cos(theta)[:, None]
        fade_in = np.sin(theta)[:, None]
    else:
        fade_out = np.cos(theta)
        fade_in = np.sin(theta)
    chunks = [src[:-xf]]
    tail = src[-xf:] * fade_out
    produced = len(src) - xf
    while produced < total_samples:
        head = src[:xf] * fade_in
        chunks.append(tail + head)
        produced += xf
        if produced >= total_samples:
            break
        mid = src[xf:-xf]
        chunks.append(mid)
        produced += len(mid)
        tail = src[-xf:] * fade_out
    return np.concatenate(chunks, axis=0)[:total_samples]


def _decode_stereo(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    data = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    if len(data) == 0 or not np.all(np.isfinite(data)):
        raise SystemExit(f'音轨为空或含非法采样：{path}')
    return data


def _resolve_track(name, a_dir, root):
    for candidate in (pathlib.Path(a_dir) / name, pathlib.Path(root) / 'assets' / 'audio' / 'bgm' / name,
                      pathlib.Path(name)):
        if candidate.exists():
            return candidate
    raise SystemExit(f'music_plan: 找不到音轨 {name}（查工程 {a_dir} 与 skill 曲库 assets/audio/bgm）')


def _render_music_plan(plan, total, target_bgm_rms, a_dir, root, music_tracks_log):
    """逐 cue 渲染：解码→曲内裁切→段级 RMS 归一→段内淡入淡出→重叠区等功率 crossfade。"""
    cues = plan.get('cues')
    if not isinstance(cues, list) or not cues:
        raise SystemExit('music_plan.cues 必须为非空数组')
    bgm = np.zeros((total, 2), dtype=np.float64)
    decoded = {}
    prev_start = prev_end = None
    for i, cue in enumerate(cues):
        if not isinstance(cue, dict):
            raise SystemExit(f'music_plan.cues[{i}] 必须为对象')
        for key in ('track', 'track_in', 'track_out', 'timeline_start'):
            if key not in cue:
                raise SystemExit(f'music_plan.cues[{i}] 缺字段 {key}')
        t_in, t_out, t0 = float(cue['track_in']), float(cue['track_out']), float(cue['timeline_start'])
        if not (0 <= t_in < t_out):
            raise SystemExit(f'music_plan.cues[{i}]: 必须满足 0 ≤ track_in < track_out（现 {t_in}/{t_out}）')
        seg_dur = t_out - t_in
        t1 = float(cue['timeline_end']) if cue.get('timeline_end') is not None else t0 + seg_dur
        if abs((t1 - t0) - seg_dur) > 0.05:
            raise SystemExit(f'music_plan.cues[{i}]: 落位时长 {t1 - t0:.2f}s 与曲内范围 {seg_dur:.2f}s 不一致（容差 0.05s）')
        if t0 < 0 or t1 > total / SR + 0.1:
            raise SystemExit(f'music_plan.cues[{i}]: 落位 [{t0:.2f},{t1:.2f}]s 超出片长 {total / SR:.2f}s')
        if prev_start is not None and t0 < prev_start - 1e-6:
            raise SystemExit(f'music_plan.cues[{i}]: timeline_start 乱序（{t0:.2f} < 前段 {prev_start:.2f}）')
        path = _resolve_track(str(cue['track']), a_dir, root)
        key = str(path)
        if key not in decoded:
            decoded[key] = _decode_stereo(path)
        avail = len(decoded[key]) / SR
        if t_out > avail + 0.05:
            raise SystemExit(f'music_plan.cues[{i}]: 曲内出点 {t_out:.2f}s 超出音轨时长 {avail:.2f}s（{cue["track"]}）')
        xf = float(cue.get('crossfade_in') or 0)
        overlap = 0.0 if prev_end is None else max(0.0, prev_end - t0)
        if overlap > 1e-6 and xf < overlap - 0.05:
            raise SystemExit(f'music_plan.cues[{i}]: 与前段重叠 {overlap:.2f}s 但 crossfade_in={xf:.2f}s——'
                             'crossfade 必须覆盖重叠区（音乐编排表纪律，见 reference/music-plan.md）')
        n = int(round(seg_dur * SR))
        i0 = int(round(t0 * SR))
        seg = decoded[key][int(round(t_in * SR)):int(round(t_in * SR)) + n].copy()
        if len(seg) < n:
            seg = np.concatenate([seg, np.zeros((n - len(seg), 2))])
        seg = seg[:max(0, min(n, total - i0))]
        if len(seg) == 0:
            raise SystemExit(f'music_plan.cues[{i}]: 落位完全在片长之外')
        seg_rms = float(np.sqrt(np.mean(seg ** 2)))
        if seg_rms > 1e-6:
            seg *= min(BGM_SCALE_CAP, target_bgm_rms / seg_rms)
        fade_in, fade_out = float(cue.get('fade_in') or 0), float(cue.get('fade_out') or 0)
        if fade_in > 0:
            k = min(len(seg), int(fade_in * SR))
            seg[:k] *= np.linspace(0, 1, k)[:, None]
        if fade_out > 0:
            k = min(len(seg), int(fade_out * SR))
            seg[-k:] *= np.linspace(1, 0, k)[:, None]
        i1 = i0 + len(seg)
        if overlap > 1e-6:
            o_end = min(i1, int(round(prev_end * SR)))
            if o_end > i0:
                alpha = np.clip((np.arange(i0, o_end) / SR - t0) / max(xf, 1e-6), 0.0, 1.0)
                bgm[i0:o_end] = bgm[i0:o_end] * np.sqrt(1 - alpha)[:, None] + seg[:o_end - i0] * np.sqrt(alpha)[:, None]
                bgm[o_end:i1] += seg[o_end - i0:]
            else:
                bgm[i0:i1] += seg
        else:
            bgm[i0:i1] += seg
        prev_start, prev_end = t0, t1
        music_tracks_log.append({'track': str(cue['track']), 'track_in': t_in, 'track_out': t_out,
                                 'timeline_start': t0, 'timeline_end': t1, 'crossfade_in': xf,
                                 'section': cue.get('section'), 'rationale': cue.get('rationale')})
    return bgm


def _lowpass(x, cutoff, order=4):
    b, a = butter(order, cutoff / (SR / 2), btype='low')
    return lfilter(b, a, x)


def _pour(dur_s=1.1):
    """铺沙：双重低通噪声 + 缓起缓落（沙瀑感，去静电）"""
    n = int(dur_s * SR)
    x = np.random.default_rng(7).standard_normal(n)
    x = _lowpass(_lowpass(x, 650), 650)
    env = np.minimum(np.arange(n) / (0.35 * SR), 1.0) * np.exp(-np.linspace(0, 3.6, n))
    return (x * env)[:, None] * SFX_GAIN['pour']


def _wipe(dur_s=0.55):
    """扫掠：700–3200Hz 带通气流（抹沙/转场）"""
    n = int(dur_s * SR)
    x = np.random.default_rng(11).standard_normal(n)
    x = _lowpass(x, 3200)
    b, a = butter(4, 700 / (SR / 2), btype='high')
    x = lfilter(b, a, x)
    return (x * np.sin(np.linspace(0, np.pi, n)) ** 2.0)[:, None] * SFX_GAIN['wipe']


def main(argv=None):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--epic', action='store_true')
    parser.add_argument('--bed', type=float)
    parser.add_argument('--sfx', choices=('none', 'sand'), default='none')
    parser.add_argument('--adopt-legacy', action='store_true')
    parser.add_argument('--legacy-config', action='store_true')
    parser.add_argument('--fps', type=int)
    options = parser.parse_args(argv)
    try:
        project = AudioProject(root, options.legacy_config, options.fps)
        a_dir = project.path(project.assets)
        project.preflight_audio(a_dir)
        tl = project.timeline()
    except (ValueError, OSError) as error:
        raise SystemExit(f'[mix_audio] {error}') from None

    raw_path = f'{a_dir}/audio_narration.wav'
    mix_path = f'{a_dir}/audio.wav'
    epic = options.epic
    bed = options.bed if options.bed is not None else (0.12 if epic else 0.08)
    if not np.isfinite(bed) or not 0 <= bed <= 0.5:
        raise SystemExit('--bed must be a finite number in 0..0.5')

    if epic:
        total = int(round(tl['total_frames'] / project.fps * SR))
        narr = np.zeros((total, 2))
        source = None
    else:
        audio_file = pathlib.Path(a_dir) / 'audio.wav'
        if not os.path.exists(raw_path):
            if not options.adopt_legacy:
                raise SystemExit('缺 audio_narration.wav：请重跑 TTS；确认 audio.wav 是纯旁白时才用 --adopt-legacy。')
            if pathlib.Path(mix_path).with_suffix('.mix.json').exists():
                raise SystemExit('旁白正本缺失，禁止把已有混音当正本：请重跑 TTS。')
            source = str(project.path(audio_file))
        else:
            source = str(project.path(raw_path))

        decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(project.path(source)), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                                 capture_output=True, check=True).stdout
        narr = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2).astype(np.float64)
        if len(narr) == 0 or not np.all(np.isfinite(narr)):
            raise SystemExit('Narration is empty or contains invalid samples')
        total = len(narr)
        project.validate_audio(narr, SR, tl)

    music_plan = pathlib.Path(a_dir) / 'music_plan.json'
    bgm_single = next((f'{a_dir}/{name}' for name in ('bgm.wav', 'bgm.mp3') if os.path.exists(f'{a_dir}/{name}')), None)
    music_tracks_log = []

    if music_plan.exists():
        if bgm_single:
            print(f'提示：music_plan.json 存在，单曲 {bgm_single} 忽略（编排表优先）')
        plan = json.loads(music_plan.read_text(encoding='utf-8'))
        bgm = _render_music_plan(plan, total, bed, a_dir, root, music_tracks_log)
    elif bgm_single:
        bgm = loop_with_crossfade(_decode_stereo(project.path(bgm_single)), total, SR, xfade_s=1.5)
        rms = float(np.sqrt(np.mean(bgm ** 2)))
        if rms > 1e-6:
            bgm *= min(BGM_SCALE_CAP, bed / rms)
        positions = np.arange(total, dtype=np.float64)
        fade_in_n = max(1, min(int(round(1.5 * SR)), total // 4))
        fade_out_n = max(1, min(int(round(3.5 * SR)), total // 3))
        fin = 0.5 - 0.5 * np.cos(math.pi * np.clip(positions / fade_in_n, 0.0, 1.0))
        fout = 0.5 - 0.5 * np.cos(math.pi * np.clip((total - 1 - positions) / fade_out_n, 0.0, 1.0))
        bgm *= (fin * fout)[:, None]
        music_tracks_log.append({'track': str(bgm_single), 'mode': 'single'})
    else:
        bgm = np.zeros((total, 2), dtype=np.float64)

    if not epic:
        duck_env = compute_speech_duck_envelope(np.mean(narr, axis=1), SR)
        bgm = apply_spectral_ducking(bgm, duck_env, SR)

    fps = project.fps
    chs = tl.get('chapters') or []
    starts = [c['from'] for c in chs] or [1]
    ends = [c['from'] - 14 for c in chs[1:]] + [tl['total_frames'] - 14]
    sfx = np.zeros_like(narr)

    def put(cue_f, buf):
        i0 = max(0, int(round((cue_f - 1) / fps * SR)))
        i1 = min(i0 + len(buf), total)
        if i0 < total:
            sfx[i0:i1] += buf[:i1 - i0]

    pour_buf, wipe_buf = _pour(), _wipe()
    if options.sfx == 'sand':
        for f in starts:
            put(f, pour_buf)
        for f in ends:
            put(f, wipe_buf)

    mix = narr + bgm + sfx
    peak = float(np.max(np.abs(mix)))
    if peak > 0.95:
        mix *= 0.95 / peak
    project.preflight_audio(raw_path, mix_path, pathlib.Path(mix_path).with_suffix('.mix.json'))
    project.mkdir(a_dir)
    if not epic and not project.path(raw_path).exists():
        project.copy(source, raw_path)
    wavfile.write(str(project.path(mix_path)), SR, (mix * 32767).astype(np.int16))

    def digest(file):
        h = hashlib.sha256()
        with open(project.path(file), 'rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                h.update(block)
        return h.hexdigest()

    manifest = {'schema_version': 1, 'epic': epic, 'narration_sha256': None if epic else digest(raw_path),
                'music_sha256': digest(bgm_single) if (bgm_single and not music_plan.exists()) else None,
                'music_plan_sha256': digest(music_plan) if music_plan.exists() else None,
                'music': ('music_plan' if music_plan.exists() else ('single' if bgm_single else 'none')),
                'music_tracks': music_tracks_log,
                'output_sha256': digest(mix_path), 'sample_rate': SR,
                'channels': 2, 'duration_seconds': total / SR, 'bed': bed,
                'sfx': options.sfx, 'ducking': 'spectral_850_3600_asymmetric', 'peak': float(np.max(np.abs(mix)))}
    project.write_text(pathlib.Path(mix_path).with_suffix('.mix.json'), json.dumps(manifest, indent=2) + '\n')
    if project.legacy:
        project.save_total(tl['total_frames'])
    print(f'mix ok: {total / SR:.1f}s, peak {peak:.2f} → {mix_path}')


if __name__ == '__main__':
    main()
