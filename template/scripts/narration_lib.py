"""Shared narration parsing, pause alignment, anchor resolution and timeline output."""
import json
import re
import wave
from pathlib import Path
import numpy as np

SR = 48000
WIN = 0.01            # RMS 包络窗（秒）
MIN_PAUSE = 0.18      # 候选切点最短静音（秒）
PAUSE_TAIL = 0.12     # 切点：前句保留的尾气口（秒）
PAUSE_LEAD = 0.03     # 切点：后句保留的起气口（秒）
PAUSE_REWARD = 0.3    # DP 长停顿奖励系数

SUB_MAX_W = 1160
SUB_SIZE = 44
SUB_BUDGET = {'zh': '16 字', 'en': '48 字符'}

_ANCHOR_RE = re.compile(r'\{#([^}]*)\}')
_ANCHOR_ID_RE = re.compile(r'^[a-z][a-z0-9_-]{0,39}$')


def _strip_sentence_anchors(line, seen_ids):
    """剥离句中 {#id} 锚点标记并返回 (clean_raw, [(id, chunk_idx, char_offset)])。"""
    if '{#' not in line:
        return line, []
    if '{#' in _ANCHOR_RE.sub('', line):
        raise SystemExit(f'锚点语法错误（缺少闭合 }}）：{line}')
    for m in _ANCHOR_RE.finditer(line):
        aid = m.group(1)
        if not _ANCHOR_ID_RE.match(aid):
            raise SystemExit(
                f'锚点格式非法 {{#{aid}}}：id 必须匹配 ^[a-z][a-z0-9_-]{{0,39}}$（小写字母开头）'
            )
        if aid in seen_ids:
            raise SystemExit(f'锚点 id 重复：{{#{aid}}}')
        seen_ids.add(aid)

    chunks = []
    anchors = []
    pending = []
    for piece in line.split('|'):
        clean_parts = []
        local = []
        last = 0
        offset = 0
        for m in _ANCHOR_RE.finditer(piece):
            seg = piece[last:m.start()]
            clean_parts.append(seg)
            offset += len(seg)
            local.append((m.group(1), offset))
            last = m.end()
        clean_parts.append(piece[last:])
        clean_piece = ''.join(clean_parts)
        stripped = clean_piece.strip()
        if not stripped:
            pending.extend(aid for aid, _ in local)
            continue
        ci = len(chunks)
        lead_ws = len(clean_piece) - len(clean_piece.lstrip())
        for aid in pending:
            anchors.append((aid, ci, 0))
        pending.clear()
        for aid, raw_pos in local:
            pos = max(0, raw_pos - lead_ws)
            if pos >= len(stripped):
                pending.append(aid)
            else:
                anchors.append((aid, ci, pos))
        chunks.append(stripped)

    if pending:
        raise SystemExit(f'锚点 {{#{pending[0]}}} 位于句尾，后面没有可锚定的字符：{line}')
    return '|'.join(chunks), anchors


def anchor_tts_index(chunks, chunk_idx, char_offset, sep=''):
    """把 (chunk_idx, char_offset) 换算为 sep.join(chunks) 中的字符下标。"""
    pos = 0
    for k in range(chunk_idx):
        pos += len(chunks[k]) + len(sep)
    return pos + char_offset


def sentence_anchor_indices(item, sep=''):
    """返回该句每个锚点的 (id, tts_text_char_index)。"""
    chunks = [c.strip() for c in item['raw'].split('|') if c.strip()]
    return [
        (aid, anchor_tts_index(chunks, ci, off, sep))
        for aid, ci, off in item.get('anchors', [])
    ]


