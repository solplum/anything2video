#!/usr/bin/env python3
"""Frame-directory contact sheet (CFR only).

sheet.py <frames_dir> <out.html> [step=60] [cols=6] [--fps FPS]
Legacy default is explicitly declared as assumed 30fps. f_0001.jpg means time 0.
Use action_review.py on the rendered video for actual PTS/VFR evidence.
"""
import argparse
import html
import json
import math
import os
import re
from pathlib import Path
from urllib.parse import quote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('frames_dir', type=Path)
    parser.add_argument('out', type=Path)
    parser.add_argument('step', nargs='?', type=int, default=60)
    parser.add_argument('cols', nargs='?', type=int, default=6)
    parser.add_argument('--fps', type=float, default=None)
    args = parser.parse_args()
    fps = 30 if args.fps is None else args.fps
    if not math.isfinite(fps) or fps <= 0 or args.step <= 0 or not 1 <= args.cols <= 24:
        parser.error('fps and step must be positive and finite; cols must be 1-24')
    if not args.frames_dir.is_dir():
        parser.error('frames_dir must be a directory')
    files = []
    for path in args.frames_dir.glob('f_*.jpg'):
        match = re.fullmatch(r'f_(\d+)\.jpg', path.name)
        if match and int(match[1]) >= 1:
            files.append((int(match[1]), path))
    files.sort()
    if not files:
        parser.error('no one-based f_<number>.jpg frames found')
    if args.out.resolve() in [p.resolve() for _, p in files]:
        parser.error('output must not overwrite an input frame')
    tlp = Path(__file__).resolve().parents[1] / 'script' / 'timeline.json'
    tl = json.loads(tlp.read_text(encoding='utf-8')) if tlp.exists() else None

    def sent_at(n):
        for s in (tl or {}).get('sentences', []):
            if s['from'] <= n <= s['to']:
                return html.escape(f"{s['id']} {s['text'][:18]}")
        return ''

    cells = []
    for n, path in files[::args.step]:
        src = html.escape(quote(os.path.relpath(path, args.out.resolve().parent), safe='/'), quote=True)
        cells.append(f'<div class="c"><img loading="lazy" src="{src}"><div class="l">f{n} ({(n - 1) / fps:.3f}s) <span>{sent_at(n)}</span></div></div>')
    basis = f'{fps:g} fps (explicit CFR input)' if args.fps is not None else '30 fps ASSUMED legacy default; pass --fps for other CFR rates'
    page = f'''<!doctype html><meta charset="utf-8"><title>sheet</title>
<style>body{{background:#111;color:#ddd;font:12px/1.4 sans-serif;margin:8px}} .g{{display:grid;grid-template-columns:repeat({args.cols},1fr);gap:6px}} .c img{{width:100%;display:block}} .l{{padding:2px 0 6px}} .l span{{color:#9a8}}</style>
<h3>成片缩略图 · 每 {args.step} 张一张 · 共 {len(files)} 张</h3>
<p>{basis}. One-based filenames: f1 = 0s. Frame directory only; no verified media timestamps. VFR: use action_review.py.</p>
<div class="g">{''.join(cells)}</div>'''
    args.out.write_text(page, encoding='utf-8')
    print('sheet', args.out, len(cells), 'cells;', basis)


if __name__ == '__main__':
    main()
