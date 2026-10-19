#!/usr/bin/env python3
# /// script
# dependencies = ["pillow>=11"]
# ///
"""Create advisory action-continuity strips from selected windows of a local render.

Requires ffmpeg/ffprobe and Pillow. Times are seconds relative to the first decoded
video frame, from actual presentation timestamps (including VFR), never index/fps.
Exit 0 means evidence generated, NOT visual quality passed; errors exit 2.
"""
import argparse
import bisect
import hashlib
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ADVISORY = 'needs_review: inspect action/contact/handoff/tracking in playback; strips cannot prove continuity or quality. Intentional stillness is valid.'


def numbers(value, count):
    try:
        result = tuple(float(v) for v in value.split(','))
    except ValueError as exc:
        raise argparse.ArgumentTypeError('use comma-separated finite numbers') from exc
    if len(result) != count or not all(math.isfinite(v) for v in result):
        raise argparse.ArgumentTypeError(f'expected {count} finite numbers')
    return result


def window(value):
    start, end = numbers(value, 2)
    if start < 0 or end <= start or end - start > 30:
        raise argparse.ArgumentTypeError('window must satisfy 0 <= start < end; maximum length 30 seconds')
    return start, end


def roi(value):
    x, y, w, h = numbers(value, 4)
    if min(x, y) < 0 or min(w, h) <= 0 or x + w > 1 or y + h > 1:
        raise argparse.ArgumentTypeError('ROI is normalized x,y,width,height within [0,1]')
    return x, y, w, h


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=180).stdout


def sha256(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def probe(video):
    data = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_streams', '-show_frames', '-show_entries',
        'stream=width,height,avg_frame_rate,r_frame_rate,time_base:stream_tags=rotate:stream_side_data=rotation:frame=best_effort_timestamp_time',
        '-of', 'json', str(video)]))
    streams = data.get('streams', [])
    if len(streams) != 1:
        raise ValueError('no readable first video stream')
    stream = streams[0]
    if int(stream['width']) <= 0 or int(stream['height']) <= 0:
        raise ValueError('invalid video dimensions')
    rotations = [stream.get('tags', {}).get('rotate', 0)] + [s.get('rotation', 0) for s in stream.get('side_data_list', [])]
    if any(float(v) % 360 for v in rotations):
        raise ValueError('rotation metadata is unsupported; normalize orientation before review')
    try:
        pts = [float(f['best_effort_timestamp_time']) for f in data['frames']]
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError('every decoded frame must have a presentation timestamp') from exc
    if not pts or not all(math.isfinite(t) for t in pts) or any(b <= a for a, b in zip(pts, pts[1:])):
        raise ValueError('presentation timestamps must be finite and strictly increasing')
    origin = pts[0]
    return stream, pts, [t - origin for t in pts]


def select_frames(times, bounds, samples=None, interval=0.2):
    start, end = bounds
    if end > times[-1] + 1e-6:
        raise ValueError(f'window end exceeds last frame timestamp ({times[-1]:.6f}s)')
    if samples is not None:
        targets = [start + (end - start) * i / (samples - 1) for i in range(samples)]
    else:
        if not math.isfinite(interval) or interval <= 0:
            raise ValueError('interval must be finite and positive')
        ratio = (end - start) / interval
        if not math.isfinite(ratio) or ratio >= 24:
            raise ValueError('window exceeds 24 sample budget; shorten window or increase --interval')
        count = math.floor(ratio + 1e-9) + 1
        if count > 24:
            raise ValueError('window exceeds 24 sample budget; shorten window or increase --interval')
        targets = [start + i * interval for i in range(count)]
        if end - targets[-1] > 1e-6:
            targets.append(end)
        if len(targets) > 24:
            raise ValueError('window including endpoint exceeds 24 sample budget; shorten window or increase --interval')
    # First frame at or after each target, bounded to the requested closed window.
    indices = sorted({bisect.bisect_left(times, t - 1e-6) for t in targets})
    indices = [i for i in indices if i < len(times) and times[i] <= end + 1e-6]
    if len(indices) < 2:
        raise ValueError('window contains fewer than two distinct sampled frames; widen it')
    return indices


def crop_box(region, size):
    x, y, w, h = region
    width, height = size
    box = (math.floor(x * width), math.floor(y * height), math.ceil((x + w) * width), math.ceil((y + h) * height))
    if box[2] <= box[0] or box[3] <= box[1]:
        raise ValueError('ROI is smaller than one source pixel')
    return box


