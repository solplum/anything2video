#!/usr/bin/env python3
"""三层混音：旁白正本 audio_narration.wav + 可选 BGM/音效 → 派生 audio.wav。
用法：uv run python scripts/mix_audio.py [--epic] [--bed 0.055] [--sfx none|sand]
- --epic（epic 无旁白口径，recipes/epic.md §6）：旁白轨为零、片长从 script/timeline.json 读（chapter_timeline.py 产出）、
  响度床缺省 0.12（无旁白压制，音乐可给更大空间）；其余流程同标准模式
- 旁白正本：TTS 同时写 audio_narration.wav；混音只读正本，禁止按 mtime 回拷混音。
  --adopt-legacy 显式迁移旧工程 audio.wav；已有 mix.json 时正本缺失必须重跑 TTS。
- BGM 二模式：①音乐编排表 audio/music_plan.json（v4.2.0，多段接力：逐段[曲/曲内进出点/视频落位/
  crossfade]，schema 与纪律见 reference/music-plan.md，主题反查提名用 scripts/bgm_query.py）——
  逐段解码→**段级 RMS 归一到响度床**→段内淡入淡出→重叠区等功率 crossfade（crossfade 必须覆盖
  重叠区，硬校验 fail fast）；②单曲 bgm.wav（向后兼容，原行为一字不动）：解码 → 裁/循环到片长 →
  **RMS 归一到目标响度床**（固定小增益会"混了但听不见"，教训见 lessons）→ 2s 淡入 4s 淡出。
  编排表存在时优先生效、忽略 bgm.wav 并提示。
- 音效：默认关闭；--sfx sand 显式启用章节铺沙/扫掠。旁白期间音乐平滑降低 7dB。
- 依赖：numpy scipy（低通/带通滤波）；ffmpeg 解码音频
"""
import argparse, hashlib, json, os, pathlib, subprocess, sys
import numpy as np
from audio_project import AudioProject
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, lfilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--epic', action='store_true')
parser.add_argument('--bed', type=float)
parser.add_argument('--sfx', choices=('none', 'sand'), default='none')
parser.add_argument('--adopt-legacy', action='store_true')
parser.add_argument('--legacy-config', action='store_true')
parser.add_argument('--fps', type=int)
options = parser.parse_args()
try:
    PROJECT = AudioProject(ROOT, options.legacy_config, options.fps)
    SLUG = PROJECT.slug
    A_DIR = PROJECT.path(PROJECT.assets)
    PROJECT.preflight_audio(A_DIR)
    _tl = PROJECT.timeline()
except (ValueError, OSError) as error:
    raise SystemExit(f'[mix_audio] {error}') from None
RAW = f'{A_DIR}/audio_narration.wav'   # 与 SKILL.md / promo.md / orchestration §6 统一口径（旧名 narration_raw.wav 已废）
MIX = f'{A_DIR}/audio.wav'
SR = 48000
# 响度床双档（按片况选）：0.08 标准=音乐可闻不压旁白；0.055 保守=旁白密集/信息优先；0.12 epic=无旁白压制。用法：--bed 0.055
EPIC = options.epic
BED = options.bed if options.bed is not None else (0.12 if EPIC else 0.08)
TARGET_BGM_RMS = BED
if not np.isfinite(BED) or not 0 <= BED <= 0.5:
    raise SystemExit('--bed must be a finite number in 0..0.5')
BGM_SCALE_CAP = 8.0
SFX_GAIN = {'pour': 0.15, 'wipe': 0.10}

if EPIC:
    # epic 无旁白（recipes/epic.md §6）：旁白轨为零，片长锚 timeline.json（chapter_timeline.py 产出）
    total = int(round(_tl['total_frames'] / PROJECT.fps * SR))
    narr = np.zeros((total, 2))
else:
    _audio = pathlib.Path(A_DIR) / 'audio.wav'
    if not os.path.exists(RAW):
        if not options.adopt_legacy:
            raise SystemExit('缺 audio_narration.wav：请重跑 TTS；确认 audio.wav 是纯旁白时才用 --adopt-legacy。')
        if pathlib.Path(MIX).with_suffix('.mix.json').exists():
            raise SystemExit('旁白正本缺失，禁止把已有混音当正本：请重跑 TTS。')
        source = str(PROJECT.path(_audio))
    else:
        source = str(PROJECT.path(RAW))

    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(PROJECT.path(source)), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout
    narr = np.frombuffer(decoded, dtype='<f4').reshape(-1, 2).astype(np.float64)
    if len(narr) == 0 or not np.all(np.isfinite(narr)):
        raise SystemExit('Narration is empty or contains invalid samples')
    total = len(narr)
    PROJECT.validate_audio(narr, SR, _tl)

# BGM：音乐编排表（多段接力）优先，回退单曲
MUSIC_PLAN = pathlib.Path(A_DIR) / 'music_plan.json'
_bgm = next((f'{A_DIR}/{_n}' for _n in ('bgm.wav', 'bgm.mp3') if os.path.exists(f'{A_DIR}/{_n}')), None)
music_tracks_log = []

