"""Unit tests for scripts/probe_aesthetics.py."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'probe_aesthetics.py'
sys.path.insert(0, str(ROOT / 'scripts'))
import probe_aesthetics as pa  # noqa: E402


class AestheticsProbeTests(unittest.TestCase):
    def _balanced_canvas(self, bg=(244, 240, 232), fg=(24, 32, 38)):
        img = Image.new('RGB', (1280, 720), bg)
        draw = ImageDraw.Draw(img)
        # Balanced editorial top rule + left card + right graphic spanning top/mid zones
        draw.rectangle([56, 78, 1224, 82], fill=(180, 170, 155))
        draw.rectangle([70, 130, 560, 480], fill=(255, 254, 250), outline=fg, width=3)
        draw.rectangle([620, 150, 1180, 520], fill=(235, 228, 214), outline=fg, width=3)
        draw.ellipse([760, 220, 1020, 450], fill=(196, 69, 43))
        return img

    def test_clean_balanced_frame_with_high_contrast_scrim_passes_checks(self):
        img = self._balanced_canvas()
        draw = ImageDraw.Draw(img)
        # High-contrast dark pill + bright white block simulating crisp ScrimSubtitle
        draw.rounded_rectangle([380, 626, 900, 676], radius=24, fill=(24, 32, 38))
        for x in range(430, 850, 28):
            draw.rectangle([x, 640, x + 16, 662], fill=(250, 248, 243))
        res = pa.analyze_frame_array(np.asarray(img))
        self.assertEqual(res['issues'], [])
        self.assertIsNotNone(res['bottom_band_contrast'])
        self.assertGreater(res['bottom_band_contrast'], 8.0)

    def test_light_paper_dot_texture_with_scrim_passes_checks(self):
        img = self._balanced_canvas(bg=(244, 240, 232))
        draw = ImageDraw.Draw(img)
        # Subtle 32px editorial paper dot grid across whole canvas must not trigger low_contrast_band
        for gx in range(0, 1280, 32):
            for gy in range(0, 720, 32):
                draw.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(224, 219, 210))
        draw.rounded_rectangle([380, 626, 900, 676], radius=24, fill=(24, 32, 38))
        for x in range(430, 850, 28):
            draw.rectangle([x, 640, x + 16, 662], fill=(250, 248, 243))
        res = pa.analyze_frame_array(np.asarray(img))
        self.assertEqual(res['issues'], [])
        self.assertIsNotNone(res['bottom_band_contrast'])
        self.assertGreater(res['bottom_band_contrast'], 8.0)

    def test_purple_on_purple_bottom_band_triggers_low_contrast(self):
        img = self._balanced_canvas(bg=(12, 14, 22), fg=(235, 238, 245))
        draw = ImageDraw.Draw(img)
        # Purple progress bar + purple text right on top of it (low WCAG contrast)
        draw.rectangle([0, 635, 1280, 718], fill=(95, 48, 220))
        for x in range(360, 920, 24):
            draw.rectangle([x, 650, x + 14, 686], fill=(138, 92, 246))
        res = pa.analyze_frame_array(np.asarray(img))
        codes = [i['code'] for i in res['issues']]
        self.assertIn('low_contrast_band', codes)
        self.assertLess(res['bottom_band_contrast'], 4.5)

    def test_empty_top_half_with_bottom_cramming_triggers_deadzone(self):
        img = Image.new('RGB', (1280, 720), (240, 235, 222))
        draw = ImageDraw.Draw(img)
        # Everything crammed into y=440..595 (bottom of content area), top 48% dead empty
        for x in range(180, 1100, 90):
            draw.rectangle([x, 455, x + 65, 585], fill=(35, 45, 55))
        res = pa.analyze_frame_array(np.asarray(img))
        codes = [i['code'] for i in res['issues']]
        self.assertIn('severe_top_deadzone', codes)

    def test_vertical_stroke_piercing_subtitle_band_triggers_warning(self):
        img = self._balanced_canvas()
        draw = ImageDraw.Draw(img)
        # Narrow structural rod slicing straight down from main scene through subtitle band
        draw.rectangle([636, 360, 646, 695], fill=(20, 20, 20))
        res = pa.analyze_frame_array(np.asarray(img))
        codes = [i['code'] for i in res['issues']]
        self.assertIn('subtitle_band_pierce', codes)

    def test_cli_frames_directory_json_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            good_dir = Path(tmp) / 'good'
            bad_dir = Path(tmp) / 'bad'
            good_dir.mkdir()
            bad_dir.mkdir()
            self._balanced_canvas().save(good_dir / 'f_0001.png')
            bad = self._balanced_canvas(bg=(12, 14, 22), fg=(235, 238, 245))
            d = ImageDraw.Draw(bad)
            d.rectangle([0, 635, 1280, 718], fill=(95, 48, 220))
            for x in range(360, 920, 24):
                d.rectangle([x, 650, x + 14, 686], fill=(138, 92, 246))
            bad.save(bad_dir / 'f_0001.png')

            r_ok = subprocess.run([sys.executable, str(SCRIPT), '--frames', str(good_dir), '--json'],
                                  capture_output=True, text=True, check=False)
            self.assertEqual(r_ok.returncode, 0, r_ok.stderr)
            self.assertEqual(json.loads(r_ok.stdout)['status'], 'needs_review')

            r_bad = subprocess.run([sys.executable, str(SCRIPT), '--frames', str(bad_dir), '--json'],
                                   capture_output=True, text=True, check=False)
            self.assertEqual(r_bad.returncode, 1)
            self.assertEqual(json.loads(r_bad.stdout)['status'], 'failed')


if __name__ == '__main__':
    unittest.main()
