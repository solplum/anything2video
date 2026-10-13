#!/usr/bin/env python3
"""bgm_review — 曲库标注轮试听页 + 题材候选清单（human_reviewed 回写前必经）。

2026-10-12 用户两连定调：**①题材轴必须给候选让用户选，禁止只丢受控词表凭空填；
②标注在当前对话内问（宿主选项提问工具点选），禁止把标注表单做进 HTML。**
分工由此定死：试听页只管听（音频+能量曲线+客观数据+候选参考），主控拿本脚本
打出的候选清单在**对话内**逐曲/逐段以 2–3 个候选让用户点选；回复后回写 profile
逐段 theme_tags/func 并翻 human_reviewed=true。

用法（标注轮标配）：
  uv run python scripts/bgm_review.py --out tmp/bgm-review/review-wx.html \
      --cands tmp/bgm-review/wx-cands.json
cands JSON 形态（全部可选，缺的走程序预推）：
  {"<stem>": {"title": "...", "temper": "...", "usage": "...",
              "segments": {"1": ["科技未来", "商业品牌"]}}}
stdout 同时打「对话提问清单」（每段候选+来源标记），主控照此在对话内出选项题。
默认只收 human_reviewed=false 的档案；--include-reviewed 全量收（翻案用）。

诚实口径：程序预推候选来自客观层明暗/档位的粗映射（本曲内相对档不跨曲可比），
仅作点选起点；题材归属是主观决策，最终以用户点选/改写为准。

自测：
  uv run python scripts/bgm_review.py --selftest
"""
import argparse
import html
import json
import tempfile
from pathlib import Path

THEMES = ('科技未来', '人文叙事', '情感抒情', '国风古典', '悬疑紧张',
          '欢快活力', '史诗宏大', '沉静冥想', '商业品牌', '知识科普',
          '黑色生命力', '都市高级感')  # 后两个 2026-10-12 用户标注自加曲时新扩
AGENT_CANDS_MAX = 3
LEVEL_COLOR = {1: '#3a3f4b', 2: '#5b6472', 3: '#3d6f8e', 4: '#c07a3d', 5: '#c0453d'}


def load_profiles(paths, include_reviewed=False):
    """paths=目录或文件列表；默认只收 human_reviewed=false（标注轮对象）。"""
    out = []
    for p in paths:
        p = Path(p)
        files = sorted(p.glob('*.json')) if p.is_dir() else [p]
        for f in files:
            prof = json.loads(f.read_text(encoding='utf-8'))
            if 'segments' not in prof or 'duration_s' not in prof:
                continue  # 非 bgm_analyze 档案（如候选/索引类 json）跳过
            if not include_reviewed and prof.get('human_reviewed'):
                continue
            out.append((f.stem, prof))
    return out


def auto_cands(seg):
    """客观层明暗/档位 → 程序预推题材候选（粗映射，仅点选起点）。"""
    bright = seg.get('brightness', 1000) / 1000
    level = seg.get('level', 3)
    if level >= 4:
        base = ['科技未来', '欢快活力'] if bright >= 2.0 else ['史诗宏大', '悬疑紧张']
    elif level == 3:
        base = ['人文叙事', '商业品牌'] if bright < 1.2 else ['知识科普', '商业品牌']
    else:
        base = ['沉静冥想', '情感抒情']
    return [t for t in base if t in THEMES]


def merge_cands(agent_segs, i, seg):
    """主控供给优先，程序预推补位到 3；去重保序。返回 (候选, 是否预推标记)。"""
    supplied = list(((agent_segs or {}).get('segments') or {}).get(str(i), ()))[:AGENT_CANDS_MAX]
    merged, auto_flags = [], []
    for t in supplied:
        if t not in merged:
            merged.append(t)
            auto_flags.append(False)
    for t in auto_cands(seg):
        if len(merged) >= AGENT_CANDS_MAX:
            break
        if t not in merged:
            merged.append(t)
            auto_flags.append(True)
    return merged, auto_flags


def build_plan(pairs, cands):
    """候选清单：主控在对话内出选项题的直接依据（也打印给用户看）。"""
    plan = []
    for stem, prof in pairs:
        entry = cands.get(stem, {})
        segs = []
        for i, s in enumerate(prof['segments'], 1):
            cands_i, auto_flags = merge_cands(entry, i, s)
            segs.append({'i': i, 't0': round(s['start'], 1), 't1': round(s['end'], 1),
                         'label': s.get('prelabel', ''), 'level': s.get('level', 3),
                         'brightness': round(s.get('brightness', 0)),
                         'cands': cands_i, 'auto': auto_flags})
        plan.append({'stem': stem, 'title': entry.get('title', stem),
                     'temper': entry.get('temper', '待试听标注'),
                     'usage': entry.get('usage', '待标注'), 'segs': segs})
    return plan


