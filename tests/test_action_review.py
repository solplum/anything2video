"""Real FFmpeg fixtures and boundary checks for advisory action-review evidence."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('action_review', ROOT / 'scripts/action_review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class ValidationTests(unittest.TestCase):
    def test_invalid_windows(self):
        for value in ['nan,1', '0,inf', '-1,2', '2,1', '0,31', '0', '0,0']:
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                review.window(value)

    def test_invalid_rois(self):
        for value in ['0,0,0,1', '-.1,0,1,1', '0,0,1.1,1', '0,0,nan,1', '.5,.5,.6,.6']:
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                review.roi(value)

    def test_selection_uses_pts_and_deduplicates(self):
        self.assertEqual(review.select_frames([0, .1, .2, .7, .9], (0, .9), 8), [0, 2, 3, 4])
        with self.assertRaises(ValueError):
            review.select_frames([0, .1], (0, .2), 8)
        with self.assertRaises(ValueError):
            review.select_frames([0, .1], (.01, .09), 8)

    def test_default_interval_and_budget(self):
        times = [i / 10 for i in range(101)]
        self.assertEqual(review.select_frames(times, (0, 1)), [0, 2, 4, 6, 8, 10])
        self.assertEqual(review.select_frames(times, (0, .95)), [0, 2, 4, 6, 8])
        for interval in [0, -1, float('nan'), float('inf'), .001, 1e-320]:
            with self.assertRaises(ValueError):
                review.select_frames(times, (0, 1), interval=interval)
        with self.assertRaises(ValueError):
            review.select_frames(times, (0, 5))

    def test_unsupported_timestamps_and_rotation(self):
        for frames, side in [([{}, {}], []), ([{'best_effort_timestamp_time': '0'}] * 2, []),
                             ([{'best_effort_timestamp_time': 'nan'}], []),
                             ([{'best_effort_timestamp_time': '0'}], [{'rotation': 90}])]:
            data = {'streams': [{'width': 20, 'height': 20, 'side_data_list': side}], 'frames': frames}
            with patch.object(review, 'run', return_value=json.dumps(data)), self.assertRaises(ValueError):
                review.probe(Path('unused'))


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'requires ffmpeg and ffprobe')
class VideoTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def video(self, fps=30, filter=None):
        path = self.root / f'fixture-{fps}-{len(list(self.root.glob("*.mp4")))}.mp4'
        args = ['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'testsrc2=size=160x90:rate={fps}:duration=2']
        if filter:
            args += ['-vf', filter, '-vsync', '0']
        subprocess.run(args + ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(path)], check=True, capture_output=True)
        return path

    def test_cfr_rates_and_provenance(self):
        for fps in [24, 30, 60]:
            with self.subTest(fps=fps):
                video = self.video(fps)
                out = self.root / f'review-{fps}'
                report = review.generate(video, out, [(0, 1.5), (.5, 1)], 4, (.1, .1, .5, .5))
                self.assertEqual(report['status'], 'needs_review')
                self.assertNotIn('pass', report)
                self.assertEqual(report['videoSha256'], review.sha256(video))
                self.assertEqual(report['decodedFrameCount'], fps * 2)
                self.assertEqual(report['windows'][0]['frames'][1]['index'], fps // 2)
                for window in report['windows']:
                    self.assertEqual(window['stripSha256'], review.sha256(out / window['strip']))
                    with Image.open(out / window['strip']) as im:
                        self.assertEqual(im.size, (1344, 478))
                    for frame in window['frames']:
                        self.assertAlmostEqual(frame['timeSec'], frame['index'] / fps, places=5)
                with self.assertRaises(ValueError):
                    review.generate(video, out, [(0, 1)])

    def test_frame_interval_respects_ffprobe_microsecond_rounding(self):
        video = self.video(30)
        report = review.generate(video, self.root / 'framewise', [(0, .3)], interval=1 / 30)
        self.assertEqual([f['index'] for f in report['windows'][0]['frames']], list(range(10)))
        report = review.generate(video, self.root / 'fractional-end', [(0, 5 / 30)], interval=1 / 30)
        self.assertEqual([f['index'] for f in report['windows'][0]['frames']], list(range(6)))
        self.assertEqual(review.select_frames([0, .033333, .066667, .1, .133333, .166667], (0, 5 / 30), interval=1 / 30), list(range(6)))

    def test_vfr_and_nonzero_origin(self):
        # 10fps for first second, 30fps thereafter, timestamps kept intact.
        video = self.video(30, "select='if(lt(t,1),not(mod(n,3)),1)'")
        report = review.generate(video, self.root / 'vfr', [(0, 1.8)], 8)
        frames = report['windows'][0]['frames']
        self.assertEqual(report['decodedFrameCount'], 40)
        self.assertGreater(frames[-1]['timeSec'], frames[-1]['index'] / 30 + .5)
        self.assertEqual(len({f['index'] for f in frames}), len(frames))
        offset = self.video(24, 'setpts=PTS+5/TB')
        report = review.generate(offset, self.root / 'offset', [(0, 1)], 3)
        self.assertEqual(report['firstFramePtsSec'], 5)
        self.assertEqual(report['windows'][0]['frames'][0]['timeSec'], 0)
        self.assertEqual(report['windows'][0]['frames'][0]['ptsSec'], 5)

    def test_failure_leaves_no_bundle_and_preserves_source(self):
        video = self.video()
        digest = review.sha256(video)
        for bounds in [[(0, 3)], [(float('nan'), 1)], []]:
            with self.assertRaises((ValueError, argparse.ArgumentTypeError)):
                review.generate(video, self.root / 'bad', bounds)
            self.assertFalse((self.root / 'bad').exists())
        with patch.object(review, 'make_strip', side_effect=ValueError('fixture failure')), self.assertRaises(ValueError):
            review.generate(video, self.root / 'failed', [(0, 1)])
        self.assertFalse((self.root / 'failed').exists())
        self.assertFalse(list(self.root.glob('.action-review-*')))
        self.assertEqual(review.sha256(video), digest)
        real_hash = review.sha256
        calls = []
        def changing_hash(path):
            if path == video:
                calls.append(path)
                return digest if len(calls) == 1 else '0' * 64
            return real_hash(path)
        with patch.object(review, 'sha256', side_effect=changing_hash), self.assertRaises(ValueError):
            review.generate(video, self.root / 'changed', [(0, 1)])
        self.assertFalse((self.root / 'changed').exists())
        with self.assertRaises(ValueError):
            review.generate(video, video, [(0, 1)])


class SheetTests(unittest.TestCase):
    def test_explicit_fps_and_filename_times(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            frames = root / 'frames & #'
            frames.mkdir()
            for n in [1, 25, 49]:
                Image.new('RGB', (10, 10)).save(frames / f'f_{n:04d}.jpg')
            out = root / 'sheet.html'
            command = ['python', str(ROOT / 'template/scripts/sheet.py'), str(frames), str(out), '1', '3']
            subprocess.run(command + ['--fps', '24'], check=True, capture_output=True)
            page = out.read_text()
            self.assertIn('f1 (0.000s)', page)
            self.assertIn('f25 (1.000s)', page)
            self.assertIn('f49 (2.000s)', page)
            self.assertIn('frames%20%26%20%23/', page)
            subprocess.run(command, check=True, capture_output=True)
            self.assertIn('30 fps ASSUMED', out.read_text())
            for args in [['--fps', 'nan'], ['--fps', '0'], ['--fps', 'inf']]:
                self.assertNotEqual(subprocess.run(command + args, capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