def parse(path):
    """解析 narration.txt：# CHAPTER / ## gap / ## swell / {#id} / | 切块 / @EN:@CN: 对照。"""
    items = []
    chap = 0
    chap_title = ''
    pending_gap = 0
    seen_ids = set()
    for raw in Path(path).read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r'^#\s*CHAPTER\s+(\d+)\s+(.*)$', line)
        if m:
            chap = int(m.group(1))
            chap_title = m.group(2).strip()
            items.append({'type': 'chapter', 'chapter': chap, 'title': chap_title})
            continue
        m = re.match(r'^##\s*gap\s+(\d+)', line)
        if m:
            pending_gap += int(m.group(1))
            continue
        if re.match(r'^##\s*swell\b', line):
            pending_gap += 42
            continue
        m = re.match(r'^@(EN|CN):\s*(.+)$', line)
        if m:
            tag = m.group(1).lower()
            for it in reversed(items):
                if it['type'] == 'sent':
                    it[tag] = m.group(2).strip()
                    break
            continue
        if line.startswith('#'):
            continue
        clean_raw, anchors = _strip_sentence_anchors(line, seen_ids)
        items.append({
            'type': 'sent',
            'chapter': chap,
            'raw': clean_raw,
            'gap_before': pending_gap,
            'anchors': anchors,
        })
        pending_gap = 0
    return items


def detect_lang(items):
    """解说词里 CJK 占比 ≥20% → 'zh'，否则 'en'。"""
    txt = ''.join(it['raw'] for it in items if it['type'] == 'sent')
    cjk = sum(1 for c in txt if '一' <= c <= '鿿')
    return 'zh' if cjk >= 0.2 * max(1, len(txt)) else 'en'


def text_em(s):
    """与 src/common/textfit.ts 的 textEm() 同一张表（改一处要同步另一处）。"""
    t = 0.0
    for ch in s:
        c = ord(ch)
        if c >= 0x2000:
            t += 1.0
        elif ch == ' ':
            t += 0.227
        elif 'A' <= ch <= 'Z':
            t += 0.668
        elif '0' <= ch <= '9':
            t += 0.59
        elif 'a' <= ch <= 'z':
            t += 0.566
        elif 0xc0 <= c < 0x250:
            t += 0.58
        else:
            t += 0.325
    return t


