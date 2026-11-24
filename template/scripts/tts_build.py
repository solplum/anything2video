#!/usr/bin/env python3
"""配音 + 时间轴生成。项目根 = 本脚本所在 scripts/ 的上级目录。
输入 narration.txt：
  # CHAPTER <n> <标题>      章节标记（章节前自动加 chapter_gap 帧空白）
  ## gap <帧数>             在下一句前额外插入空白帧
  ## swell                  音乐呼吸停顿标记（等价 ## gap 42）
  一句话|按竖线分成字幕短句            → 竖线只切字幕，不影响朗读
                                       每块预算：中文 ≤16 字 / 英文 ≤48 字符（超了会打 ⚠ 并自动缩字号）
                                       块首尾空格会去掉；英文片把块用空格拼回整句给 TTS（"a|b" 与 "a | b" 等价），中文直接拼接
  @EN: English line                  → 双语字幕：对照语言挂上一句（@EN/@CN 均可，谁不是旁白语言谁当对照），subs.ts 输出对应字段；config.subs='bilingual' 时渲染两行
  句中写 {#id}                       → 语义锚点（id 匹配 ^[a-z][a-z0-9_-]{0,39}$），放在被锚定字之前；生成 src/common/anchors.ts 供 at()/span()/local() 定位
输出：
  public/assets/<slug>/audio.wav（48k 立体声 16bit；slug/fps 读 project.json）
  script/timeline.json / timeline.md
  src/common/subs.ts（字幕表）、src/common/timeline.ts（TOTAL_FRAMES / CHAPTER_STARTS / SENTENCES）、src/common/anchors.ts（ANCHOR_FRAMES）
逐句（或逐字幕块）缓存于 audio/cache/，改一句只重合成一句。

TTS 引擎（`TTS_ENGINE`，默认 `auto` = 有 `MINIMAX_API_KEY` 时选 `minimax`，否则 `edge`；**跑之前先问用户有没有偏好的 TTS**——按 SKILL.md 基准确认点 3 叠加所选配方 §确认点差异执行，如 promo 已删除独立确认点、并入确认点 ① 一句话带过，用户在 ① 给过偏好就照办）：
  minimax  `MINIMAX_API_KEY` 已设时的默认。按同章无间隔连续句（≤1500 字）整块调 MiniMax `/v1/t2a_v2`
           （`MINIMAX_TTS_MODEL=speech-2.6-hd`，中文 `MINIMAX_VOICE=Chinese (Mandarin)_Reliable_Executive`，
           英文 `MINIMAX_EN_VOICE=English_Trustworthy_Man`，`MINIMAX_SPEED=1.0`），44.1kHz FLAC + 词级 `subtitle_file` 自动切句。
  edge     云端回退（zh `VOICE=zh-CN-YunyangNeural RATE=+2%`，en `EDGE_EN_VOICE=en-US-ChristopherNeural RATE=+0%`），词级边界。
  kokoro   仅显式传 `TTS_ENGINE=kokoro` 时启用（本地推理，无词边界，逐块拼接；auto 不再尝试导入 kokoro）。
  语音后处理（`VOICE_FX`，tts_build 默认 `on`）：80Hz HPF → -20dBFS 2.5:1 RMS 压缩 → 5-9kHz 齿音抑制 → -18 LUFS 响度归一 → -1.5 dBFS 真峰值限幅（≤-1.0 dBTP）。
  用户自带成品配音 wav 时走 scripts/align_narration.py 自动能量停顿对齐，免手填 timeline.ts 与 subs.ts。
其它参数与环境变量：PROSODY_MODE（natural|fixed）、GAP/CHAPTER_GAP/LEAD/TAIL（帧）、--beat-grid / --no-beat-align。
已有旁白正本必须 --force 才能重生成。缺 project.json 时仅 --legacy-config --fps 允许显式迁移。
"""
import argparse, asyncio, hashlib, json, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
import numpy as np
from pathlib import Path
from audio_project import AudioProject
from narration_lib import (
    SR,
    align_bounds,
    detect_lang,
    find_pauses,
    fix_subtitles,
    parse,
    write_artifacts,
    write_wav,
)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = None
SLUG = FPS = None
CFG_LANG = 'zh'
ENGINE = os.environ.get('TTS_ENGINE', 'auto')
VOICE = os.environ.get('VOICE', 'zh-CN-YunyangNeural')
RATE = os.environ.get('RATE', '+2%')
MINIMAX_API_KEY = os.environ.get('MINIMAX_API_KEY', '').strip()
MINIMAX_API_HOST = os.environ.get('MINIMAX_API_HOST', 'https://api.minimaxi.com').rstrip('/')
MINIMAX_GROUP_ID = os.environ.get('MINIMAX_GROUP_ID', '').strip()
MINIMAX_TTS_MODEL = os.environ.get('MINIMAX_TTS_MODEL', 'speech-2.6-hd')
MINIMAX_VOICE = os.environ.get('MINIMAX_VOICE', '')
MINIMAX_EN_VOICE = os.environ.get('MINIMAX_EN_VOICE', 'English_Trustworthy_Man')
MINIMAX_SPEED = float(os.environ.get('MINIMAX_SPEED', '1.0'))
MINIMAX_BLOCK_MAX_CHARS = 1500
VOICE_FX = os.environ.get('VOICE_FX', 'on').strip().lower()
if VOICE_FX not in ('on', 'off'):
    raise SystemExit(f'未知 VOICE_FX={VOICE_FX}（可选 on / off）')
