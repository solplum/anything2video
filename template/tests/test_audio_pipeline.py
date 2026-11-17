"""Synthetic audio regression checks. Run: uv run python -m unittest discover -s tests."""
import hashlib
import asyncio
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import numpy as np
from scipy.io import wavfile

SCRIPTS = Path(__file__).resolve().parent.parent / 'scripts'
SR = 48000


class AudioPipelineTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.assets = self.root / 'public' / 'assets' / 'test'
        self.assets.mkdir(parents=True)
        (self.root / 'scripts').mkdir()
        (self.root / 'src').mkdir()
        (self.root / 'src' / 'common').mkdir()
        (self.root / 'script').mkdir()
        (self.root / 'src' / 'config.ts').write_text("export const VIDEO = {slug: 'test'};", encoding='utf-8')
        (self.root / 'project.json').write_text(json.dumps({'slug': 'test', 'fps': 30, 'totalFrames': 90,
                                                          'status': 'draft'}), encoding='utf-8')
        for name in ('mix_audio.py', 'probe_av_sync.mjs', 'tts_build.py', 'probe_delivery.py', 'audio_project.py'):
            shutil.copyfile(SCRIPTS / name, self.root / 'scripts' / name)
        self.timeline(31)
        self.tone('audio_narration.wav', onset=1, stop=2.5)
        self.tone('bgm.wav', onset=0, stop=3, frequency=100, gain=0.05)

    def tearDown(self):
        self.temporary.cleanup()

    def timeline(self, first):
        data = {'fps': 30, 'total_frames': 90, 'chapters': [{'from': 1}],
                'sentences': [{'id': 'S01', 'from': first, 'to': 75}]}
        (self.root / 'script' / 'timeline.json').write_text(json.dumps(data), encoding='utf-8')

    def tone(self, name, onset, stop, frequency=700, gain=0.3, stereo=False):
        positions = np.arange(3 * SR) / SR
        signal = gain * np.sin(2 * np.pi * frequency * positions)
        signal[(positions < onset) | (positions >= stop)] = 0
        samples = (signal * 32767).astype(np.int16)
        if stereo:
            samples = np.column_stack((samples, samples))
        wavfile.write(self.assets / name, SR, samples)

    def run_script(self, name, *args):
        executable = 'node' if name.endswith('.mjs') else sys.executable
        return subprocess.run([executable, str(self.root / 'scripts' / name), *args],
                              cwd=self.root, capture_output=True, text=True, encoding='utf-8',
                              env={**os.environ, 'PYTHONUTF8': '1'})

    def digest(self, name):
        return hashlib.sha256((self.assets / name).read_bytes()).hexdigest()

    def test_repeated_mix_preserves_master_and_output(self):
        master = self.digest('audio_narration.wav')
        first = self.run_script('mix_audio.py')
        self.assertEqual(first.returncode, 0, first.stderr)
        mixed = self.digest('audio.wav')
        second = self.run_script('mix_audio.py')
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(self.digest('audio_narration.wav'), master)
        self.assertEqual(self.digest('audio.wav'), mixed)
        _, samples = wavfile.read(self.assets / 'audio.wav')
        self.assertEqual(samples.shape, (3 * SR, 2))
        self.assertLessEqual(np.max(np.abs(samples.astype(np.int32))), 31130)

    def test_updated_master_changes_mix(self):
        # Also verify that music is optional, matching the production contract.
        (self.assets / 'bgm.wav').unlink()
        # Fresh TTS replaces the master; remix must use it without mtime heuristics.
        self.assertEqual(self.run_script('mix_audio.py').returncode, 0)
        previous = self.digest('audio.wav')
        self.tone('audio_narration.wav', onset=1, stop=2.5, frequency=900)
        self.assertEqual(self.run_script('mix_audio.py').returncode, 0)
        self.assertNotEqual(self.digest('audio.wav'), previous)

    def test_missing_master_cannot_adopt_previous_mix(self):
        self.assertEqual(self.run_script('mix_audio.py').returncode, 0)
        (self.assets / 'audio_narration.wav').unlink()
        self.assertNotEqual(self.run_script('mix_audio.py').returncode, 0)

    def test_av_ignores_music_and_rejects_shift(self):
        self.assertEqual(self.run_script('mix_audio.py').returncode, 0)
        normal = self.digest('audio.wav')
        self.assertEqual(self.run_script('mix_audio.py', '--sfx', 'sand').returncode, 0)
        self.assertNotEqual(normal, self.digest('audio.wav'))
        self.assertEqual(self.run_script('mix_audio.py').returncode, 0)
        valid = self.run_script('probe_av_sync.mjs')
        self.assertEqual(valid.returncode, 0, valid.stderr)
        self.timeline(61)
        self.assertEqual(self.run_script('probe_av_sync.mjs').returncode, 1)

    def test_silent_narration_fails(self):
        # Silent masters must never be mistaken for speech at frame one.
        self.tone('audio_narration.wav', onset=0, stop=0)
        self.timeline(1)
        self.assertEqual(self.run_script('probe_av_sync.mjs').returncode, 1)

    def test_first_internal_pause_is_not_leading_silence(self):
        self.tone('audio_narration.wav', onset=0, stop=1)
        self.timeline(1)
        valid = self.run_script('probe_av_sync.mjs')
        self.assertEqual(valid.returncode, 0, valid.stderr)
        self.timeline(31)
        self.assertEqual(self.run_script('probe_av_sync.mjs').returncode, 1)

    def test_bad_file_is_environment_error(self):
        # ffmpeg nonzero exit is a tool failure rather than a plausible onset.
        (self.assets / 'audio_narration.wav').write_bytes(b'not an audio file')
        self.assertEqual(self.run_script('probe_av_sync.mjs').returncode, 2)

    def test_truncated_media_is_rejected(self):
        # Media timing is checked separately from pure narration speech onset.
        short = np.zeros(SR, dtype=np.int16)
        wavfile.write(self.assets / 'short.wav', SR, short)
        self.assertEqual(self.run_script('probe_av_sync.mjs', '--media',
                         str(self.assets / 'short.wav')).returncode, 1)

    def test_tts_refreshes_master_and_clears_mix_provenance(self):
        # Stub only synthesis; exercise actual WAV/timeline/subtitle generation.
        specification = importlib.util.spec_from_file_location('tts_fixture', self.root / 'scripts' / 'tts_build.py')
        module = importlib.util.module_from_spec(specification)
        sys.path.insert(0, str(self.root / 'scripts'))
        try:
            specification.loader.exec_module(module)
        finally:
            sys.path.pop(0)
        module.ENGINE = 'edge'
        module.EDGE_DELAY = 0
        module.LEAD = module.TAIL = module.GAP = 0
        async def fake_sentence(chunks, sep=''):
            positions = np.arange(SR) / SR
            samples = (0.3 * np.sin(2 * np.pi * 700 * positions)).astype(np.float32)
            return samples, [0], [[0.0] * len(c) for c in chunks], 1.0
        module.synth_sentence = fake_sentence
        narration = self.root / 'script' / 'narration.txt'
        narration.write_text('This is a test.\n', encoding='utf-8')
        manifest = self.assets / 'audio.mix.json'
        manifest.write_text('{}', encoding='utf-8')
        asyncio.run(module.main(str(narration), force=True))
        self.assertEqual(self.digest('audio.wav'), self.digest('audio_narration.wav'))
        self.assertFalse(manifest.exists())
        generated = json.loads((self.root / 'script' / 'timeline.json').read_text(encoding='utf-8'))
        self.assertEqual(generated['sentences'][0]['from'], 1)
        self.assertEqual(generated['total_frames'], 30)

    def test_epic_has_explicit_no_narration_validation(self):
        # Machine-readable delivery output must contain exactly one JSON object.
        delivery = self.run_script('probe_delivery.py', str(self.assets / 'bgm.wav'), '--json')
        self.assertEqual(delivery.returncode, 0, delivery.stderr)
        self.assertTrue(json.loads(delivery.stdout)['pass'])
        (self.assets / 'audio_narration.wav').unlink()
        mixed = self.run_script('mix_audio.py', '--epic')
        self.assertEqual(mixed.returncode, 0, mixed.stderr)
        valid = self.run_script('probe_av_sync.mjs', '--no-narration')
        self.assertEqual(valid.returncode, 0, valid.stderr)

    # ---- v4.2.0 音乐编排表（music_plan.json 多段接力）----

    def write_plan(self, cues):
        (self.assets / 'music_plan.json').write_text(
            json.dumps({'schema_version': 1, 'cues': cues}, ensure_ascii=False), encoding='utf-8')

    def test_music_plan_renders_multi_segment_with_crossfade(self):
        self.tone('track-b.wav', onset=0, stop=3, frequency=100, gain=0.3)
        # 段1：bgm.wav 0.5-1.5s（700Hz）落位 0-1.0s；段2：track-b.wav 1.0-2.5s（100Hz）落位 0.8-2.3s，重叠 0.2s crossfade
        self.write_plan([
            {'track': 'bgm.wav', 'track_in': 0.5, 'track_out': 1.5, 'timeline_start': 0.0,
             'fade_in': 0.1, 'section': '垫底', 'rationale': '测试段一'},
            {'track': 'track-b.wav', 'track_in': 1.0, 'track_out': 2.5, 'timeline_start': 0.8,
             'crossfade_in': 0.2, 'fade_out': 0.1, 'section': 'hero', 'rationale': '测试段二'},
        ])
        mixed = self.run_script('mix_audio.py')
        self.assertEqual(mixed.returncode, 0, mixed.stderr)
        manifest = json.loads((self.assets / 'audio.mix.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['music'], 'music_plan')
        self.assertEqual(len(manifest['music_tracks']), 2)
        self.assertIsNotNone(manifest['music_plan_sha256'])
        _, samples = wavfile.read(self.assets / 'audio.wav')
        self.assertEqual(samples.shape, (3 * SR, 2))
        # crossfade 中点两段都贡献能量（重叠区非静音）
        window = samples[int(0.88 * SR):int(0.92 * SR)].astype(np.float64) / 32767
        self.assertGreater(float(np.sqrt((window ** 2).mean())), 0.01)

    def test_music_plan_overrides_single_bgm(self):
        self.write_plan([
            {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 1.0, 'timeline_start': 0.5},
        ])
        mixed = self.run_script('mix_audio.py')
        self.assertEqual(mixed.returncode, 0, mixed.stderr)
        manifest = json.loads((self.assets / 'audio.mix.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['music'], 'music_plan')
        self.assertIsNone(manifest['music_sha256'])

    def test_music_plan_rejects_bad_cues(self):
        cases = [
            ('重叠无 crossfade', [
                {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 2.0, 'timeline_start': 0.0},
                {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 2.0, 'timeline_start': 1.5},
            ]),
            ('曲内出点越轨长', [
                {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 99.0, 'timeline_start': 0.0},
            ]),
            ('落位与曲内时长不一致', [
                {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 2.0, 'timeline_start': 0.0, 'timeline_end': 1.0},
            ]),
            ('落位越片长', [
                {'track': 'bgm.wav', 'track_in': 0.0, 'track_out': 2.0, 'timeline_start': 2.5},
            ]),
            ('缺必填字段', [{'track': 'bgm.wav', 'track_in': 0.0, 'timeline_start': 0.0}]),
        ]
        for name, cues in cases:
            with self.subTest(case=name):
                self.write_plan(cues)
                result = self.run_script('mix_audio.py')
                self.assertNotEqual(result.returncode, 0, f'{name} 应拒绝')
                self.assertIn('music_plan', result.stderr, name)


class ProsodyAndDuckingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, str(SCRIPTS))
        try:
            spec_tts = importlib.util.spec_from_file_location('tts_mod', SCRIPTS / 'tts_build.py')
            cls.tts = importlib.util.module_from_spec(spec_tts)
            spec_tts.loader.exec_module(cls.tts)
            spec_mix = importlib.util.spec_from_file_location('mix_mod', SCRIPTS / 'mix_audio.py')
            cls.mix = importlib.util.module_from_spec(spec_mix)
            spec_mix.loader.exec_module(cls.mix)
        finally:
            sys.path.pop(0)

    def test_semantic_gap_frames_scales_by_punctuation_and_respects_zero_or_fixed(self):
        cont = self.tts.semantic_gap_frames('如果只靠代码画人，', '动作就会发僵。', 10, 'natural')
        period = self.tts.semantic_gap_frames('如果只靠代码画人。', '动作就会发僵。', 10, 'natural')
        turn = self.tts.semantic_gap_frames('旧版看起来还行。', '但是声音很割裂。', 10, 'natural')
        question = self.tts.semantic_gap_frames('为什么会不流畅？', '因为关节没锁定。', 10, 'natural')
        climax = self.tts.semantic_gap_frames('一次彻底重写！', '下面看效果。', 10, 'natural')
        self.assertLess(cont, period)
        self.assertGreater(turn, period)
        self.assertEqual(question, turn)
        self.assertGreater(climax, question)
        self.assertEqual(self.tts.semantic_gap_frames('为什么？', '因为这样。', 10, 'fixed'), 10)
        self.assertEqual(self.tts.semantic_gap_frames('为什么？', '因为这样。', 0, 'natural'), 0)

    def test_quantize_sentence_start_aligns_to_downbeat_and_beat(self):
        beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        downbeats = [1.0, 3.0]
        self.assertAlmostEqual(self.tts.quantize_sentence_start(0.7, 'chapter_open', beats, downbeats), 1.0, places=5)
        self.assertAlmostEqual(self.tts.quantize_sentence_start(1.3, 'accent', beats, downbeats), 1.5, places=5)
        # Far outside lookahead window stays untouched
        self.assertAlmostEqual(self.tts.quantize_sentence_start(10.0, 'chapter_open', beats, downbeats), 10.0, places=5)

    def test_asymmetric_duck_envelope_holds_short_pauses_and_releases_slowly(self):
        # 5 seconds mono narration: speech [0.5..1.5s], 0.25s short pause [1.5..1.75s],
        # speech [1.75..2.5s], then 2.5s silence [2.5..5.0s].
        t = np.arange(5 * SR) / SR
        narr = np.zeros_like(t)
        speech_mask = ((t >= 0.5) & (t < 1.5)) | ((t >= 1.75) & (t < 2.5))
        narr[speech_mask] = 0.25 * np.sin(2 * np.pi * 440 * t[speech_mask])
        env = self.mix.compute_speech_duck_envelope(narr, SR)
        self.assertEqual(len(env), len(narr))
        self.assertLess(float(env[int(0.2 * SR)]), 0.05)
        self.assertGreater(float(env[int(1.62 * SR)]), 0.65, 'must hold through 0.25s pause without pumping')
        self.assertLess(float(env[int(4.8 * SR)]), 0.25, 'must recover smoothly over long silence')

    def test_spectral_ducking_attenuates_vocal_band_more_than_sub_bass(self):
        t = np.arange(2 * SR) / SR
        bass = 0.4 * np.sin(2 * np.pi * 100 * t)
        mid = 0.4 * np.sin(2 * np.pi * 1800 * t)
        bgm = np.column_stack([bass + mid, bass + mid])
        steady_tail = slice(int(0.5 * SR), int(1.9 * SR))

        no_duck = self.mix.apply_spectral_ducking(bgm, np.zeros(len(t)), SR)
        self.assertTrue(np.allclose(no_duck, bgm))

        full_duck = self.mix.apply_spectral_ducking(bgm, np.ones(len(t)), SR)
        bass_ducked = self.mix.apply_spectral_ducking(np.column_stack([bass, bass]), np.ones(len(t)), SR)
        mid_ducked = self.mix.apply_spectral_ducking(np.column_stack([mid, mid]), np.ones(len(t)), SR)
        bass_gain = float(np.sqrt(np.mean(bass_ducked[steady_tail] ** 2)) / np.sqrt(np.mean(bass[steady_tail] ** 2)))
        mid_gain = float(np.sqrt(np.mean(mid_ducked[steady_tail] ** 2)) / np.sqrt(np.mean(mid[steady_tail] ** 2)))
        self.assertGreater(bass_gain, mid_gain * 1.5, 'vocal mid-band must duck deeper than bass groove')
        self.assertLess(float(np.sqrt(np.mean(full_duck[steady_tail] ** 2))), float(np.sqrt(np.mean(bgm[steady_tail] ** 2))))

    def test_loop_with_crossfade_avoids_splice_dropouts(self):
        t = np.arange(2 * SR) / SR
        # Smooth continuous 440Hz tone of 2.0s looped to 5.0s
        src = np.column_stack([0.3 * np.sin(2 * np.pi * 440 * t), 0.3 * np.sin(2 * np.pi * 440 * t)])
        looped = self.mix.loop_with_crossfade(src, 5 * SR, SR, xfade_s=0.5)
        self.assertEqual(looped.shape, (5 * SR, 2))
        self.assertLessEqual(float(np.max(np.abs(looped))), 0.45)


if __name__ == '__main__':
    unittest.main()
