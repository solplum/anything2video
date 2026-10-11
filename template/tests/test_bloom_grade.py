"""bloom_grade 渲后辉光 grade 回归（桥接 selftest）。Run: uv run python -m unittest discover -s tests"""
import subprocess
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / 'scripts'


class BloomGradeSelftest(unittest.TestCase):
    def test_bloom_grade_selftest(self):
        """合成高对比片：白块外辉光抬升生效、远角近黑。"""
        r = subprocess.run([sys.executable, str(SCRIPTS / 'bloom_grade.py'), '--selftest'],
                           capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('-> PASS', r.stdout)