PROSODY_MODE = os.environ.get('PROSODY_MODE', 'natural')
if PROSODY_MODE not in ('natural', 'fixed'):
    raise SystemExit(f'未知 PROSODY_MODE={PROSODY_MODE}（可选 natural / fixed）')
# edge-tts 云端限流（连续请求会被拒、返回空音频）：重试次数 / 退避基数秒 / 句间隔秒
EDGE_RETRIES = int(os.environ.get('EDGE_RETRIES', 4))
EDGE_RETRY_DELAY = float(os.environ.get('EDGE_RETRY_DELAY', 1.5))
EDGE_DELAY = float(os.environ.get('EDGE_DELAY', 0.6))
KOKORO_VOICE = os.environ.get('KOKORO_VOICE', 'am_liam')
KOKORO_LANG = os.environ.get('KOKORO_LANG', 'a')       # a=American English, b=British
KOKORO_SPEED = float(os.environ.get('KOKORO_SPEED', 1.0))
KOKORO_SR = 24000
CHUNK_PAD = float(os.environ.get('CHUNK_PAD', 0.06))  # 无词边界引擎：块间静音秒
GAP = int(os.environ.get('GAP', 10))          # 句间空白帧
CHAPTER_GAP = int(os.environ.get('CHAPTER_GAP', 45))  # 章节前空白帧
LEAD = int(os.environ.get('LEAD', 40))        # 片头静音帧
TAIL = int(os.environ.get('TAIL', 90))        # 片尾静音帧
CACHE = f'{ROOT}/audio/cache'
if ENGINE not in ('auto', 'minimax', 'edge', 'kokoro'):
    raise SystemExit(f'未知 TTS_ENGINE={ENGINE}（可选 auto / minimax / edge / kokoro）')


def cache_path(text, ext, sig_prefix=None):
    sig = sig_prefix or f'{ENGINE}|{VOICE}|{RATE}|{KOKORO_VOICE}|{KOKORO_LANG}|{KOKORO_SPEED}'
    p = os.path.join(CACHE, hashlib.sha1(f'{sig}|{text}'.encode()).hexdigest()[:16] + ext)
    return str(PROJECT.path(p))


async def synth_edge(text, retries=None, base_delay=None):
    """edge-tts：整句合成 + 词级边界（会把 text 发送到微软云端端点）。

    云端有速率限制：连续快速请求会返回空音频（edge_tts 抛 NoAudioReceived）。
    2026-09-10 实测：29 句的片子跑到第 7 句起大面积失败，而脚本原先既无重试也无句间隔 → 整批作废。
    现在带指数退避重试，main 循环还会在句间留 EDGE_DELAY；已成功的句子走缓存，重跑不会重复合成。"""
    import edge_tts
    from pathlib import Path
    retries = EDGE_RETRIES if retries is None else retries
    base_delay = EDGE_RETRY_DELAY if base_delay is None else base_delay
    mp3 = Path(cache_path(text, '.mp3')); js = Path(cache_path(text, '.json'))
    if mp3.exists() and js.exists():
        return str(PROJECT.path(mp3)), json.loads(PROJECT.path(js).read_text(encoding='utf-8'))
    last = None
    for attempt in range(retries):
        try:
            # boundary 必须显式传 'WordBoundary'：edge-tts 7.2.8 默认 SentenceBoundary（整句一条事件、零词边界），
            # 词级点亮的 chars 会退化成块起始帧平铺（2026-10-07 live 复验实锤，见 docs/optimization-v3.9.md）
            comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary='WordBoundary')
            audio = bytearray(); words = []
            async for ch in comm.stream():
                if ch['type'] == 'audio':
                    audio += ch['data']
                elif ch['type'] == 'WordBoundary':
                    words.append({'t': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7, 'text': ch['text']})
            if not audio:
                raise RuntimeError('云端返回空音频')
            PROJECT.write_bytes(mp3, bytes(audio))
            PROJECT.write_text(js, json.dumps(words, ensure_ascii=False))
            if attempt:
                print(f'    ↻ 第 {attempt + 1} 次重试成功：{text[:22]}')
            return str(mp3), words
        except Exception as e:
            last = e
            if attempt < retries - 1:
                d = base_delay * (2 ** attempt)
                print(f'    ⚠ {type(e).__name__}，{d:.1f}s 后重试 {attempt + 2}/{retries}：{text[:22]}')
                await asyncio.sleep(d)
    raise SystemExit(
        f'edge-tts 连续 {retries} 次未取到音频（最后错误：{last}）\n'
        f'  失败句：{text}\n'
        f'  多半是云端限流：等几分钟重跑即可（成功句有缓存，不会重合成）；\n'
        f'  也可调大 EDGE_RETRIES（重试次数）/ EDGE_RETRY_DELAY（退避基数秒）/ EDGE_DELAY（句间隔秒）')


_kokoro = None


def synth_kokoro(text):
    """kokoro-82m：本地推理，24kHz，无词边界。"""
    global _kokoro
    au = cache_path(text, '.wav')
    if os.path.exists(au):
        return au
    if _kokoro is None:
        try:
            from kokoro import KPipeline
        except ImportError:
            raise SystemExit('TTS_ENGINE=kokoro 需要 kokoro 包；但 PyPI 当前版本 0.7.16 钉死 numpy==1.26.4（py3.12+ 无 wheel）'
                             '且要求的 misaki>=0.7.16 不存在，一般装不上。英文请改用 TTS_ENGINE=edge + VOICE=en-US-ChristopherNeural')
        _kokoro = KPipeline(lang_code=KOKORO_LANG)
    parts = []
    for r in _kokoro(text, voice=KOKORO_VOICE, speed=KOKORO_SPEED):
        a = getattr(r, 'audio', None)
        if a is None:
            a = r[2]                                    # 旧版 yield (graphemes, phonemes, audio)
        if hasattr(a, 'detach'):
            a = a.detach().cpu().numpy()                # torch tensor
        parts.append(np.asarray(a, dtype=np.float32).reshape(-1))
    if not parts:
        raise SystemExit(f'kokoro 没有产出音频：{text[:24]}…')
    write_wav(au, np.concatenate(parts), KOKORO_SR)
    return au


