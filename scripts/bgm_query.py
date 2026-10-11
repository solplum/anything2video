#!/usr/bin/env python3
"""bgm_query — 曲库主题反查（v4.2.0 主题索引的消费入口）。

按「题材 × 功能」读 assets/audio/bgm/profiles/*.json 逐段 theme_tags/func，输出命中段落排行，
供音乐编排表（reference/music-plan.md）提名。双轴词表与总定案见 reference/bgm-library.md 使用约定 4。

用法：
  uv run python scripts/bgm_query.py --theme 商业品牌 --func hero
  uv run python scripts/bgm_query.py --theme 国风古典 --min-sec 10 --top 3
自测：uv run python scripts/bgm_query.py --selftest

排序铁律（2026-10-11 用户两度定调「用户的音乐一定要放在最前面」）：
  ①owner=user 的曲**永远出现在候选最前**——题材命中排最前；题材未命中的用户曲段也照常展示
  （标注「题材未命中·仅参考」），绝不从候选里消失；
  ②owner 字段是机器可读硬标记（bgm_analyze --owner 写入，user=用户自加曲/skill=skill 曲池）；
  ③用户曲之后，skill 曲池按 功能精确命中 → 段时长贴近请求窗 → 能量档降序 → 曲长降序；
  ④用户曲题材未命中时供参考不硬凑——最终落位仍由用户拍板（编排表纪律）。
诚实口径：命中只代表"题材×功能标签相符"；用户曲库无命中时按 bgm-bakeoff.md 片型分工回退。
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


def owner_of(prof: dict) -> str:
    """owner 硬字段优先，缺省回退 theme_annotations.by（老档案兼容）。"""
    if prof.get('owner') in ('user', 'skill'):
        return prof['owner']
    return (prof.get('theme_annotations') or {}).get('by', 'skill')


def load_hits(profiles_dir, themes, funcs, min_sec, max_sec):
    """返回命中段落：{track, owner, theme_matched, seg_start, seg_end, seg_dur, themes, func, level, in_candidates}。

    用户曲（owner=user）只受功能过滤、不受题材过滤（题材未命中也返回并打标）——置顶铁律；
    skill 曲池同时受题材与功能过滤。未人工标注（human_reviewed=false）的档案一律不入池。
    """
    hits = []
    for prof_path in sorted(Path(profiles_dir).glob('*.json')):
        prof = json.loads(prof_path.read_text(encoding='utf-8'))
        if not prof.get('human_reviewed'):
            continue  # 未人工标注的档案不进提名池（bgm-library 纪律）
        owner = owner_of(prof)
        for seg in prof.get('segments', []):
            seg_themes = set(seg.get('theme_tags') or [])
            theme_matched = bool(not themes or seg_themes.intersection(themes))
            if owner != 'user':
                if themes and not theme_matched:
                    continue
            if funcs and seg.get('func') not in funcs:
                continue
            dur = float(seg['end']) - float(seg['start'])
            if dur < min_sec or (max_sec and dur > max_sec):
                continue
            hits.append({
                'track': prof['file'].split('/')[-1], 'owner': owner, 'theme_matched': theme_matched,
                'seg_start': float(seg['start']), 'seg_end': float(seg['end']), 'seg_dur': round(dur, 1),
                'themes': seg.get('theme_tags'), 'func': seg.get('func'), 'level': seg.get('level'),
                'in_candidates': prof.get('in_candidates', []), 'duration_s': prof.get('duration_s'),
            })
    return hits


def rank(hits, min_sec, max_sec):
    """用户曲恒置顶（组内题材命中优先）；曲池组按段时长贴窗 → 能量档降序 → 曲长降序。"""
    mid = (min_sec + max_sec) / 2 if max_sec else min_sec

    def pool_key(h):
        dist = abs(min(max(h['seg_dur'], min_sec), max_sec or h['seg_dur']) - mid) if max_sec else abs(h['seg_dur'] - min_sec)
        return (dist, -(h['level'] or 0), -(h['duration_s'] or 0))

    user = [h for h in hits if h['owner'] == 'user']
    pool = [h for h in hits if h['owner'] != 'user']
    user.sort(key=lambda h: (not h['theme_matched'], -(h['level'] or 0)))
    pool.sort(key=pool_key)
    return user + pool


def fmt(h):
    tag = '[用户曲]' if h['owner'] == 'user' else '[曲池]  '
    theme_note = '' if h['owner'] != 'user' or h['theme_matched'] else '（题材未命中·仅参考）'
    ins = ' / '.join(f"{c['t']:.0f}s {c['kind']}" for c in h['in_candidates'][:2]) or '—'
    return (f"{tag} {h['track']} 段 {h['seg_start']:.1f}-{h['seg_end']:.1f}s（{h['seg_dur']:.1f}s，L{h['level']}）"
            f" {'/'.join(h['themes'])} · {h['func']}{theme_note} ｜ 曲内入点候选：{ins}")


def selftest() -> int:
    """断言：①题材命中时 user 曲排第一；②题材未命中 user 曲仍置顶展示且带标注；③skill 曲池题材过滤；④未标注不入池。"""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        d = Path(tmp)
        (d / 'user-track.json').write_text(json.dumps({
            'track': 'user-track', 'file': 'x/user-track.wav', 'owner': 'user', 'duration_s': 30,
            'human_reviewed': True, 'theme_annotations': {'by': 'user'},
            'in_candidates': [{'t': 17.4, 'kind': 'hook'}],
            'segments': [{'start': 17.0, 'end': 29.0, 'level': 4, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        (d / 'pool-track.json').write_text(json.dumps({
            'track': 'pool-track', 'file': 'x/pool-track.mp3', 'owner': 'skill', 'duration_s': 120,
            'human_reviewed': True, 'theme_annotations': {'by': 'master'},
            'in_candidates': [],
            'segments': [{'start': 10.0, 'end': 25.0, 'level': 5, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        (d / 'unreviewed.json').write_text(json.dumps({
            'track': 'unreviewed', 'file': 'x/u.mp3', 'owner': 'skill', 'duration_s': 60,
            'human_reviewed': False,
            'segments': [{'start': 0.0, 'end': 50.0, 'level': 5, 'theme_tags': ['国风古典'], 'func': 'hero'}],
        }, ensure_ascii=False), encoding='utf-8')
        # 命中场景：user 第一
        hit = rank(load_hits(d, ['国风古典'], ['hero'], 8, None), 8, None)
        ok = len(hit) == 2 and hit[0]['owner'] == 'user' and hit[0]['theme_matched']
        # 未命中场景：query 情感抒情——user 曲仍置顶展示（打未命中标），曲池曲目被题材过滤掉
        miss = rank(load_hits(d, ['情感抒情'], ['hero'], 8, None), 8, None)
        ok = ok and len(miss) == 1 and miss[0]['owner'] == 'user' and not miss[0]['theme_matched']
        # 未标注不入池
        ok = ok and all(h['track'] != 'u.mp3' for h in load_hits(d, ['国风古典'], None, 0, None))
        print(f"selftest: {'PASS' if ok else 'FAIL'}（user 置顶含未命中场景 / 曲池题材过滤 / 未标注不入池）")
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
        print('无命中：曲库（含用户曲库）无合格段落——按 bgm-bakeoff.md 片型分工回退（程序编曲/新淘曲），不硬凑。')
        return
    for h in hits[:a.top]:
        print(fmt(h))
    user_note = ''
    user_all = [h for h in hits if h['owner'] == 'user']
    if user_all and not any(h['theme_matched'] for h in user_all):
        user_note = '｜⚠ 用户曲库无本题材命中，置顶仅供对照——按纪律回退曲池，不硬凑'
    print(f"—— 共 {len(hits)} 段命中（用户曲 {len(user_all)} 段恒置顶），取前 {min(a.top, len(hits))}。"
          f"提名后出音乐编排表（reference/music-plan.md）过用户拍板。{user_note}")


if __name__ == '__main__':
    main()