def write_wav(path, x, sr, project=None):
    """x：float32 单声道 (n,) 或立体声 (n,2) → 16bit PCM wav。"""
    a = np.asarray(x, dtype=np.float32)
    pcm = (np.clip(a, -1.0, 1.0) * 32767).astype(np.int16)
    target = project.path(path) if project is not None else Path(path)
    if project is not None:
        project.mkdir(target.parent)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target), 'wb') as w:
        w.setnchannels(1 if a.ndim == 1 else a.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def find_pauses(x, sr=SR):
    """RMS 10ms 窗 → 自适应阈值 → ≥MIN_PAUSE 的静音段列表 [(start_s, end_s)] 与总语音活动时长。"""
    n = len(x) // int(WIN * sr)
    if n == 0:
        raise SystemExit('配音 wav 短于一个分析窗（10ms）')
    win = x[:n * int(WIN * sr)].reshape(n, int(WIN * sr))
    rms = np.sqrt(np.mean(win.astype(np.float64) ** 2, axis=1))
    db = 20 * np.log10(rms + 1e-12)
    peak_db = float(db.max())
    noise_db = float(np.percentile(db, 5))
    thr_db = max(peak_db - 35.0, noise_db + 6.0)
    active = db > thr_db
    if not active.any():
        raise SystemExit('配音里找不到语音段（自适应阈值下无活动帧）——检查音轨是否只是底噪/音乐')
    pauses = []
    run = None
    for k, on in enumerate(active):
        if not on:
            run = k if run is None else run
        elif run is not None:
            if (k - run) * WIN >= MIN_PAUSE:
                pauses.append((run * WIN, k * WIN))
            run = None
    if run is not None and (n - run) * WIN >= MIN_PAUSE:
        pauses.append((run * WIN, n * WIN))
    return pauses, float(active.sum() * WIN)


def align_bounds(chunks_cnt, pauses, speech_sec, total_sec):
    """DP：n 句 → 每句音频区间 [(start_s, end_s)]（trimmed 坐标）。"""
    n = len(chunks_cnt)
    if n == 1:
        return [(0.0, total_sec)]
    exp = [c / max(1, sum(chunks_cnt)) * speech_sec for c in chunks_cnt]
    if len(pauses) < n - 1:
        print(f'⚠ 能量停顿只有 {len(pauses)} 个，少于句界所需的 {n - 1} 个——退化为按字符占比线性切分，'
              f'句级对齐不可靠：确认 narration.txt 句数与配音一致、句间是否有 0.18s 以上停顿')
        cum = np.cumsum([0.0] + [c / max(1, sum(chunks_cnt)) * total_sec for c in chunks_cnt])
        return [(float(cum[i]), float(cum[i + 1]) if i + 1 < n else total_sec) for i in range(n)]

    def reward(p):
        return PAUSE_REWARD * min(p[1] - p[0], 1.0)

    inf = float('inf')
    m = len(pauses)
    dp = [[inf] * m for _ in range(n)]
    parent = [[-1] * m for _ in range(n)]
    for j, p in enumerate(pauses):
        dp[0][j] = (p[0] + PAUSE_TAIL - exp[0]) ** 2 - reward(p)
    for i in range(1, n):
        last = (i == n - 1)
        for j in ([0] if last else range(m)):
            for jp in (range(m) if last else range(j)):
                if dp[i - 1][jp] == inf:
                    continue
                start = pauses[jp][1] - PAUSE_LEAD
                end = total_sec if last else pauses[j][0] + PAUSE_TAIL
                cost = dp[i - 1][jp] + (end - start - exp[i]) ** 2 - (0.0 if last else reward(pauses[j]))
                if cost < dp[i][j]:
                    dp[i][j] = cost
                    parent[i][j] = jp
    ends = [min(range(m), key=lambda j: dp[n - 1][j])]
    for i in range(n - 1, 0, -1):
        ends.append(parent[i][ends[-1]])
    picks = list(reversed(ends))
    spans = []
    start = 0.0
    for i in range(n):
        end = total_sec if i == n - 1 else pauses[picks[i]][0] + PAUSE_TAIL
        spans.append((start, end))
        if i < n - 1:
            start = pauses[picks[i]][1] - PAUSE_LEAD
    return spans


def fix_subtitles(sentences, *, clamp_chars=False):
    """修整字幕边界：相邻句不重叠；同句块间连续。"""
    all_subs = []
    for s in sentences:
        for sb in s['subs']:
            if sb['to'] < sb['from']:
                sb['to'] = sb['from']
            all_subs.append(dict(sb))
    for i in range(len(all_subs) - 1):
        if all_subs[i]['to'] >= all_subs[i + 1]['from']:
            all_subs[i]['to'] = all_subs[i + 1]['from'] - 1
    if clamp_chars:
        for sb in all_subs:
            if sb.get('chars'):
                sb['chars'] = [min(c, sb['to']) for c in sb['chars']]
    return all_subs


def warn_wide_subs(all_subs, lang):
    """检查字幕块宽度是否超出安全区并输出提醒。"""
    over = [(sb, text_em(sb['text']) * SUB_SIZE) for sb in all_subs]
    over = [(sb, w) for sb, w in over if w > SUB_MAX_W]
    if over:
        print(f'⚠ {len(over)}/{len(all_subs)} 块字幕在 {SUB_SIZE}px 下超过安全区 {SUB_MAX_W}px'
              f'（会自动缩字号；建议每块 {SUB_BUDGET[lang]}，用 | 再切一刀）：')
        for sb, w in over[:5]:
            print(f"    f{sb['from']} (≈{w:.0f}px{'，会折两行' if w > SUB_MAX_W * 1.3 else ''}) {sb['text']}")


def build_anchor_frames(chapters, sentences, anchor_refs):
    """汇总章/句/句中 {#id} 锚点到 1 起帧号表。"""
    frames = {}
    for c in chapters:
        frames[f"C{c['n']}"] = int(c['from'])
    for s in sentences:
        frames[s['id']] = int(s['from'])
        frames[f"{s['id']}.end"] = int(s['to'])
    for aid, sent_idx, chunk_idx, char_offset in anchor_refs:
        sb = sentences[sent_idx]['subs'][chunk_idx]
        chars = sb.get('chars') or []
        f = chars[char_offset] if 0 <= char_offset < len(chars) else sb['from']
        hi = max(int(sb['from']), int(sb['to']))
        frames[aid] = max(1, min(int(f), hi))
    return frames


def write_artifacts(project, tl, chapters, sentences, all_subs, anchor_refs, anchor_source, *,
                    md_title, subs_header, subs_chars_doc, timeline_header, warn_wide=False):
    """写出 timeline.json/md、subs.ts、timeline.ts、anchors.ts 并同步 project.totalFrames。"""
    fps = tl['fps']
    total = tl['total_frames']
    lang = tl['lang']
    unit, cnt = ('字', tl['chars']) if lang == 'zh' else ('词', tl['words'])

    if warn_wide:
        warn_wide_subs(all_subs, lang)

    project.mkdir('script')
    project.mkdir('src/common')
    project.write_text('script/timeline.json', json.dumps(tl, ensure_ascii=False, indent=1))

    md = [md_title, '| 句 | 章 | 帧 from–to | 时长 | 文本（| 为字幕切分） |\n|---|---|---|---|---|\n']
    for s in sentences:
        md.append(
            f"| {s['id']} | {s['chapter']} | {s['from']}–{s['to']} | {(s['to'] - s['from'] + 1) / fps:.1f}s | "
            f"{'｜'.join(sb['text'] for sb in s['subs'])} |\n"
        )
    md.append('\n## 章节起始帧\n')
    for c in chapters:
        md.append(f"- 第{c['n']}章 {c['title']}：f{c['from']}\n")
    project.path('script/timeline.md').write_text(''.join(md), encoding='utf-8')

    def lit(s):
        return json.dumps(s, ensure_ascii=False)

    ts = [
        subs_header,
        "export type SubEntry = {from: number; to: number; text: string; en?: string; cn?: string; emphasis?: boolean;\n",
        subs_chars_doc,
        "  chars?: number[]};\nexport const SUBS: SubEntry[] = [\n",
    ]
    for sb in all_subs:
        alt = ''.join(f", {k}: {lit(sb[k])}" for k in ('en', 'cn') if sb.get(k))
        ch = f", chars: [{','.join(str(x) for x in sb['chars'])}]" if sb.get('chars') else ''
        ts.append(f"  {{from: {sb['from']}, to: {sb['to']}, text: {lit(sb['text'])}{alt}{ch}}},\n")
    ts.append('];\n')
    project.path('src/common/subs.ts').write_text(''.join(ts), encoding='utf-8')

    tl_ts = [
        timeline_header,
        f'export const TOTAL_FRAMES = {total};\n',
        'export const CHAPTER_STARTS: Array<{n: number; title: string; from: number}> = [\n',
    ]
    for c in chapters:
        tl_ts.append(f"  {{n: {c['n']}, title: {lit(c['title'])}, from: {c['from']}}},\n")
    tl_ts.append('];\nexport type Sentence = {id: string; chapter: number; from: number; to: number; text: string};\nexport const SENTENCES: Sentence[] = [\n')
    for s in sentences:
        tl_ts.append(f"  {{id: {lit(s['id'])}, chapter: {s['chapter']}, from: {s['from']}, to: {s['to']}, text: {lit(s['text'])}}},\n")
    tl_ts.append('];\n')
    project.path('src/common/timeline.ts').write_text(''.join(tl_ts), encoding='utf-8')

    anchors = build_anchor_frames(chapters, sentences, anchor_refs)
    anc_lines = ['// 自动生成：narration_lib.py。帧号 1 起含端点。\n', 'export const ANCHOR_FRAMES: Record<string, number> = {\n']
    for k, v in anchors.items():
        anc_lines.append(f'  {lit(k)}: {v},\n')
    anc_lines.append('};\n')
    anc_lines.append(f"export const ANCHOR_SOURCE: 'measured' | 'estimated' = {lit(anchor_source)};\n")
    project.path('src/common/anchors.ts').write_text(''.join(anc_lines), encoding='utf-8')

    project.save_total(total)
    return unit, cnt, anchors