def decode(mp3):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(PROJECT.path(mp3)), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def trim_edges(x, thr=0.004):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x, 0.0
    a = max(0, idx[0] - int(0.03 * SR)); b = min(len(x), idx[-1] + int(0.12 * SR))
    seg = np.array(x[a:b], dtype=np.float32, copy=True)
    fi = min(int(0.015 * SR), len(seg) // 4)
    fo = min(int(0.035 * SR), len(seg) // 4)
    if fi > 1:
        seg[:fi] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(fi, dtype=np.float32) / fi))
    if fo > 1:
        seg[-fo:] *= (0.5 + 0.5 * np.cos(np.pi * np.arange(fo, dtype=np.float32) / fo))
    return seg, a / SR


_CONTRAST_MARKERS = ('但是', '然而', '其实', '关键', '为什么', '那么', '不过', '相反', 'But ', 'However', 'Why ', 'Yet ')
_TRAILING_CLOSERS = '”"\'’）)]」』】'
_LEADING_OPENERS = '“"\'‘（([「『【'


def _discourse_role(prev_text, next_text=None):
    tail = (prev_text or '').strip().rstrip(_TRAILING_CLOSERS)
    head = (next_text or '').strip().lstrip(_LEADING_OPENERS)
    if tail.endswith(('！', '!')):
        return 'climax'
    if tail.endswith(('？', '?', '…', '...')) or head.startswith(_CONTRAST_MARKERS):
        return 'accent'
    if tail.endswith(('，', ',', '：', ':', '；', ';', '—')):
        return 'continue'
    return 'period'


def semantic_gap_frames(prev_text, next_text, base_gap, mode='natural'):
    """Semantic pause sizing between adjacent sentences; preserves base_gap==0 or fixed mode."""
    base = max(0, int(base_gap))
    if mode == 'fixed' or base == 0 or not prev_text or not next_text:
        return base
    role = _discourse_role(prev_text, next_text)
    if role == 'climax':
        return round(base * 2.6)
    if role == 'accent':
        return round(base * 1.8)
    if role == 'continue':
        return max(4, round(base * 0.6))
    return round(base * 1.0)


def quantize_sentence_start(t_sec, role, beats_s, downbeats_s, pocket_s=0.0):
    """Nudge sentence onset forward to align cleanly with musical downbeats or beats."""
    if not beats_s and not downbeats_s:
        return float(t_sec)
    t_sec = float(t_sec)
    beat_interval = float(np.median(np.diff(beats_s))) if len(beats_s) >= 2 else 0.5
    if role == 'chapter_open':
        pool = downbeats_s if downbeats_s else beats_s
        max_nudge = min(0.85, max(0.25, beat_interval * 2.0))
    elif role == 'accent':
        pool = beats_s if beats_s else downbeats_s
        max_nudge = 0.36
    else:
        return t_sec
    for b in pool:
        b = float(b)
        if b < t_sec - 1e-6:
            continue
        candidate = b + float(pocket_s)
        if candidate < t_sec:
            candidate = b
        if candidate - t_sec <= max_nudge + 1e-6:
            return candidate
        break
    return t_sec


_ZH_END_PUNCT = tuple('。！？!?…；;')
_EN_END_PUNCT = tuple('.!?…;:')
_PURE_PUNCT_RE = re.compile(r'^[\s，。、！？：；“”（）,.!?:;()\-—…"\'’‘]+$')


