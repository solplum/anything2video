"""Producer-contract tests; do not assert real JianYing/CapCut desktop compatibility."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('export_jianying', ROOT / 'scripts/export_jianying.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'project'
        self.root.mkdir()
        self.info = {'slug': 'film', 'width': 64, 'height': 64, 'fps': 30, 'totalFrames': 60}
        self.write('project.json', self.info)
        self.probe = {'streams': [
            {'codec_type': 'video', 'width': 64, 'height': 64, 'nb_read_frames': '60',
             'avg_frame_rate': '30/1', 'r_frame_rate': '30/1', 'duration': '2'},
            {'codec_type': 'audio', 'duration': '2'}], 'format': {'duration': '2'}}

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            path.write_bytes(content)
        elif isinstance(content, str):
            path.write_text(content, encoding='utf-8')
        else:
            path.write_text(json.dumps(content), encoding='utf-8')
        return path

    def timeline(self, sentences, **kwargs):
        self.write('script/timeline.json', {'fps': 30, 'total_frames': 60, 'sentences': sentences, **kwargs})
        return exporter.parse_timeline(self.root, self.info)

    def video(self, name='film_v1.mp4', mode='video', **changes):
        path = self.write('renders/' + name, b'unit media; independently mocked ffprobe')
        sidecar = {'schemaVersion': 1, 'mode': mode, 'frames': {'from': 1, 'to': 60},
                   'mediaSha256': hashlib.sha256(path.read_bytes()).hexdigest(), **changes}
        self.write('renders/' + name + '.delivery.json', sidecar)
        return path

    def test_canonical_single_frame_and_nested_chunks_convert_once(self):
        items = self.timeline([{'from': 1, 'to': 31, 'text': 'whole sentence', 'subs': [
            {'from': 1, 'to': 1, 'text': '首'}, {'from': 2, 'to': 31, 'text': '尾'}]}])
        self.assertEqual(items, [
            {'text': '首', 'start_us': 0, 'duration_us': 33333},
            {'text': '尾', 'start_us': 33333, 'duration_us': 1000000}])

    def test_legacy_seconds_and_zero_based_exclusive_frames(self):
        items = self.timeline([{'start': .5, 'end': 1, 'text': 'seconds'},
                               {'start_frame': 30, 'end_frame': 60, 'text': 'frames'}])
        self.assertEqual([(s['start_us'], s['duration_us']) for s in items],
                         [(500000, 500000), (1000000, 1000000)])

    def test_legacy_seconds_need_no_fps_for_standalone_parser(self):
        self.write('script/timeline.json', {'sentences': [{'start': 0, 'end': 1, 'text': 'x'}]})
        self.assertEqual(exporter.parse_timeline(self.root)[0]['duration_us'], 1000000)

    def test_no_silent_fallback_for_malformed_or_missing_timing(self):
        bad = [
            {'text': 'missing'}, {'text': 'partial', 'from': 1},
            {'text': 'mixed', 'from': 1, 'to': 2, 'start': 0, 'end': 1},
            {'text': 'zero', 'from': 0, 'to': 1}, {'text': 'reverse', 'from': 2, 'to': 1},
            {'text': 'fraction', 'from': 1.5, 'to': 2}, {'text': 'bool', 'from': True, 'to': 2},
            {'text': 'nan', 'start': float('nan'), 'end': 1}, {'text': '', 'from': 1, 'to': 2},
            {'text': 'long', 'from': 1, 'to': 61}, {'text': 'empty', 'from': 1, 'to': 2, 'subs': []},
        ]
        for value in bad:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.timeline([value])
        self.write('script/timeline.json', '{broken')
        self.write('src/common/subs.ts', 'export const SUBS = [{text: "do not guess"}];')
        with self.assertRaisesRegex(ValueError, 'Cannot read JSON'):
            exporter.parse_timeline(self.root, self.info)

    def test_child_bounds_overlap_and_order_rejected(self):
        cases = [
            [{'from': 5, 'to': 20, 'text': 'parent', 'subs': [{'from': 1, 'to': 10, 'text': 'child'}]}],
            [{'from': 1, 'to': 20, 'text': 'a'}, {'from': 20, 'to': 30, 'text': 'b'}],
            [{'from': 20, 'to': 30, 'text': 'a'}, {'from': 1, 'to': 10, 'text': 'b'}],
        ]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.timeline(value)

    def test_mismatched_project_metadata_rejected(self):
        for metadata in [{'fps': 24}, {'fps': 0}, {'fps': True}, {'total_frames': 61},
                         {'totalFrames': 50}]:
            with self.subTest(metadata=metadata), self.assertRaises(ValueError):
                self.timeline([], **metadata)

    def test_epic_empty_sentences_do_not_silently_drop_typescript_captions(self):
        self.write('src/common/subs.ts', 'export const SUBS: SubEntry[] = [{from:1,to:30,text:"poem"}];')
        with self.assertRaisesRegex(ValueError, 'Empty timeline.sentences'):
            self.timeline([])

    def test_typescript_and_srt_never_get_estimated_timings(self):
        self.write('src/common/subs.ts', 'export const SUBS = [{from:1,to:30,text:"x"}];')
        with self.assertRaisesRegex(ValueError, 'unsupported'):
            exporter.parse_timeline(self.root, self.info)
        self.write('src/common/subs.ts', 'export const SUBS: SubEntry[] = [];')
        self.assertEqual(exporter.parse_timeline(self.root, self.info), [])
        self.write('script/captions.srt', '1\n00:00:00,000 --> 00:00:01,000\nx')
        with self.assertRaisesRegex(ValueError, 'SRT import is unsupported'):
            exporter.parse_timeline(self.root, self.info)

    def test_preview_is_not_selected_before_full_render(self):
        self.video('film_preview.mp4', mode='preview')
        final = self.video('film_v1.mp4')
        with patch.object(exporter, 'probe_media', return_value=self.probe) as probe:
            self.assertEqual(exporter.select_video(self.root, self.info), final)
        self.assertEqual(probe.call_count, 1)

    def test_preview_only_and_explicit_preview_fail(self):
        preview = self.video('film_preview.mp4', mode='preview')
        with self.assertRaisesRegex(ValueError, 'found 0'):
            exporter.select_video(self.root, self.info)
        with self.assertRaisesRegex(ValueError, 'Not a full-render'):
            exporter.select_video(self.root, self.info, preview)

    def test_ambiguous_full_renders_require_explicit_choice(self):
        first = self.video('film_v1.mp4')
        self.video('film_v2.mp4')
        with patch.object(exporter, 'probe_media', return_value=self.probe):
            with self.assertRaisesRegex(ValueError, 'found 2'):
                exporter.select_video(self.root, self.info)
            self.assertEqual(exporter.select_video(self.root, self.info, first), first)

    def test_legacy_full_render_requires_explicit_choice_and_probe(self):
        path = self.write('renders/film_final.mp4', b'legacy')
        with self.assertRaisesRegex(ValueError, 'found 0'):
            exporter.select_video(self.root, self.info)
        with patch.object(exporter, 'probe_media', return_value=self.probe):
            self.assertEqual(exporter.select_video(self.root, self.info, path), path)

    def test_partial_stale_malformed_and_boolean_sidecars_rejected(self):
        for changes in [{'frames': {'from': 2, 'to': 60}}, {'mediaSha256': '0' * 64},
                        {'schemaVersion': True}, {'frames': {'from': True, 'to': 60}}, {'mode': 'unknown'}]:
            with self.subTest(changes=changes):
                self.video(**changes)
                with self.assertRaises(ValueError):
                    exporter.select_video(self.root, self.info)
        self.write('renders/film_v1.mp4.delivery.json', '{broken')
        with self.assertRaisesRegex(ValueError, 'Cannot read JSON'):
            exporter.select_video(self.root, self.info)

    def test_independent_probe_rejects_wrong_dimensions_fps_frames_duration(self):
        path = self.video()
        for changes in [{'width': 32}, {'avg_frame_rate': '24/1'}, {'r_frame_rate': '24/1'},
                        {'nb_read_frames': '59'}, {'duration': '1'}, {'avg_frame_rate': '0/0'}]:
            probe = copy.deepcopy(self.probe)
            probe['streams'][0].update(changes)
            with self.subTest(changes=changes), patch.object(exporter, 'probe_media', return_value=probe):
                with self.assertRaisesRegex(ValueError, 'do not match'):
                    exporter.verify_video(path, self.info)

    def test_missing_master_audio_is_not_hidden_by_muted_stems(self):
        path = self.video()
        probe = copy.deepcopy(self.probe)
        probe['streams'] = probe['streams'][:1]
        with patch.object(exporter, 'probe_media', return_value=probe):
            with self.assertRaisesRegex(ValueError, 'no authoritative audio'):
                exporter.verify_video(path, self.info)
            exporter.verify_video(path, {**self.info, 'audio': {'mode': 'silent'}})

    def test_outside_project_media_rejected(self):
        outside = Path(self.temp.name) / 'outside.mp4'
        outside.write_bytes(b'x')
        link = self.root / 'outside.mp4'
        link.symlink_to(outside)
        for path in (outside, link):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'outside-project'):
                exporter.select_video(self.root, self.info, path)

    def test_metadata_symlinks_cannot_escape_project(self):
        self.video()
        self.timeline([{'from': 1, 'to': 30, 'text': 'x'}])
        for relative, action in [
            ('project.json', lambda: exporter.project_settings(self.root)),
            ('script/timeline.json', lambda: exporter.parse_timeline(self.root, self.info)),
            ('renders/film_v1.mp4.delivery.json', lambda: exporter.select_video(self.root, self.info)),
        ]:
            with self.subTest(relative=relative):
                path = self.root / relative
                original = path.read_bytes()
                outside = Path(self.temp.name) / 'external.json'
                outside.write_bytes(original)
                path.unlink()
                path.symlink_to(outside)
                with self.assertRaisesRegex(ValueError, 'outside-project'):
                    action()
                path.unlink()
                path.write_bytes(original)

    def test_default_output_cannot_follow_escaping_delivery_symlink(self):
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        (self.root / 'delivery').symlink_to(outside, target_is_directory=True)
        for dry_run in (False, True):
            with self.subTest(dry_run=dry_run), self.assertRaisesRegex(ValueError, 'output escapes project'):
                exporter.export_jianying(self.root, dry_run=dry_run)
        self.assertEqual(list(outside.iterdir()), [])

    def test_canonical_audio_wins_legacy_and_mixed_master_is_not_narration(self):
        canonical = self.write('public/assets/film/audio_narration.wav', b'canonical')
        legacy = self.write('audio/audio_narration.wav', b'legacy')
        self.assertEqual(exporter.select_audio(self.root, [canonical], [legacy]), canonical)
        second = self.write('assets/audio_narration.wav', b'another')
        with self.assertRaisesRegex(ValueError, 'Ambiguous audio'):
            exporter.select_audio(self.root, [], [legacy, second])

    def test_export_defaults_keep_master_audio_raw_stems_muted_and_no_text(self):
        self.video()
        narration = self.write('public/assets/film/audio_narration.wav', b'narration')
        bgm = self.write('public/assets/film/bgm.wav', b'bgm')
        self.timeline([{'from': 1, 'to': 30, 'text': 'already baked'}])
        out = Path(self.temp.name) / 'out'
        def probe(path, count_frames=False):
            if path == bgm:
                return {'streams': [{'codec_type': 'audio', 'duration': '.5'}]}
            return self.probe
        with patch.object(exporter, 'probe_media', side_effect=probe):
            folder = exporter.export_jianying(self.root, out_dir=out)
        data = json.loads((folder / 'draft_info.json').read_text())
        self.assertEqual(data['materials']['texts'], [])
        self.assertEqual([p.name for p in sorted((folder / 'Resources').iterdir())],
                         ['audio_narration.wav', 'bgm.wav', 'film_v1.mp4'])
        tracks = data['tracks']
        self.assertEqual(tracks[0]['segments'][0]['volume'], 1.0)
        self.assertEqual([t['segments'][0]['volume'] for t in tracks[1:]], [0.0, 0.0])
        self.assertEqual(tracks[2]['segments'][0]['source_timerange']['duration'], 500000)
        self.assertEqual(data['materials']['audios'][1]['duration'], 500000)
        with self.assertRaises(FileExistsError):
            exporter.export_jianying(self.root, out_dir=out)

    def test_explicit_subtitles_preserve_canonical_timing_in_serialized_draft(self):
        self.video()
        self.timeline([{'from': 31, 'to': 60, 'text': 'caption'}])
        with patch.object(exporter, 'probe_media', return_value=self.probe):
            data, _ = exporter.build_draft_structure(self.root, 'test', self.root / 'bundle',
                                                     include_subtitles=True, dry_run=True)
        text = next(t for t in data['tracks'] if t['type'] == 'text')
        self.assertEqual(text['segments'][0]['target_timerange'], {'start': 1000000, 'duration': 1000000})
        self.assertFalse((self.root / 'bundle').exists())

    def test_dry_run_reads_existing_media_and_does_not_write_any_files(self):
        self.video()
        self.write('public/assets/film/audio_narration.wav', b'narration')
        self.timeline([{'from': 1, 'to': 30, 'text': 'x'}])
        out = Path(self.temp.name) / 'nonexistent-out'
        before = sorted((str(p), p.read_bytes()) for p in self.root.rglob('*') if p.is_file())
        with patch.object(exporter, 'probe_media', return_value=self.probe):
            exporter.export_jianying(self.root, out_dir=out, dry_run=True, include_subtitles=True)
        self.assertFalse(out.exists())
        self.assertEqual(before, sorted((str(p), p.read_bytes()) for p in self.root.rglob('*') if p.is_file()))

    def test_missing_invalid_project_clean_video_and_unsafe_names_rejected(self):
        for info in [{}, {**self.info, 'fps': 0}, {**self.info, 'totalFrames': True}, {**self.info, 'slug': '../x'}]:
            self.write('project.json', info)
            with self.subTest(info=info), self.assertRaises(ValueError):
                exporter.project_settings(self.root)
        with self.assertRaisesRegex(ValueError, 'Clean-video generation is unsupported'):
            exporter.build_draft_structure(self.root, 'test', self.root / 'bundle', use_clean_video=True)
        for name in ('.', '..', ' '):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Draft name'):
                exporter.export_jianying(self.root, draft_name=name)


if __name__ == '__main__':
    unittest.main()
