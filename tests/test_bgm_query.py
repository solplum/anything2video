import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bgm_query', ROOT / 'scripts/bgm_query.py')
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


class QueryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.profiles = self.root / 'profiles'
        self.profiles.mkdir()

    def add(self, name, owner='skill', tags=('商业品牌',), present=True,
            cleared=True, reviewed=True, level=3, sha=None):
        path = self.root / (name + '.wav')
        if present:
            path.write_bytes(b'test fixture, not playable audio')
        p = dict(file=name + '.wav', owner=owner, human_reviewed=reviewed,
                 segments=[dict(start=0, end=10, level=level, func='hero', theme_tags=tags)],
                 in_candidates=[dict(t=0, kind='start'), dict(t=20, kind='hook')])
        if sha:
            p['sha256'] = sha
        if cleared:
            p['release_use'] = dict(status='cleared', license='fixture', evidence='fixture record')
        (self.profiles / (name + '.json')).write_text(json.dumps(p), encoding='utf-8')
        return p

    def hits(self, **kw):
        return q.load_hits(self.profiles, {'商业品牌'}, {'hero'}, 0, None, root=self.root, **kw)

    def test_user_first_even_theme_mismatch_in_reference(self):
        self.add('user', owner='user', tags=['情感抒情'])
        self.add('pool')
        hits = q.rank(self.hits(), 0, None)
        self.assertEqual(hits[0]['track'], 'user.wav')
        self.assertFalse(hits[0]['theme_matched'])

    def test_release_rejects_missing_and_unconfirmed_and_mismatch(self):
        self.add('missing', present=False)
        self.add('unknown', owner='user', cleared=False)
        self.add('wrong', owner='user', tags=['情感抒情'])
        self.add('good')
        self.assertEqual([h['track'] for h in self.hits(use='release')], ['good.wav'])
        self.assertEqual(len(self.hits()), 4)

    def test_owner_is_not_license(self):
        self.add('user', owner='user', cleared=False)
        self.assertFalse(self.hits()[0]['release_cleared'])

    def test_review_required(self):
        self.add('unreviewed', reviewed=False)
        self.assertEqual(self.hits(), [])

    def test_distinct_recording_and_all_segments(self):
        p = self.add('a', sha='same-recording')
        p['segments'].append(dict(start=10, end=22, level=5, func='hero', theme_tags=['商业品牌']))
        (self.profiles / 'a.json').write_text(json.dumps(p))
        self.add('alias', sha='same-recording')
        self.add('b')
        self.assertEqual(len(q.rank(self.hits(), 0, None)), 2)
        self.assertEqual(len(q.rank(self.hits(), 0, None, distinct=False)), 4)

    def test_mixed_hash_and_source_aliases_are_distinct(self):
        p = self.add('a', sha='recording')
        unhashed = dict(p)
        unhashed.pop('sha256')
        (self.profiles / 'a-copy.json').write_text(json.dumps(unhashed))
        self.add('b', sha='recording')
        self.add('other')
        self.assertEqual(len(q.rank(self.hits(), 0, None)), 2)
        self.assertEqual(len(q.rank(self.hits(), 0, None, distinct=False)), 4)

    def test_energy_not_cross_track_score(self):
        self.add('a', level=1)
        self.add('z', level=5)
        self.assertEqual(q.rank(self.hits(), 0, None)[0]['track'], 'a.wav')

    def test_recent_penalty_preserves_user_priority(self):
        self.add('a')
        self.add('b')
        self.add('user', owner='user')
        ranked = q.rank(self.hits(recent=['a.wav', 'user']), 0, None)
        self.assertEqual([h['track'] for h in ranked], ['user.wav', 'b.wav', 'a.wav'])

    def test_reference_tags_not_audio_similarity(self):
        self.add('ref', owner='user', tags=['都市高级感'], present=False, cleared=False)
        self.add('a')
        self.add('b', tags=['商业品牌', '都市高级感'])
        tags = q.reference_tags(self.profiles, ['ref'])
        self.assertEqual(tags, {'都市高级感'})
        hit = q.rank(self.hits(taste_tags=tags, use='release'), 0, None)[0]
        self.assertEqual(hit['track'], 'b.wav')
        self.assertEqual(hit['reference_overlap'], ['都市高级感'])

    def test_in_points_belong_to_selected_segment(self):
        self.add('a')
        self.assertEqual(len(self.hits()[0]['in_candidates']), 1)

    def cli(self, *args):
        return subprocess.run([sys.executable, str(ROOT / 'scripts/bgm_query.py'),
                               '--profiles', str(self.profiles), '--root', str(self.root),
                               *args], text=True, capture_output=True)

    def test_cli_reference_does_not_consume_release_slots(self):
        self.add('user', owner='user', present=False, cleared=False)
        self.add('pool')
        r = self.cli('--json', '--top', '1')
        self.assertEqual(r.returncode, 0, r.stderr)
        data = json.loads(r.stdout)
        self.assertEqual(data['candidates'][0]['track'], 'pool.wav')
        self.assertEqual(data['user_references'][0]['track'], 'user.wav')
        self.assertEqual(data['shortfall'], 0)

    def test_cli_shortfall_never_fabricates_candidates(self):
        r = self.cli('--json')
        self.assertEqual(json.loads(r.stdout)['shortfall'], 6)

    def test_cli_redirected_ascii_stdout_is_utf8(self):
        r = subprocess.run([sys.executable, str(ROOT / 'scripts/bgm_query.py'),
                            '--profiles', str(self.profiles), '--root', str(self.root)],
                           capture_output=True, env={**os.environ, 'PYTHONIOENCODING': 'ascii'})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('候选不足', r.stdout.decode('utf-8'))

    def test_cli_invalid_values_and_missing_reference(self):
        for args in [('--top', '0'), ('--min-sec', '-1'), ('--min-sec', 'nan'),
                     ('--max-sec', 'inf'), ('--reference', 'missing')]:
            self.assertEqual(self.cli(*args).returncode, 2, args)


if __name__ == '__main__':
    unittest.main()