def synth_minimax(block_text, voice_id, speed=None, retries=None, base_delay=None):
    """MiniMax /v1/t2a_v2：整块合成（44.1kHz FLAC）+ 词级 subtitle_file。"""
    retries = EDGE_RETRIES if retries is None else retries
    base_delay = EDGE_RETRY_DELAY if base_delay is None else base_delay
    speed = MINIMAX_SPEED if speed is None else float(speed)
    sig_prefix = f'minimax|{MINIMAX_TTS_MODEL}|{voice_id}|{speed}'
    flac = Path(cache_path(block_text, '.flac', sig_prefix=sig_prefix))
    js = Path(cache_path(block_text, '.json', sig_prefix=sig_prefix))
    if flac.exists() and js.exists():
        return str(PROJECT.path(flac)), json.loads(PROJECT.path(js).read_text(encoding='utf-8')), True

    if not MINIMAX_API_KEY:
        raise SystemExit('TTS_ENGINE=minimax 需要环境变量 MINIMAX_API_KEY')
    url = f'{MINIMAX_API_HOST}/v1/t2a_v2'
    if MINIMAX_GROUP_ID:
        url += f'?GroupId={urllib.parse.quote(MINIMAX_GROUP_ID)}'
    payload = json.dumps({
        'model': MINIMAX_TTS_MODEL,
        'text': block_text,
        'stream': False,
        'subtitle_enable': True,
        'subtitle_type': 'word',
        'voice_setting': {'voice_id': voice_id, 'speed': speed, 'vol': 1.0, 'pitch': 0},
        'audio_setting': {'sample_rate': 44100, 'format': 'flac', 'channel': 1},
    }, ensure_ascii=False).encode('utf-8')
    headers = {
        'Authorization': f'Bearer {MINIMAX_API_KEY}',
        'Content-Type': 'application/json',
    }
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=payload, headers=headers, method='POST')
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = json.loads(resp.read().decode('utf-8'))
            base_resp = body.get('base_resp') or {}
            if base_resp.get('status_code', 0) != 0:
                code = base_resp.get('status_code')
                msg = base_resp.get('status_msg', '')
                raise RuntimeError(f'MiniMax status_code={code}: {msg}')
            data = body.get('data') or {}
            audio_hex = data.get('audio') or ''
            if not audio_hex:
                raise RuntimeError('MiniMax 返回空音频')
            audio_bytes = bytes.fromhex(audio_hex)
            sub_url = data.get('subtitle_file') or ''
            if not sub_url:
                raise RuntimeError('MiniMax 未返回 subtitle_file')
            with urllib.request.urlopen(sub_url, timeout=60) as sresp:
                subs_raw = sresp.read().decode('utf-8')
            subs = json.loads(subs_raw)
            if not isinstance(subs, list):
                raise RuntimeError('MiniMax subtitle_file 格式非列表')
            PROJECT.write_bytes(flac, audio_bytes)
            PROJECT.write_text(js, json.dumps(subs, ensure_ascii=False))
            return str(flac), subs, False
        except urllib.error.HTTPError as e:
            last = e
            if e.code != 429 and 400 <= e.code < 500:
                raise SystemExit(f'MiniMax 请求失败 HTTP {e.code}：{block_text[:30]}') from None
            if attempt < retries - 1:
                time.sleep(base_delay * (2 ** attempt))
        except Exception as e:
            last = e
            if attempt < retries - 1:
                d = base_delay * (2 ** attempt)
                print(f'    ⚠ MiniMax {type(e).__name__}，{d:.1f}s 后重试 {attempt + 2}/{retries}：{block_text[:22]}')
                time.sleep(d)
    raise SystemExit(f'MiniMax 连续 {retries} 次未取到音频（最后错误：{last}）：{block_text[:40]}')


def build_minimax_blocks(items, lang, sep='', max_chars=MINIMAX_BLOCK_MAX_CHARS):
    """按同章 + 无显式停顿 + <=max_chars 将连续句子合并为 MiniMax 合成块。"""
    blocks = []
    cur = None
    end_p = _ZH_END_PUNCT if lang == 'zh' else _EN_END_PUNCT
    joiner = '' if lang == 'zh' else ' '
    for idx_item, it in enumerate(items):
        if it['type'] == 'chapter':
            cur = None
            continue
        chunks = [c.strip() for c in it['raw'].split('|') if c.strip()]
        if not chunks:
            continue
        tts_text = sep.join(chunks)
        tail = tts_text.strip().rstrip(_TRAILING_CLOSERS)
        pad = '' if tail.endswith(end_p) else ('。' if lang == 'zh' else '.')
        s_aug = tts_text + pad
        if (
            cur is None
            or it['gap_before'] > 0
            or it['chapter'] != cur['chapter']
            or len(cur['text']) + len(joiner) + len(s_aug) > max_chars
        ):
            cur = {'chapter': it['chapter'], 'text': '', 'sents': []}
            blocks.append(cur)
        elif cur['sents']:
            cur['text'] += joiner
        start_char = len(cur['text'])
        cur['text'] += s_aug
        cur['sents'].append({
            'item_idx': idx_item,
            'chunks': chunks,
            'tts_text': tts_text,
            'char_start': start_char,
            'char_end': start_char + len(tts_text),
        })
    return blocks


def extract_minimax_block_words(block_text, segments):
    """解析并校验 MiniMax subtitle_file，统一转为相对 block_text 的词级时间戳（秒）。"""
    words = []
    for seg_idx, seg in enumerate(segments or []):
        sb = int(seg.get('text_begin') or 0)
        seg_t0 = float(seg.get('time_begin') or 0.0)
        seg_valid = []
        for w in seg.get('timestamped_words') or []:
            word = w.get('word') or ''
            if not word or _PURE_PUNCT_RE.match(word):
                continue
            wb = w.get('word_begin')
            we = w.get('word_end')
            if wb is None or we is None:
                continue
            wb = int(wb); we = int(we)
            g0, g1 = sb + wb, sb + we
            if 0 <= g0 < g1 <= len(block_text) and block_text[g0:g1] == word:
                span = (g0, g1)
            elif 0 <= wb < we <= len(block_text) and block_text[wb:we] == word:
                span = (wb, we)
            else:
                continue
            seg_valid.append((span[0], span[1], float(w['time_begin']), float(w['time_end']), word))
        t_shift_ms = 0.0
        if seg_idx > 0 and seg_valid and seg_valid[0][2] < seg_t0 - 50.0:
            t_shift_ms = seg_t0
        for g0, g1, tb_ms, te_ms, word in seg_valid:
            tb = (tb_ms + t_shift_ms) / 1000.0
            te = (te_ms + t_shift_ms) / 1000.0
            words.append({
                'g0': g0,
                'g1': g1,
                't': tb,
                'd': max(0.0, te - tb),
                'text': word,
            })
    words.sort(key=lambda item: (item['g0'], item['t']))
    prev_t = 0.0
    for w in words:
        w['t'] = max(w['t'], prev_t)
        prev_t = w['t']
    return words