def print_ask_plan(plan):
    """把候选清单打成对话提问用的底稿（主控照此出 AskUserQuestion 族选项）。"""
    print('—— 对话提问清单（标注在对话内点选，勿做进 HTML）——')
    for n, t in enumerate(plan, 1):
        union = []
        for s in t['segs']:
            for c in s['cands']:
                if c not in union:
                    union.append(c)
        seg_desc = '；'.join(f"段{s['i']}({s['t0']:.0f}–{s['t1']:.0f}s,L{s['level']},{'亮' if s['brightness'] >= 2000 else '暗'})"
                             for s in t['segs'])
        print(f"{n}. {t['stem']}｜{seg_desc}")
        print(f"   候选：{'、'.join(union)}")


def svg_curve(prof):
    W, H = 920, 96
    dur = prof['duration_s']
    curve = prof.get('energy_curve_s') or []
    n = max(1, len(curve))
    pts = ' '.join(f"{(i + 0.5) * dur / n / dur * W:.1f},{H - 10 - c * (H - 26):.1f}"
                   for i, c in enumerate(curve))
    parts = [f'<svg viewBox="0 0 {W} {H}" class="curve">']
    for s in prof['segments']:
        x0, x1 = s['start'] / dur * W, s['end'] / dur * W
        parts.append(f'<rect x="{x0:.1f}" y="4" width="{max(x1 - x0, 1):.1f}" height="14" '
                     f'fill="{LEVEL_COLOR[s.get("level", 3)]}" opacity="0.9"/>')
        parts.append(f'<text x="{x0 + 4:.1f}" y="15" class="segtxt">{s.get("level", 3)}</text>')
    if curve:
        parts.append(f'<polyline points="{pts}" fill="none" stroke="#8fd3e8" stroke-width="1.6"/>')
    for c in prof['segments'][1:]:
        x = c['start'] / dur * W
        parts.append(f'<line x1="{x:.1f}" y1="20" x2="{x:.1f}" y2="{H}" stroke="#666" stroke-dasharray="3 3"/>')
    parts.append('</svg>')
    return ''.join(parts)


def render_html(plan, curves, out_title='曲库试听页'):
    """试听页只管听：音频+曲线+客观数据+候选参考（文字，不设表单）。标注在对话内。"""
    cards = []
    for idx, t in enumerate(plan, 1):
        segs_html = ''.join(
            f"<p class='segline'>段{s['i']}（{s['t0']:.0f}–{s['t1']:.0f}s）{html.escape(s['label'])} "
            f"L{s['level']}·{'亮' if s['brightness'] >= 2000 else '暗'}（{s['brightness'] / 1000:.1f}k）｜"
            f"候选：{'、'.join(c + ('（预推）' if a else '') for c, a in zip(s['cands'], s['auto']))}</p>"
            for s in t['segs'])
        bpm = f"BPM≈{curves[t['stem']][0]}（置信 {curves[t['stem']][1]}，<3.0 不可靠仅参考）" \
            if curves[t['stem']][0] else 'BPM 不可测'
        cards.append(f"""
<section class="card">
  <h2>{idx}. {html.escape(t['title'])} <span class="meta">{curves[t['stem']][2]:.0f}s · {bpm} · RMS {curves[t['stem']][3]}dBFS</span></h2>
  <audio controls preload="none" src="{t['stem']}{curves[t['stem']][4]}"></audio>
  {curves[t['stem']][5]}
  <p class="legend">上条带=能量档（1暗…5红）｜蓝线=能量曲线｜虚线=分段边界</p>
  {segs_html}
</section>""")
    return f"""<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>{html.escape(out_title)}</title><style>
body{{background:#14171c;color:#d7dde6;font-family:'Microsoft YaHei',sans-serif;max-width:1000px;margin:0 auto;padding:24px}}
h1{{font-size:20px}}.how{{background:#1d2330;border:1px solid #2c3648;border-radius:8px;padding:12px 16px;font-size:14px;line-height:1.7}}
.card{{background:#181c24;border:1px solid #262e3d;border-radius:10px;padding:16px 20px;margin:18px 0}}
h2{{font-size:17px;margin:4px 0 10px}}.meta{{font-size:12px;color:#8b96a5;font-weight:normal}}
audio{{width:100%;margin:6px 0 10px}}.curve{{width:100%;height:auto}}
.segtxt{{fill:#fff;font-size:9px}}.legend{{font-size:11px;color:#77839a;margin:2px 0 10px}}
.segline{{font-size:13px;margin:4px 0;color:#cfe3f0}}
</style></head><body>
<h1>{html.escape(out_title)}</h1>
<div class="how"><b>这页只管听</b>：每曲整曲听一遍，留意有没有人声/旁白/杂音。
<b>题材/功能/曲名等标注在当前对话里进行</b>——我会逐曲给你 2–3 个候选点选，不用在这页填任何东西。</div>
{''.join(cards)}
</body></html>"""


