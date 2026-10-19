#!/usr/bin/env python3
"""Recorded-first BGM shortlist; labels suggest auditions, never prove taste or rights.

User tracks remain first in the reference list. Release candidates must have an
available source and explicit release_use metadata; owner=user is not a license.
Default shortlist has one segment per recording. --all-segments restores the
segment view. --reference uses reviewed theme tags, not acoustic similarity.
"""
import argparse
import json
import math
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
PROFILES_DEFAULT = ROOT / 'assets/audio/bgm/profiles'
THEMES = ('科技未来', '人文叙事', '情感抒情', '国风古典', '悬疑紧张', '欢快活力',
          '史诗宏大', '沉静冥想', '商业品牌', '知识科普', '黑色生命力', '都市高级感')
FUNCS = ('钩子', '垫底', 'hero', '收尾')


def owner_of(prof):
    if prof.get('owner') in ('user', 'skill'):
        return prof['owner']
    return 'user' if (prof.get('theme_annotations') or {}).get('by') == 'user' else 'skill'


def source_path(prof, root):
    # Profiles can retain Windows paths after migration. Do not guess a file
    # with the same basename elsewhere: require the recorded path or reanalyze.
    return Path(root) / str(prof['file']).replace('\\', '/')


def reference_tags(profiles_dir, references):
    tags = set()
    for ref in references:
        name = Path(ref).stem
        path = Path(profiles_dir) / (name + '.json')
        prof = json.loads(path.read_text(encoding='utf-8'))
        if not prof.get('human_reviewed'):
            raise ValueError(f'参考档案未人工标注: {ref}')
        for seg in prof.get('segments', []):
            tags.update(seg.get('theme_tags') or [])
    return tags


def load_hits(profiles_dir, themes, funcs, min_sec, max_sec, *,
              root=ROOT, use='reference', taste_tags=(), recent=()):
    """Return reviewed segments; use=release filters missing/unconfirmed sources.

    reference mode keeps user tracks even on theme mismatch, explicitly marked.
    release mode additionally requires a theme match for every owner.
    """
    hits = []
    recent = {Path(x).stem for x in recent}
    for prof_path in sorted(Path(profiles_dir).glob('*.json')):
        prof = json.loads(prof_path.read_text(encoding='utf-8'))
        if not prof.get('human_reviewed'):
            continue
        owner = owner_of(prof)
        source = source_path(prof, root)
        available = source.is_file() and source.stat().st_size > 0
        rights = prof.get('release_use') or {}
        cleared = (rights.get('status') == 'cleared'
                   and bool(rights.get('evidence')) and bool(rights.get('license')))
        for seg in prof.get('segments', []):
            seg_themes = set(seg.get('theme_tags') or [])
            matched = not themes or bool(seg_themes.intersection(themes))
            if owner != 'user' and not matched:
                continue
            if funcs and seg.get('func') not in funcs:
                continue
            start, end = float(seg['start']), float(seg['end'])
            if not all(math.isfinite(v) for v in (start, end)) or start < 0 or end <= start:
                continue
            dur = end - start
            if dur < min_sec or (max_sec is not None and dur > max_sec):
                continue
            eligible = available and cleared and matched
            if use == 'release' and not eligible:
                continue
            track = str(prof['file']).replace('\\', '/').split('/')[-1]
            hits.append({
                'track': track, 'track_id': prof.get('sha256') or str(source.resolve()),
                'owner': owner, 'theme_matched': matched,
                'seg_start': start, 'seg_end': end, 'seg_dur': round(dur, 3),
                'themes': sorted(seg_themes), 'func': seg.get('func'), 'level': seg.get('level'),
                'in_candidates': [c for c in prof.get('in_candidates', [])
                                  if start <= float(c['t']) < end],
                'duration_s': prof.get('duration_s'), 'source': str(source),
                'available': available, 'release_cleared': bool(cleared),
                'release_eligible': bool(eligible), 'license': rights.get('license') or prof.get('license') or '未登记',
                'reference_overlap': sorted(seg_themes.intersection(taste_tags)),
                'recent': Path(track).stem in recent or prof_path.stem in recent,
            })
    return hits


