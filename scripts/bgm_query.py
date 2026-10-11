#!/usr/bin/env python3
"""bgm_query — 曲库主题反查（v4.2.0 主题索引的消费入口）。

按「题材 × 功能」读 assets/audio/bgm/profiles/*.json 逐段 theme_tags/func，输出命中段落排行，
供音乐编排表（reference/music-plan.md）提名。双轴词表与总定案见 reference/bgm-library.md 使用约定 4。

用法：
  uv run python scripts/bgm_query.py --theme 商业品牌 --func hero
  uv run python scripts/bgm_query.py --theme 国风古典 --min-sec 10 --top 3
自测：uv run python scripts/bgm_query.py --selftest

排序纪律（2026-10-11 用户定）：
  ①用户曲库优先权重——theme_annotations.by=user 的曲命中即恒排最前，其余才轮到 skill 曲池；
  ②同组内：功能精确命中 → 段时长贴近请求窗 → 能量档降序 → 曲长降序。
诚实口径：命中只代表"题材×功能标签相符"，落位前主控仍须给出编排表过用户拍板；
用户曲库无命中时按片型分工回退（bgm-bakeoff.md），不硬凑。
"""
import argparse
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PROFILES_DEFAULT = Path(__file__).resolve().parent.parent / 'assets' / 'audio' / 'bgm' / 'profiles'
THEMES = ('科技未来', '人文叙事', '情感抒情', '国风古典', '悬疑紧张', '欢快活力',
          '史诗宏大', '沉静冥想', '商业品牌', '知识科普')
FUNCS = ('钩子', '垫底', 'hero', '收尾')


def load_hits(profiles_dir, themes, funcs, min_sec, max_sec):
    """返回命中段落列表：{track, by, seg_start, seg_end, seg_dur, themes, func, level, in_candidates}。"""
    hits = []
    for prof_path in sorted(Path(profiles_dir).glob('*.json')):
        prof = json.loads(prof_path.read_text(encoding='utf-8'))
        if not prof.get('human_reviewed'):
            continue  # 未人工标注的档案不进提名池（bgm-library 纪律）
        by = (prof.get('theme_annotations') or {}).get('by', 'master')
        for seg in prof.get('segments', []):
            seg_themes = set(seg.get('theme_tags') or [])
            if themes and not seg_themes.intersection(themes):
                continue
            if funcs and seg.get('func') not in funcs:
                continue
            dur = float(seg['end']) - float(seg['start'])
            if dur < min_sec or (max_sec and dur > max_sec):
                continue
            hits.append({
                'track': prof['file'].split('/')[-1], 'by': by,
                'seg_start': float(seg['start']), 'seg_end': float(seg['end']), 'seg_dur': round(dur, 1),
                'themes': seg.get('theme_tags'), 'func': seg.get('func'), 'level': seg.get('level'),
                'in_candidates': prof.get('in_candidates', []), 'duration_s': prof.get('duration_s'),
            })
    return hits


def rank(hits, min_sec, max_sec):
    """用户曲恒最前；同组内段时长贴近窗中点 → 能量档降序 → 曲长降序。"""

    def window_mid():
        return (min_sec + max_sec) / 2 if max_sec else min_sec

    mid = window_mid()

    def key(h):
        dist = abs(min(max(h['seg_dur'], min_sec), max_sec or h['seg_dur']) - mid) if max_sec else abs(h['seg_dur'] - min_sec)
        return (0 if h['by'] == 'user' else 1, dist, -(h['level'] or 0), -(h['duration_s'] or 0))
    return sorted(hits, key=key)


def fmt(h):
    tag = '[用户曲]' if h['by'] == 'user' else '[曲池]  '
    ins = ' / '.join(f"{c['t']:.0f}s {c['kind']}" for c in h['in_candidates'][:2]) or '—'
    return (f"{tag} {h['track']} 段 {h['seg_start']:.1f}-{h['seg_end']:.1f}s（{h['seg_dur']:.1f}s，L{h['level']}）"
            f" {'/'.join(h['themes'])} · {h['func']} ｜ 曲内入点候选：{ins}")


def selftest() -> int:
    """两个假 profile：user 曲档位低但题材命中、master 曲档位更高——断言 user 曲仍排第一。"""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        (d / 'user-track.json').write_text(json.dumps({
            'track': 'user-track', 'file': 'x/user-track.wav', 'duration_s': 30, 'human_reviewed': True,
            'theme_annotations': {'by': 'user'}, 'in_candidates': [{'t': 17.4, 'kind': 'hook'}],
            'segments': [{'start': 17.0, 'end': 29.0, 'level': 4, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        (d / 'pool-track.json').write_text(json.dumps({
            'track': 'pool-track', 'file': 'x/pool-track.mp3', 'duration_s': 120, 'human_reviewed': True,
            'theme_annotations': {'by': 'master'}, 'in_candidates': [],
            'segments': [{'start': 10.0, 'end': 25.0, 'level': 5, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        hits = rank(load_hits(d, ['国风古典'], ['hero'], 8, None), 8, None)
        ok = len(hits) == 2 and hits[0]['by'] == 'user' and hits[0]['track'] == 'user-track.wav'
        # 题材不命中必须为空（不硬凑）
        none_hits = load_hits(d, ['情感抒情'], None, 0, None)
        ok = ok and not none_hits
        # 未标注档案不进池
        (d / 'unreviewed.json').write_text(json.dumps({
            'track': 'unreviewed', 'file': 'x/u.mp3', 'duration_s': 60, 'human_reviewed': False,
            'segments': [{'start': 0.0, 'end': 50.0, 'level': 5, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        ok = ok and all(h['track'] != 'u.mp3' for h in load_hits(d, ['国风古典'], None, 0, None))
        print(f"selftest: {'PASS' if ok else 'FAIL'}（user 置顶 / 题材过滤 / 未标注不入池）")
        return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--theme', action='append', help='题材过滤，可多次（词表：' + '/'.join(THEMES) + '）')
    ap.add_argument('--func', action='append', help='功能过滤，可多次（钩子/垫底/hero/收尾）')
    ap.add_argument('--min-sec', type=float, default=0, help='段落最短秒数')
    ap.add_argument('--max-sec', type=float, default=None, help='段落最长秒数')
    ap.add_argument('--top', type=int, default=6, help='输出条数（默认 6）')
    ap.add_argument('--profiles', default=str(PROFILES_DEFAULT), help='profiles 目录')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    hits = rank(load_hits(a.profiles, set(a.theme or []), set(a.func or []), a.min_sec, a.max_sec),
                a.min_sec, a.max_sec)
    if not hits:
        print('无命中：该题材×功能在曲库无合格段落——按 bgm-bakeoff.md 片型分工回退（程序编曲/新淘曲），不硬凑。')
        return
    for h in hits[:a.top]:
        print(fmt(h))
    print(f"—— 共 {len(hits)} 段命中，取前 {min(a.top, len(hits))}。提名后出音乐编排表（reference/music-plan.md）过用户拍板。")


if __name__ == '__main__':
    main()