def _decode_stereo(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    data = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
    if len(data) == 0 or not np.all(np.isfinite(data)):
        raise SystemExit(f'音轨为空或含非法采样：{path}')
    return data

def _track_duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        raise SystemExit(f'ffprobe 无法读取时长：{path}') from None

def _resolve_track(name):
    for candidate in (pathlib.Path(A_DIR) / name, pathlib.Path(ROOT) / 'assets' / 'audio' / 'bgm' / name,
                      pathlib.Path(name)):
        if candidate.exists():
            return candidate
    raise SystemExit(f'music_plan: 找不到音轨 {name}（查工程 {A_DIR} 与 skill 曲库 assets/audio/bgm）')

def _render_music_plan(plan, total):
    """逐 cue 渲染：解码→曲内裁切→段级 RMS 归一→段内淡入淡出→重叠区等功率 crossfade。
    校验 fail fast：字段完整/曲内范围合法/落位不越片长/时长一致/排序/交叉淡化覆盖重叠区。"""
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
        path = _resolve_track(str(cue['track']))
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
            seg *= min(BGM_SCALE_CAP, TARGET_BGM_RMS / seg_rms)
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

if MUSIC_PLAN.exists():
    if _bgm:
        print(f'提示：music_plan.json 存在，单曲 {_bgm} 忽略（编排表优先）')
    plan = json.loads(MUSIC_PLAN.read_text(encoding='utf-8'))
    bgm = _render_music_plan(plan, total)
elif _bgm:
    bgm = _decode_stereo(PROJECT.path(_bgm))
    while len(bgm) < total:
        bgm = np.concatenate([bgm, bgm])
    bgm = bgm[:total]
    rms = float(np.sqrt(np.mean(bgm ** 2)))
    if rms > 1e-6:
        bgm *= min(BGM_SCALE_CAP, TARGET_BGM_RMS / rms)
    _positions = np.arange(total)
    _fade = np.minimum(1, _positions / (2 * SR)) * np.minimum(1, (total - 1 - _positions) / (4 * SR))
    bgm *= _fade[:, None]
    music_tracks_log.append({'track': str(_bgm), 'mode': 'single'})
else:
    bgm = np.zeros((total, 2), dtype=np.float64)

# 旁白能量驱动平滑压低音乐；无旁白的 epic 保持音乐床。
if not EPIC:
    envelope = np.sqrt(np.maximum(0, uniform_filter1d(np.mean(narr ** 2, axis=1), int(SR * 0.05))))
    activity = uniform_filter1d(np.clip((envelope - 0.006) / 0.035, 0, 1), int(SR * 0.15))
    bgm *= (1 - activity * (1 - 10 ** (-7 / 20)))[:, None]

# 音效（numpy 程序合成）
def lowpass(x, cutoff, order=4):
    b, a = butter(order, cutoff / (SR / 2), btype='low')
    return lfilter(b, a, x)

def pour(dur_s=1.1):
    """铺沙：双重低通噪声 + 缓起缓落（沙瀑感，去静电）"""
    n = int(dur_s * SR)
    x = np.random.default_rng(7).standard_normal(n)
    x = lowpass(lowpass(x, 650), 650)
    env = np.minimum(np.arange(n) / (0.35 * SR), 1.0) * np.exp(-np.linspace(0, 3.6, n))
    return (x * env)[:, None] * SFX_GAIN['pour']

def wipe(dur_s=0.55):
    """扫掠：700–3200Hz 带通气流（抹沙/转场）"""
    n = int(dur_s * SR)
    x = np.random.default_rng(11).standard_normal(n)
    x = lowpass(x, 3200)
    b, a = butter(4, 700 / (SR / 2), btype='high')
    x = lfilter(b, a, x)
    return (x * np.sin(np.linspace(0, np.pi, n)) ** 2.0)[:, None] * SFX_GAIN['wipe']

tl = _tl
FPS = PROJECT.fps
_chs = tl.get('chapters') or []
starts = [c['from'] for c in _chs] or [1]
ends = [c['from'] - 14 for c in _chs[1:]] + [tl['total_frames'] - 14]
sfx = np.zeros_like(narr)
def put(cue_f, buf):
    i0 = max(0, int(round((cue_f - 1) / FPS * SR)))
    i1 = min(i0 + len(buf), total)
    if i0 < total:
        sfx[i0:i1] += buf[:i1 - i0]
pour_buf, wipe_buf = pour(), wipe()
# 沙音只由显式 preset 启用，其他视觉语言不自动注入。
if options.sfx == 'sand':
    for f in starts:
        put(f, pour_buf)
    for f in ends:
        put(f, wipe_buf)

mix = narr + bgm + sfx
peak = float(np.max(np.abs(mix)))
if peak > 0.95:
    mix *= 0.95 / peak
PROJECT.preflight_audio(RAW, MIX, pathlib.Path(MIX).with_suffix('.mix.json'))
PROJECT.mkdir(A_DIR)
if not EPIC and not PROJECT.path(RAW).exists():
    PROJECT.copy(source, RAW)
wavfile.write(str(PROJECT.path(MIX)), SR, (mix * 32767).astype(np.int16))
def digest(file):
    h = hashlib.sha256()
    with open(PROJECT.path(file), 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()
manifest = {'schema_version': 1, 'epic': EPIC, 'narration_sha256': None if EPIC else digest(RAW),
            'music_sha256': digest(_bgm) if (_bgm and not MUSIC_PLAN.exists()) else None,
            'music_plan_sha256': digest(MUSIC_PLAN) if MUSIC_PLAN.exists() else None,
            'music': ('music_plan' if MUSIC_PLAN.exists() else ('single' if _bgm else 'none')),
            'music_tracks': music_tracks_log,
            'output_sha256': digest(MIX), 'sample_rate': SR,
            'channels': 2, 'duration_seconds': total / SR, 'bed': BED,
            'sfx': options.sfx, 'peak': float(np.max(np.abs(mix)))}
PROJECT.write_text(pathlib.Path(MIX).with_suffix('.mix.json'), json.dumps(manifest, indent=2) + '\n')
if PROJECT.legacy:
    PROJECT.save_total(tl['total_frames'])
print(f'mix ok: {total / SR:.1f}s, peak {peak:.2f} → {MIX}')
