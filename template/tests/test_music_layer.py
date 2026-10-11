"""beat_grid v4.3.0 硬化 + audio_features 连续反应层回归（桥接各自 selftest）。

Run: uv run python -m unittest discover -s tests
"""
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / 'scripts'


class MusicLayerSelftests(unittest.TestCase):
    def test_beat_grid_selftest(self):
        """点击轨测速/对格 + 结构化鼓型（kick 精修/小节相位裁决/三分类计数）。"""
        r = subprocess.run([sys.executable, str(SCRIPTS / 'beat_grid.py'), '--selftest'],
                           capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('-> PASS', r.stdout)
        self.assertIn('selftest[drums]', r.stdout)

    def test_audio_features_selftest(self):
        """通道齐/长度齐/值域/打击通道反应/网格字段/JSON 体积。"""
        r = subprocess.run([sys.executable, str(SCRIPTS / 'audio_features.py'), '--selftest'],
                           capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('-> PASS', r.stdout)