def rank(hits, min_sec, max_sec, *, distinct=True):
    """User-first; match, recent-use penalty, reference tags, duration, stable ID.

    Relative energy level and low-confidence BPM are not cross-track scores.
    """
    target = (min_sec + max_sec) / 2 if max_sec is not None else min_sec
    ordered = sorted(hits, key=lambda h: (
        h['owner'] != 'user', not h['theme_matched'], h.get('recent', False),
        -len(h.get('reference_overlap', [])), abs(h['seg_dur'] - target),
        h['track'], h['seg_start']))
    if not distinct:
        return ordered
    # Join both content IDs and normalized source paths before selecting a
    # winner, so hashed/unhashed profiles and transitive aliases cannot repeat.
    parents = {}

    def find(key):
        parents.setdefault(key, key)
        if parents[key] != key:
            parents[key] = find(parents[key])
        return parents[key]

    def identities(h):
        content = ('content', h.get('track_id', h['track']))
        source = ('source', str(Path(h['source']).resolve())) if h.get('source') else content
        return content, source

    for h in ordered:
        content, source = identities(h)
        parents[find(content)] = find(source)
    seen, result = set(), []
    for h in ordered:
        key = find(identities(h)[0])
        if key not in seen:
            result.append(h)
            seen.add(key)
    return result


def fmt(h):
    flags = []
    if not h['available']:
        flags.append('音源缺失')
    if not h['release_cleared']:
        flags.append('发布许可未确认')
    if not h['theme_matched']:
        flags.append('题材未命中·仅参考')
    if h['recent']:
        flags.append('近期用过')
    if h['reference_overlap']:
        flags.append('参考标签重合=' + '/'.join(h['reference_overlap']))
    return (f"[{'用户曲' if h['owner'] == 'user' else '曲池'}] {h['track']} "
            f"{h['seg_start']:.1f}-{h['seg_end']:.1f}s · {'/'.join(h['themes'])} · "
            f"{h['func']} ｜ {'；'.join(flags) or '有音源、有许可登记；仍需试听与发布用途核验'}")


def selftest():
    import unittest
    suite = unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_bgm_query.py')
    if suite.countTestCases() == 0:
        print('FAIL: no BGM query tests found', file=sys.stderr)
        return 1
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--theme', action='append')
    ap.add_argument('--func', action='append', choices=FUNCS)
    ap.add_argument('--min-sec', type=float, default=0)
    ap.add_argument('--max-sec', type=float)
    ap.add_argument('--top', type=int, default=6, help='不同录音数量（默认 6）')
    ap.add_argument('--profiles', default=str(PROFILES_DEFAULT))
    ap.add_argument('--root', default=str(ROOT), help='档案中相对音频路径的根目录')
    ap.add_argument('--reference', action='append', default=[], help='参考 profile 名称，可重复；仅比较题材标签')
    ap.add_argument('--recent', action='append', default=[], help='近期用过的曲名/文件名，可重复，组内降权')
    ap.add_argument('--use', choices=('release', 'reference'), default='release')
    ap.add_argument('--all-segments', action='store_true')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if (not math.isfinite(a.min_sec) or a.min_sec < 0 or a.top < 1
            or (a.max_sec is not None and (not math.isfinite(a.max_sec) or a.max_sec < a.min_sec))):
        ap.error('要求 0 <= min-sec <= max-sec，top >= 1，秒数必须有限')
    try:
        taste = reference_tags(a.profiles, a.reference)
        all_hits = load_hits(a.profiles, set(a.theme or []), set(a.func or []),
                             a.min_sec, a.max_sec, root=a.root, taste_tags=taste, recent=a.recent)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        ap.error(str(exc))
    candidates = [h for h in all_hits if h['release_eligible']] if a.use == 'release' else all_hits
    candidates = rank(candidates, a.min_sec, a.max_sec, distinct=not a.all_segments)[:a.top]
    # Reference-only user entries stay visible, but never consume release slots.
    references = rank([h for h in all_hits if h['owner'] == 'user' and not h['release_eligible']],
                      a.min_sec, a.max_sec)
    result = {'use': a.use, 'user_references': references if a.use == 'release' else [],
              'candidates': candidates, 'shortfall': max(0, a.top - len(candidates)),
              'note': '标签匹配不是听感相似度；缺候选时补录音曲，不自动生成程序配乐。'}
    if a.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result['user_references']:
            print('用户曲参考（置顶对照，不作为已确认发布候选）：')
            for h in result['user_references']:
                print(fmt(h))
        print('发布候选：' if a.use == 'release' else '参考浏览（不代表可发布）：')
        for h in candidates:
            print(fmt(h))
        if result['shortfall']:
            print(f"候选不足：请求 {a.top}，实际 {len(candidates)}。补充同气质可用录音曲或保留无音乐；程序编曲仅显式选择。")
        print(result['note'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