def chunk_starts(tts_text, chunks, words, lead_cut, dur, sep=''):
    """按 | 切出的字幕短句 → (每块起始秒, 每块逐字符起始秒)。word 边界按字符游标对到原句。
    tts_text == sep.join(chunks)：英文 sep=' '，游标要跳过块间的那个空格。
    逐字符秒（词级点亮字幕 SubEntry.chars 的底料）：无词边界的字符（标点/未匹配）继承前一个有边界字符。"""
    dur_ceil = max(0.0, dur - 1e-4)
    # 每个字符的起始时间（按 word 边界填充）
    char_t = [None] * len(tts_text)
    cur = 0
    for w in words:
        if 'c0' in w and 'c1' in w:
            p0 = int(w['c0']); p1 = min(len(tts_text), int(w['c1']))
            if 0 <= p0 < p1:
                t_rel = max(0.0, min(dur_ceil, float(w['t']) - lead_cut))
                for i in range(p0, p1):
                    char_t[i] = (t_rel, w['d'])
                cur = max(cur, p1)
            continue
        wt = re.sub(r'[\s，。、！？：；“”（）,.!?:;()\-—…]', '', w['text'])
        if not wt:
            continue
        p = tts_text.find(wt, cur)
        if p < 0:
            p = tts_text.find(wt[0], cur)
            if p < 0:
                continue
        for i in range(p, min(len(tts_text), p + len(wt))):
            char_t[i] = (max(0.0, min(dur_ceil, w['t'] - lead_cut)), w['d'])
        cur = p + len(wt)
    # 每块首字时间
    starts = []
    pos = 0
    for c in chunks:
        st = None
        for i in range(pos, pos + len(c)):
            if char_t[i] is not None:
                st = char_t[i][0]; break
        starts.append(st)
        pos += len(c) + len(sep)
    starts[0] = 0.0
    # 兜底：无边界的块按前后已知边界区间内字符数比例单调插值
    n_chunks = len(starts)
    i = 0
    while i < n_chunks:
        if starts[i] is None:
            j = i + 1
            while j < n_chunks and starts[j] is None:
                j += 1
            t_prev = starts[i - 1]
            t_next = max(t_prev, starts[j]) if j < n_chunks else dur
            span_chars = max(1, sum(len(chunks[k]) for k in range(i - 1, j)))
            acc = len(chunks[i - 1])
            for k in range(i, j):
                starts[k] = t_prev + (t_next - t_prev) * acc / span_chars
                acc += len(chunks[k])
            i = j
        else:
            i += 1
    starts = [max(0.0, min(dur_ceil, s)) for s in starts]
    for i in range(1, n_chunks):
        if starts[i] < starts[i - 1]:
            starts[i] = starts[i - 1]
    # 逐字符秒：继承链从块起始秒出发，块内跟最近的词边界
    char_secs = []
    pos = 0
    for ci, c in enumerate(chunks):
        prev = starts[ci]
        frames = []
        for i in range(pos, pos + len(c)):
            if i < len(char_t) and char_t[i] is not None:
                prev = max(prev, min(dur_ceil, char_t[i][0]))
            frames.append(prev)
        pos += len(c) + len(sep)
        char_secs.append(frames)
    return starts, char_secs


def _linear_chunk_timing(chunks, dur):
    """无词边界时的线性块起点与块内逐字符估计。"""
    total_chars = max(1, sum(len(c) for c in chunks))
    starts = []
    cum = 0
    for c in chunks:
        starts.append(min(max(0.0, dur - 1e-4), dur * cum / total_chars))
        cum += len(c)
    starts[0] = 0.0
    char_secs = []
    for i, c in enumerate(chunks):
        a = starts[i]; b = starts[i + 1] if i + 1 < len(starts) else dur
        n = max(1, len(c))
        char_secs.append([min(max(0.0, dur - 1e-4), a + (b - a) * j / n) for j in range(len(c))])
    return starts, char_secs


def split_minimax_block(block_x, block_text, sent_metas, segments, sep='', sr=SR):
    """按词级时间将 MiniMax 整块音频切回各句，任一句无词匹配时整块退回停顿对齐。"""
    m = len(sent_metas)
    if m == 0:
        return []
    words = extract_minimax_block_words(block_text, segments)
    sw = [
        [w for w in words if meta['char_start'] <= w['g0'] < meta['char_end']]
        for meta in sent_metas
    ]
    block_dur = len(block_x) / sr
    if block_dur > 0 and all(sw):
        cuts = [0.0]
        for k in range(m - 1):
            prev_end = max(w['t'] + w['d'] for w in sw[k])
            next_start = min(w['t'] for w in sw[k + 1])
            mid = 0.5 * (prev_end + next_start)
            lo = cuts[-1] + 0.04
            hi = max(lo, block_dur - 0.04 * (m - 1 - k))
            cuts.append(max(lo, min(hi, mid)))
        cuts.append(block_dur)
        results = []
        for k, meta in enumerate(sent_metas):
            ia = int(round(cuts[k] * sr)); ib = int(round(cuts[k + 1] * sr))
            seg_raw = block_x[ia:ib]
            if len(seg_raw) == 0:
                seg_raw = block_x[max(0, ia - 1):max(1, ib)]
            x, rel_lead = trim_edges(seg_raw)
            total_lead = ia / sr + rel_lead
            dur = len(x) / sr
            sent_words = [
                {
                    't': w['t'],
                    'd': w['d'],
                    'text': w['text'],
                    'c0': w['g0'] - meta['char_start'],
                    'c1': min(len(meta['tts_text']), w['g1'] - meta['char_start']),
                }
                for w in sw[k]
            ]
            starts, char_secs = chunk_starts(meta['tts_text'], meta['chunks'], sent_words, total_lead, dur, sep)
            results.append((x, starts, char_secs, dur, True))
        return results

    print(f'⚠ MiniMax 块部分句未命中词边界（{sum(not s for s in sw)}/{m}），整块退回停顿对齐（estimated）')
    trimmed, _ = trim_edges(block_x)
    if len(trimmed) == 0:
        trimmed = block_x
    pauses, speech_sec = find_pauses(trimmed, sr)
    counts = [max(1, len(meta['tts_text'])) for meta in sent_metas]
    spans = align_bounds(counts, pauses, speech_sec, len(trimmed) / sr)
    results = []
    for meta, (a, b) in zip(sent_metas, spans):
        piece = trimmed[int(round(a * sr)):int(round(b * sr))]
        if len(piece) == 0:
            piece = trimmed[:max(1, int(0.05 * sr))]
        x, _ = trim_edges(piece)
        dur = len(x) / sr
        starts, char_secs = _linear_chunk_timing(meta['chunks'], dur)
        results.append((x, starts, char_secs, dur, False))
    return results