def copy_audio(plan, audio_dir, out_dir):
    """音频拷到页面同目录（wav 优先 mp3 兜底），返回 {stem: 后缀}。"""
    import shutil
    audio_dir, out_dir = Path(audio_dir), Path(out_dir)
    exts = {}
    for t in plan:
        src = next((audio_dir / f'{t["stem"]}{ext}' for ext in ('.wav', '.mp3')
                    if (audio_dir / f'{t["stem"]}{ext}').exists()), None)
        if src is None:
            raise SystemExit(f'找不到音频：{audio_dir}/{t["stem"]}.wav|.mp3（试听页须能就地播放）')
        shutil.copy(src, out_dir / src.name)
        exts[t['stem']] = src.suffix
    return exts


def selftest():
    prof = {'track': 't1', 'duration_s': 30.0, 'bpm': 71.0, 'bpm_confidence': 1.4,
            'loudness': {'rms_dbfs': -19.0}, 'human_reviewed': False,
            'energy_curve_s': [0.1] * 30,
            'segments': [{'start': 0.0, 'end': 15.0, 'prelabel': '主题段', 'level': 5,
                          'slope': 0.0, 'brightness': 2400.0},
                         {'start': 15.0, 'end': 30.0, 'prelabel': '推进段', 'level': 2,
                          'slope': 0.0, 'brightness': 800.0}]}
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        (root / 'profiles').mkdir()
        (root / 'profiles' / 't1.json').write_text(json.dumps(prof), encoding='utf-8')
        (root / 'audio').mkdir()
        (root / 'audio' / 't1.wav').write_bytes(b'RIFF')
        # ①过滤：human_reviewed=true 不收
        (root / 'profiles' / 't2.json').write_text(
            json.dumps(dict(prof, human_reviewed=True)), encoding='utf-8')
        got = load_profiles([root / 'profiles'])
        assert [s for s, _ in got] == ['t1'], 'human_reviewed 过滤失败'
        # ②候选合并：主控供给优先、程序预推补位到 3、去重
        merged, flags = merge_cands({'segments': {'1': ['科技未来', '悬疑紧张']}}, 1, prof['segments'][0])
        assert merged[:2] == ['科技未来', '悬疑紧张'] and len(merged) <= AGENT_CANDS_MAX, f'供给优先失败: {merged}'
        assert flags[:2] == [False, False] and all(flags[2:]), '来源标记错'
        # ③预推映射：亮高能 vs 暗低能 分向
        assert '科技未来' in auto_cands(prof['segments'][0])
        assert '沉静冥想' in auto_cands(prof['segments'][1])
        # ④端到端：页只含播放/曲线/候选参考，无任何表单件
        plan = build_plan(got, {})
        exts = copy_audio(plan, root / 'audio', root)
        curve = svg_curve(prof)
        page = render_html(plan, {'t1': (prof['bpm'], prof['bpm_confidence'], prof['duration_s'],
                                          prof['loudness']['rms_dbfs'], exts['t1'], curve)}, '测试页')
        assert 't1.wav' in page and '候选：' in page and '科技未来' in page
        for banned in ('<input', '<textarea', '生成回复文本', 'chip'):
            assert banned not in page, f'试听页混入表单件: {banned}'
    print('bgm_review selftest: 4/4 OK')


def main():
    ap = argparse.ArgumentParser(description='曲库标注轮试听页+题材候选清单（标注在对话内问）')
    ap.add_argument('--profiles', nargs='*', default=['assets/audio/bgm/profiles'],
                    help='档案目录或文件（默认曲库 profiles；默认只收 human_reviewed=false）')
    ap.add_argument('--audio-dir', default='assets/audio/bgm', help='音频目录（wav 优先，mp3 兜底）')
    ap.add_argument('--cands', default=None, help='题材候选 JSON（主控按画面语境供给，可缺省走程序预推）')
    ap.add_argument('--out', default='bgm-review.html', help='输出 HTML 路径（音频拷到同目录）')
    ap.add_argument('--title', default='曲库试听页', help='页标题')
    ap.add_argument('--include-reviewed', action='store_true', help='连已标注档案一起收（翻案用）')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return
    cands = json.loads(Path(args.cands).read_text(encoding='utf-8')) if args.cands else {}
    pairs = load_profiles(args.profiles, include_reviewed=args.include_reviewed)
    if not pairs:
        raise SystemExit('没有待标注档案（human_reviewed 全为 true？翻案加 --include-reviewed）')
    plan = build_plan(pairs, cands)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    exts = copy_audio(plan, args.audio_dir, out.parent)
    curves = {stem: (p.get('bpm'), p.get('bpm_confidence'), p['duration_s'],
                     p.get('loudness', {}).get('rms_dbfs'), exts[stem], svg_curve(p))
              for stem, p in pairs}
    out.write_text(render_html(plan, curves, args.title), encoding='utf-8')
    print(f'bgm_review: {len(plan)} 曲试听页 -> {out}')
    print_ask_plan(plan)


if __name__ == '__main__':
    main()