def make_strip(paths, indices, times, region, bounds, target):
    columns = min(4, len(indices))
    cell_w, cell_h = 336, 408 if region else 216
    sheet = Image.new('RGB', (columns * cell_w, 70 + math.ceil(len(indices) / columns) * cell_h), '#161a20')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 10), f'ACTION REVIEW | {bounds[0]:.3f}-{bounds[1]:.3f}s | needs_review', fill='white')
    draw.text((12, 30), 'Actual PTS relative to first frame; n = zero-based decoded index.', fill='#bfc8d5')
    draw.text((12, 48), 'Advisory only. Review full playback and intended action/stillness.', fill='#f5c66a')
    for k, index in enumerate(indices):
        x, y = (k % columns) * cell_w + 8, 70 + (k // columns) * cell_h
        with Image.open(paths[index]) as im:
            original = im.convert('RGB')
        full = original.copy()
        box = crop_box(region, full.size) if region else None
        if box:
            ImageDraw.Draw(full).rectangle(box, outline='#ff5757', width=max(1, full.width // 160))
        sheet.paste(ImageOps.pad(full, (320, 180), color='#080a0d'), (x, y))
        draw.text((x, y + 184), f'n={index}  t={times[index]:.6f}s', fill='white')
        if box:
            sheet.paste(ImageOps.pad(original.crop(box), (320, 180), color='#080a0d'), (x, y + 208))
            draw.text((x, y + 390), 'ROI (fixed source coordinates)', fill='#ffaaaa')
    sheet.save(target)


def generate(video, out, windows, samples=None, region=None, interval=0.2):
    video = Path(video).expanduser().resolve(strict=True)
    out = Path(out).expanduser().absolute()
    if not video.is_file():
        raise ValueError('video must be a regular local file')
    if out.exists() or out.is_symlink():
        raise ValueError('output already exists; choose a new directory (no overwrite)')
    if not 1 <= len(windows) <= 12 or (samples is not None and not 2 <= samples <= 24):
        raise ValueError('use 1-12 windows and 2-24 samples per window')
    # Revalidate programmatic inputs as well as CLI arguments.
    windows = [window(','.join(map(str, b))) for b in windows]
    region = roi(','.join(map(str, region))) if region is not None else None
    before = sha256(video)
    stream, pts, times = probe(video)
    selected = [select_frames(times, bounds, samples, interval) for bounds in windows]
    indices = sorted(set(i for group in selected for i in group))
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.action-review-', dir=out.parent) as temp:
        temp = Path(temp)
        frames = temp / 'frames'
        frames.mkdir()
        expression = '+'.join(f'eq(n,{i})' for i in indices)
        run(['ffmpeg', '-v', 'error', '-noautorotate', '-i', str(video), '-map', '0:v:0',
            '-vf', f"select='{expression}'", '-vsync', '0', '-frames:v', str(len(indices)),
            str(frames / 'frame-%04d.png')])
        extracted = sorted(frames.glob('frame-*.png'))
        if len(extracted) != len(indices):
            raise ValueError('decoded frame count differs from timestamp selection')
        paths = dict(zip(indices, extracted))
        report = {'schemaVersion': 1, 'tool': 'action_review', 'status': 'needs_review',
            'advisory': ADVISORY, 'video': str(video), 'videoSha256': before,
            'timestampBasis': 'best_effort_timestamp_time minus first decoded frame PTS',
            'firstFramePtsSec': pts[0], 'lastFrameTimeSec': times[-1],
            'stream': stream, 'decodedFrameCount': len(times),
            'sampling': 'first frame at/after targets, within closed window; duplicates removed; end target included',
            'intervalSec': interval if samples is None else None,
            'requestedSamplesPerWindow': samples, 'roiNormalized': region,
            'reviewChecklist': ['Compare intended action with approach/contact/transfer/release/settle.',
                'Check object identity, contact point, tracking, occlusion and camera changes in playback.',
                'Record defects and intentional stillness; rerender fixes and regenerate evidence.'],
            'windows': []}
        for i, (bounds, group) in enumerate(zip(windows, selected), 1):
            name = f'window-{i:02d}.png'
            make_strip(paths, group, times, region, bounds, temp / name)
            report['windows'].append({'startSec': bounds[0], 'endSec': bounds[1],
                'strip': name, 'stripSha256': sha256(temp / name),
                'frames': [{'index': n, 'ptsSec': pts[n], 'timeSec': times[n], 'frameSha256': sha256(paths[n])} for n in group]})
        if sha256(video) != before:
            raise ValueError('source changed during review; regenerate evidence')
        shutil.rmtree(frames)
        (temp / 'review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        # Rename the complete bundle; never publish partial evidence on errors.
        if out.exists() or out.is_symlink():
            raise ValueError('output appeared during generation; refusing overwrite')
        temp.rename(out)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', help='local rendered video')
    parser.add_argument('--window', action='append', required=True, type=window, metavar='START,END', help='seconds; repeat up to 12 times, max 30s each')
    parser.add_argument('--roi', type=roi, metavar='X,Y,W,H', help='optional fixed normalized crop, shown below full frame')
    sampling = parser.add_mutually_exclusive_group()
    sampling.add_argument('--samples', type=int, help='2-24 evenly spaced target samples per window, instead of interval')
    sampling.add_argument('--interval', type=float, default=0.2, help='target spacing seconds (default 0.2), max 24 targets/window including end')
    parser.add_argument('--out', required=True, help='new output directory; never overwritten')
    args = parser.parse_args()
    try:
        generate(args.video, args.out, args.window, args.samples, args.roi, args.interval)
    except (ValueError, OSError, subprocess.SubprocessError, argparse.ArgumentTypeError) as exc:
        parser.exit(2, f'action_review: {exc}\n')
    print(f'Evidence generated: {args.out}/review.json; needs_review (not a quality pass)')


if __name__ == '__main__':
    main()