def apply_voice_fx(y, sr, enabled):
    """VOICE_FX=on 时走 voice_fx.process；缺 pyloudnorm 时警告并降级 0.89 峰值归一。"""
    if enabled == 'on':
        try:
            import voice_fx
            return voice_fx.process(y, sr)
        except ImportError:
            print('⚠ 缺少 pyloudnorm，跳过 voice_fx，降级峰值 0.89 归一')
    peak = float(np.max(np.abs(y))) or 1.0
    return (y / peak * 0.89).astype(np.float32), None


async def synth_sentence(chunks, sep=''):
    """一句 → (音频 float32 单声道, 每块起始秒, 每块逐字符起始秒, 句长秒, 是否实测词边界)。sep 是块之间的连接符（英文 ' '，中文 ''）。
    edge：整句合成一次，块起点与逐字符时间都按词边界对齐（最准）。
    kokoro：无词边界 → 逐字幕块分别合成再拼接，块起点因此是精确的（块内字符按位置线性铺开=估计计时），代价是块界断句略生硬。"""
    text = sep.join(chunks)
    if ENGINE == 'edge':
        au, words = await synth_edge(text)
        x, lead_cut = trim_edges(decode(au))
        dur = len(x) / SR
        starts, char_secs = chunk_starts(text, chunks, words, lead_cut, dur, sep)
        return x, starts, char_secs, dur, bool(words)
    pad = np.zeros(int(CHUNK_PAD * SR), dtype=np.float32)
    parts = []; starts = []; pos = 0.0
    for i, c in enumerate(chunks):
        xi, _ = trim_edges(decode(synth_kokoro(c)))
        if i:
            parts.append(pad); pos += len(pad) / SR
        starts.append(pos)
        parts.append(xi); pos += len(xi) / SR
    x = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    dur = len(x) / SR
    char_secs = []
    for i, c in enumerate(chunks):
        a = starts[i]; b = starts[i + 1] if i + 1 < len(starts) else dur
        n = max(1, len(c))
        char_secs.append([a + (b - a) * j / n for j in range(len(c))])
    return x, starts, char_secs, dur, False


async def main(narr=None, *, force=False, legacy_config=False, fps=None, beat_grid=None, no_beat_align=False):
    global ENGINE, VOICE, RATE, PROJECT, SLUG, FPS, CFG_LANG, CACHE
    PROJECT = AudioProject(ROOT, legacy_config, fps)
    SLUG, FPS = PROJECT.slug, PROJECT.fps
    CACHE = str(Path(ROOT) / 'audio' / 'cache')
    match = re.search(r"lang:\s*['\"](zh|en)['\"]", PROJECT.config)
    CFG_LANG = match.group(1) if match else 'zh'
    narr = narr or Path(ROOT) / 'script' / 'narration.txt'
    outputs = [PROJECT.assets / name for name in ('audio.wav', 'audio_narration.wav', 'audio.mix.json')]
    destinations = [*outputs, 'script/timeline.json', 'script/timeline.md',
                    'src/common/subs.ts', 'src/common/timeline.ts', 'src/common/anchors.ts', 'project.json']
    grid_candidate = None
    if not no_beat_align:
        if beat_grid is not None:
            grid_candidate = PROJECT.path(beat_grid)
        else:
            default_grid = PROJECT.path('script/beat_grid.json')
            if default_grid.exists():
                grid_candidate = default_grid
    PROJECT.preflight_audio(narr, CACHE, *destinations, *([grid_candidate] if grid_candidate is not None else []))
    if PROJECT.path(outputs[1]).exists() and not force:
        raise ValueError('Existing audio_narration.wav is protected; use --force to regenerate narration')
    items = parse(PROJECT.path(narr))
    if not any(item['type'] == 'sent' and item['raw'].replace('|', '').strip() for item in items):
        raise SystemExit('narration.txt 没有可朗读句子，拒绝生成静音交付。')
    lang = detect_lang(items)
    if ENGINE == 'auto':
        if MINIMAX_API_KEY:
            ENGINE = 'minimax'
        else:
            ENGINE = 'edge'
            if lang == 'en':
                if 'VOICE' not in os.environ:
                    VOICE = os.environ.get('EDGE_EN_VOICE', 'en-US-ChristopherNeural')
                if 'RATE' not in os.environ:
                    RATE = '+0%'
        print(f'解说词语言 {lang} → TTS_ENGINE={ENGINE}（有偏好请显式传 TTS_ENGINE=…）')
    elif ENGINE == 'edge' and lang == 'en':
        if 'VOICE' not in os.environ:
            VOICE = os.environ.get('EDGE_EN_VOICE', 'en-US-ChristopherNeural')
        if 'RATE' not in os.environ:
            RATE = '+0%'
    if ENGINE == 'minimax' and not MINIMAX_API_KEY:
        raise SystemExit('TTS_ENGINE=minimax 需要环境变量 MINIMAX_API_KEY')
    minimax_voice = MINIMAX_VOICE or (MINIMAX_EN_VOICE if lang == 'en' else 'Chinese (Mandarin)_Reliable_Executive')
    if lang != CFG_LANG:
        print(f"⚠ src/config.ts 的 lang: '{CFG_LANG}' 与解说词语言 {lang} 不一致——改过来，"
              f"否则标题压窄与居中基线会按错的语言算")
    # 字幕块拼回整句给 TTS 时的连接符：英文词与词之间要有空格（否则 "powerful|but" 会被念成 powerfulbut），中文直接拼
    sep = ' ' if lang == 'en' else ''
    minimax_blocks = []
    if ENGINE == 'minimax':
        minimax_blocks = build_minimax_blocks(items, lang, sep)
        mm_sig = f'minimax|{MINIMAX_TTS_MODEL}|{minimax_voice}|{MINIMAX_SPEED}'
        for blk in minimax_blocks:
            cache_path(blk['text'], '.flac', sig_prefix=mm_sig)
            cache_path(blk['text'], '.json', sig_prefix=mm_sig)
    else:
        for item in items:
            if item['type'] == 'sent':
                chunks = [chunk.strip() for chunk in item['raw'].split('|') if chunk.strip()]
                for text in ([sep.join(chunks)] if ENGINE == 'edge' else chunks):
                    for extension in (('.mp3', '.json') if ENGINE == 'edge' else ('.wav',)):
                        cache_path(text, extension)
    PROJECT.mkdir(CACHE)
    minimax_sent_results = {}
    if ENGINE == 'minimax':
        for b_idx, blk in enumerate(minimax_blocks):
            flac_p, subs_segs, cached = synth_minimax(blk['text'], minimax_voice, MINIMAX_SPEED)
            block_x = decode(flac_p)
            splits = split_minimax_block(block_x, blk['text'], blk['sents'], subs_segs, sep=sep, sr=SR)
            for meta, res in zip(blk['sents'], splits):
                minimax_sent_results[meta['item_idx']] = res
            if not cached and b_idx + 1 < len(minimax_blocks):
                time.sleep(0.1)
    beats_s = []
    downbeats_s = []
    beat_aligned = False
    if grid_candidate is not None and grid_candidate.exists():
        grid_data = json.loads(grid_candidate.read_text(encoding='utf-8'))
        if grid_data.get('reliable') or beat_grid is not None:
            beats_s = [float(v) for v in (grid_data.get('beats_s') or [])]
            downbeats_s = [float(v) for v in (grid_data.get('downbeats_s') or [])]
            beat_aligned = bool(beats_s or downbeats_s)
    t = LEAD / FPS
    audio_parts = []  # (start_sec, np.array)
    sentences = []; chapters = []
    anchor_refs = []
    all_measured = True
    sid = 0
    total_chars = 0; total_words = 0; speech_sec = 0.0
    chapter_open_pending = False
    for idx_item, it in enumerate(items):
        if it['type'] == 'chapter':
            t += CHAPTER_GAP / FPS
            chapters.append({'n': it['chapter'], 'title': it['title'], 'from': int(round(t * FPS)) + 1})
            chapter_open_pending = True
            continue
        t += it['gap_before'] / FPS
        raw = it['raw']
        chunks = [c.strip() for c in raw.split('|') if c.strip()]
        if not chunks:
            continue
        tts_text = sep.join(chunks)
        prev_sent = sentences[-1]['text'] if sentences else None
        if beat_aligned:
            if chapter_open_pending:
                t = quantize_sentence_start(t, 'chapter_open', beats_s, downbeats_s, pocket_s=0.05)
            elif prev_sent and _discourse_role(prev_sent, tts_text) in ('accent', 'climax'):
                t = quantize_sentence_start(t, 'accent', beats_s, downbeats_s, pocket_s=0.0)
        chapter_open_pending = False
        if ENGINE == 'minimax':
            x, starts, char_secs, dur, measured = minimax_sent_results[idx_item]
        else:
            x, starts, char_secs, dur, measured = await synth_sentence(chunks, sep)
        all_measured = all_measured and measured
        if (x.ndim != 1 or len(x) == 0 or not np.all(np.isfinite(x))
                or not np.isfinite(dur) or abs(dur - len(x) / SR) > 1 / SR
                or len(starts) != len(chunks) or starts != sorted(starts)
                or any(not np.isfinite(start) or start < 0 or start >= dur for start in starts)
                or len(char_secs) != len(chunks) or any(len(fc) != len(c) for fc, c in zip(char_secs, chunks))
                or any(not np.isfinite(cs) for fc in char_secs for cs in fc)):
            raise ValueError('Synthesized samples/duration/subtitle boundaries are inconsistent')
        # edge-tts 云端限流：句间留间隔（缓存命中的句子在上面已提前返回）
        if ENGINE == 'edge' and EDGE_DELAY > 0:
            await asyncio.sleep(EDGE_DELAY)
        sent_idx = len(sentences)
        sid += 1
        subs = [(t + starts[i], t + (starts[i + 1] if i + 1 < len(starts) else dur)) for i in range(len(chunks))]
        f0 = int(round(t * FPS)) + 1; f1 = int(round((t + dur) * FPS))
        rec = {'id': f'S{sid:02d}', 'chapter': it['chapter'], 'from': f0, 'to': f1, 'text': tts_text,
               'subs': [{'from': int(round(a * FPS)) + 1, 'to': int(round(b * FPS)), 'text': c,
                         'chars': [int(round((t + cs) * FPS)) + 1 for cs in fc]}
                        for c, (a, b), fc in zip(chunks, subs, char_secs)]}
        for k in ('en', 'cn'):
            if it.get(k):
                rec[k] = it[k]
                rec['subs'][0][k] = it[k]  # 对照行挂句首块（逐块对照需在 | 切块时自行对齐）
                break
        sentences.append(rec)
        for aid, ci, off in it.get('anchors', []):
            anchor_refs.append((aid, sent_idx, ci, off))
        audio_parts.append((t, x))
        total_chars += len(re.sub(r'[，。、！？：；“”（）,.!?:;()\-—…\s]', '', tts_text))
        total_words += len(tts_text.split()); speech_sec += dur
        next_item = items[idx_item + 1] if idx_item + 1 < len(items) else None
        next_sent_text = None
        if next_item and next_item['type'] == 'sent':
            next_sent_text = sep.join(c.strip() for c in next_item['raw'].split('|') if c.strip())
        gap_frames = semantic_gap_frames(tts_text, next_sent_text, GAP, PROSODY_MODE)
        t += dur + gap_frames / FPS
    t += TAIL / FPS
    total = int(np.ceil(t * FPS))
    # 合成音轨
    y = np.zeros(int(total / FPS * SR) + SR, dtype=np.float32)
    for st, x in audio_parts:
        a = int(st * SR); y[a:a + len(x)] += x
    y = y[: int(total / FPS * SR)]
    y_st, fx_report = apply_voice_fx(np.stack([y, y], 1), SR, VOICE_FX)
    PROJECT.validate_audio(y_st, SR, {'total_frames': total})
    PROJECT.preflight_audio(*destinations)
    if PROJECT.path(outputs[1]).exists() and not force:
        raise ValueError('Narration master appeared during synthesis; rerun with --force if intended')
    PROJECT.mkdir(PROJECT.assets)
    wav = str(PROJECT.path(outputs[0]))
    write_wav(wav, y_st, SR, project=PROJECT)
    # 混音只读此正本；不再通过 audio.wav 的修改时间猜测来源。
    PROJECT.copy(wav, outputs[1])
    PROJECT.unlink(outputs[2])
    all_subs = fix_subtitles(sentences, clamp_chars=False)
    anchor_source = 'measured' if (ENGINE in ('edge', 'minimax') and all_measured) else 'estimated'
    if ENGINE == 'minimax':
        voice_name = minimax_voice
        rate_val = MINIMAX_SPEED
    elif ENGINE == 'edge':
        voice_name = VOICE
        rate_val = RATE
    else:
        voice_name = KOKORO_VOICE
        rate_val = KOKORO_SPEED
    tl = {'fps': FPS, 'total_frames': total, 'engine': ENGINE,
          'voice': voice_name,
          'rate': rate_val,
          'prosody_mode': PROSODY_MODE, 'beat_aligned': beat_aligned,
          'anchor_source': anchor_source,
          'voice_fx': fx_report,
          'gap': GAP, 'chapter_gap': CHAPTER_GAP, 'lead': LEAD, 'tail': TAIL,
          'lang': lang, 'chapters': chapters, 'sentences': sentences, 'chars': total_chars, 'words': total_words,
          'speech_sec': round(speech_sec, 2)}
    if ENGINE == 'minimax':
        tl['model'] = MINIMAX_TTS_MODEL
        tl['synth_unit'] = 'block'
    unit_cnt = ('字', total_chars) if lang == 'zh' else ('词', total_words)
    md_title = (
        f"# 时间轴（{ENGINE} · {voice_name} {rate_val}，共 {total} 帧 = {total/FPS:.1f}s，"
        f"{unit_cnt[1]} {unit_cnt[0]}，语速 {unit_cnt[1]/max(1e-6,speech_sec):.2f} {unit_cnt[0]}/s）\n\n"
    )
    unit, cnt, _ = write_artifacts(
        PROJECT, tl, chapters, sentences, all_subs, anchor_refs, anchor_source,
        md_title=md_title,
        subs_header='// 自动生成：scripts/tts_build.py（词边界 / 逐块合成 → 字幕块）。手改请改 script/narration.txt 后重跑。\n',
        subs_chars_doc=(
            "  /** 逐字符起始帧（词级点亮字幕 WordLitCaption 的底料，1 起含端点，长度==text 字符数；无词边界字符继承前字符）。\n"
            "   *  edge 引擎为实测词边界；kokoro 为块内线性估计。缺省（旧数据）时 WordLitCaption 退化为整块淡入，与旧渲染逐值等价。 */\n"
        ),
        timeline_header='// 自动生成：scripts/tts_build.py。帧号 1 起含端点。\n',
        warn_wide=True,
    )
    print(f'lang={lang} engine={ENGINE} voice={tl["voice"]} total_frames={total} ({total/FPS:.1f}s) '
          f'sentences={len(sentences)} {"chars" if lang == "zh" else "words"}={cnt} speech={speech_sec:.1f}s '
          f'rate={cnt/max(1e-6,speech_sec):.2f} {unit}/s')
    for c in chapters:
        print(f"  chapter {c['n']} {c['title']} from f{c['from']}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('narration', nargs='?')
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--legacy-config', action='store_true')
    parser.add_argument('--fps', type=int)
    parser.add_argument('--beat-grid')
    parser.add_argument('--no-beat-align', action='store_true')
    options = parser.parse_args()
    try:
        asyncio.run(main(options.narration, force=options.force,
                         legacy_config=options.legacy_config, fps=options.fps,
                         beat_grid=options.beat_grid, no_beat_align=options.no_beat_align))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'[tts_build] {error}') from None
