"""Offline provider fixtures and local synthetic decode; never a sound audition."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("sfx_source", ROOT / "scripts/sfx_source.py")
sfx = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sfx)
FIXTURES = ROOT / "tests/fixtures/sfx-source"
DETAIL = (FIXTURES / "detail.html").read_bytes()
SEARCH = (FIXTURES / "search.html").read_bytes()
PAGE = "https://freesound.org/people/fixture-author/sounds/12345/"
PREVIEW = "https://cdn.freesound.org/previews/12/12345_42-hq.mp3"
FAKE_MP3 = b"synthetic bytes; mocked decoder only, not playable sound"


class FixtureTransport:
    def __init__(self, detail=DETAIL, search=SEARCH, audio=FAKE_MP3, audio_mime="audio/mpeg"):
        self.detail, self.search, self.audio, self.audio_mime = detail, search, audio, audio_mime
        self.requests = []

    def __call__(self, url, limit, host):
        self.requests.append((url, limit, host))
        if "/search/?" in url:
            return self.search, url, "text/html"
        if url == "https://freesound.org/s/12345/":
            return self.detail, PAGE, "text/html"
        if url.startswith("https://cdn.freesound.org/previews/12/12345_42-"):
            return self.audio, url, self.audio_mime
        raise AssertionError("Unexpected request: " + url)


def fake_inspect(path):
    assert path.read_bytes() == FAKE_MP3
    return {"codec": "mp3", "durationSeconds": 0.75, "channels": 1,
            "sampleRate": 44100, "decode": "passed", "audioReview": "not_performed"}


class ProviderTests(unittest.TestCase):
    def test_network_opt_in_and_import_are_inert(self):
        transport = FixtureTransport()
        provider = sfx.FreesoundProvider(transport=transport)
        with self.assertRaisesRegex(ValueError, "Network disabled"):
            provider.search("paper-turn")
        with self.assertRaisesRegex(ValueError, "Network disabled"):
            provider.detail("12345", "cc0")
        self.assertEqual(transport.requests, [])
        with patch.object(sfx, "http_get", side_effect=AssertionError("network")):
            with contextlib.redirect_stdout(io.StringIO()) as stdout:
                self.assertEqual(sfx.main(["actions"]), 0)
            self.assertIn("paper-turn", json.loads(stdout.getvalue()))
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(sfx.main(["search", "click"]), 1)

    def test_action_search_only_returns_candidates_not_license_admission(self):
        transport = FixtureTransport()
        results = sfx.FreesoundProvider(True, transport).search("paper-turn")
        self.assertEqual([row["id"] for row in results["results"]], ["fs:12345"])
        self.assertFalse(results["results"][0]["licenseChecked"])
        self.assertEqual(len(transport.requests), 1)
        self.assertIn("q=paper+page+turn", transport.requests[0][0])
        self.assertIn("Creative+Commons+0", transport.requests[0][0])

    def test_changed_search_markup_does_not_look_like_empty_success(self):
        provider = sfx.FreesoundProvider(True, FixtureTransport(search=b"<html>Sign in</html>"))
        with self.assertRaisesRegex(ValueError, "markup unrecognized"):
            provider.search("click")
        provider = sfx.FreesoundProvider(True, FixtureTransport(search=b"<p>No sounds found</p>"))
        self.assertEqual(provider.search("click")["results"], [])

    def test_numeric_search_bounds_reject_before_network(self):
        for args in ({"limit": 0}, {"limit": 21}, {"max_duration": float("nan")},
                     {"max_duration": 0}, {"max_duration": 121}, {"policy": "all"}):
            with self.subTest(args=args):
                transport = FixtureTransport()
                with self.assertRaises(ValueError):
                    sfx.FreesoundProvider(True, transport).search("click", **args)
                self.assertEqual(transport.requests, [])

    def test_default_cc0_and_exact_lq_identity_not_promoted_to_hq(self):
        details = sfx.FreesoundProvider(True, FixtureTransport()).detail("fs:12345", "cc0")
        self.assertEqual(details["license"], "CC0-1.0")
        self.assertEqual(details["detailPageSha256"], hashlib.sha256(DETAIL).hexdigest())
        transport = FixtureTransport(detail=DETAIL.replace(b"-hq.mp3", b"-lq.mp3"))
        provider = sfx.FreesoundProvider(True, transport)
        details = provider.detail("12345", "cc0")
        provider.preview(details)
        self.assertEqual(details["rendition"], "mp3-preview-lq")
        self.assertTrue(transport.requests[-1][0].endswith("-lq.mp3"))

    def test_cc_by_requires_explicit_policy(self):
        detail = DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by/4.0")
        provider = sfx.FreesoundProvider(True, FixtureTransport(detail=detail))
        with self.assertRaisesRegex(ValueError, "outside policy"):
            provider.detail("12345", "cc0")
        self.assertEqual(provider.detail("12345", "cc-by")["license"], "CC-BY-4.0")

    def test_missing_ambiguous_unknown_and_restrictive_license_fail_closed(self):
        cases = [
            DETAIL.replace(b"creativecommons.org", b"example.invalid"),
            DETAIL.replace(b'</div>\n</body>', b'<a title="Go to the full license text" href="https://creativecommons.org/licenses/by/4.0/">Other</a></div>\n</body>'),
            DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by-nc/4.0"),
            DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by-sa/4.0"),
            DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/sampling+/1.0"),
            DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by/9.0"),
            DETAIL.replace(b"creativecommons.org/", b"creativecommons.org:443/"),
        ]
        for detail in cases:
            with self.subTest(detail=detail):
                transport = FixtureTransport(detail=detail)
                with self.assertRaises(ValueError):
                    sfx.FreesoundProvider(True, transport).detail("12345", "cc-by")
                self.assertEqual(len(transport.requests), 1)  # no audio requests

    def test_unrelated_cc_links_cannot_supply_missing_sound_license(self):
        unrelated = b'<footer><a title="Go to the full license text" href="https://creativecommons.org/publicdomain/zero/1.0/">Footer CC0</a></footer>'
        # Removing the structured sidebar must fail even with a CC0 elsewhere.
        detail = DETAIL.replace(b'class="bw-sound__sidebar"', b'class="description"') + unrelated
        with self.assertRaisesRegex(ValueError, "Missing or ambiguous"):
            sfx.FreesoundProvider(True, FixtureTransport(detail=detail)).detail("12345", "cc0")
        # Outside CC0 does not override the actual sidebar's restrictive license.
        detail = DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by-nc/4.0") + unrelated
        with self.assertRaisesRegex(ValueError, "not recognized"):
            sfx.FreesoundProvider(True, FixtureTransport(detail=detail)).detail("12345", "cc0")
        # An unrelated CC BY link does not change a valid per-sound CC0 license.
        detail = DETAIL + unrelated.replace(b"publicdomain/zero/1.0", b"licenses/by/4.0")
        self.assertEqual(sfx.FreesoundProvider(True, FixtureTransport(detail=detail)).detail("12345", "cc0")["license"], "CC0-1.0")

    def test_wrong_sound_creator_and_canonical_are_rejected(self):
        for detail in (DETAIL.replace(b'data-sound-id="12345"', b'data-sound-id="999"'),
                       DETAIL.replace(b'data-title=', b'data-username="other" data-title='),
                       DETAIL.replace(b"/sounds/12345/", b"/sounds/999/")):
            with self.subTest(detail=detail):
                with self.assertRaises(ValueError):
                    sfx.FreesoundProvider(True, FixtureTransport(detail=detail)).detail("12345", "cc0")

    def test_unsafe_urls_redirects_and_changed_preview_identity_rejected(self):
        for url in ("http://cdn.freesound.org/previews/12/12345_42-hq.mp3",
                    PREVIEW.replace("cdn.freesound.org", "cdn.freesound.org.evil.invalid"),
                    PREVIEW.replace("12345_", "999_"), PREVIEW + "?token=x",
                    PREVIEW.replace("cdn.freesound.org", "user@cdn.freesound.org")):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    sfx.preview_kind(url, "12345")
        handler = sfx.SameHostRedirect("freesound.org")
        with self.assertRaises(ValueError):
            handler.redirect_request(None, None, 302, "", {}, "https://outside.invalid/track")
        provider = sfx.FreesoundProvider(True, lambda *args: (FAKE_MP3, PREVIEW.replace("-hq", "-lq"), "audio/mpeg"))
        with self.assertRaisesRegex(ValueError, "identity changed"):
            provider.preview({"id": "fs:12345", "previewUrl": PREVIEW})

    def test_wrong_content_type_and_oversized_response_rejected(self):
        for payload, mime in ((b"login", "text/html"), (b"x" * (sfx.PREVIEW_LIMIT + 1), "audio/mpeg")):
            provider = sfx.FreesoundProvider(True, lambda *args: (payload, PREVIEW, mime))
            with self.assertRaises(ValueError):
                provider.preview({"id": "fs:12345", "previewUrl": PREVIEW})


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.project = Path(self.tmp.name)
        (self.project / "script").mkdir()
        (self.project / "src").mkdir()
        (self.project / "src/Shot.tsx").write_text("// fixture component\n")
        self.plan_path = self.project / "script/storyboard.json"
        (self.project / "project.json").write_text(json.dumps({"width": 1280, "height": 720, "fps": 30,
                                                             "totalFrames": 60, "status": "draft"}))
        (self.project / "user.wav").write_bytes(b"user fixture untouched")
        self.user_asset = {"path": "user.wav", "sha256": hashlib.sha256(b"user fixture untouched").hexdigest(),
                           "source": "user:provided", "license": "user authorization fixture", "usage": "existing", "ai": False}
        self.plan = {"shots": [{"id": "S01", "from": 1, "to": 60, "group": "G1", "component": "src/Shot.tsx",
                                "action": "turn page", "purpose": "show next step"}],
                     "claims": [], "assets": [self.user_asset], "customField": {"retain": True}}
        self.plan_path.write_text(json.dumps(self.plan))
        self.original = self.plan_path.read_bytes()
        self.transport = FixtureTransport()
        self.provider = sfx.FreesoundProvider(True, self.transport)
        self.tools = patch.object(sfx, "require_audio_tools")
        self.tools.start()
        self.addCleanup(self.tools.stop)

    def fetch(self, **kwargs):
        return sfx.fetch_selected(self.provider, self.project, "12345", "paper-turn", "S01 page-turn",
                                  inspector=fake_inspect, **kwargs)

    def test_selected_preview_uses_existing_asset_contract_and_preserves_other_assets(self):
        asset = self.fetch()
        saved = json.loads(self.plan_path.read_text())
        self.assertEqual(saved["assets"], [self.user_asset, asset])
        self.assertEqual(saved["shots"], self.plan["shots"])
        self.assertEqual(saved["customField"], {"retain": True})
        self.assertEqual((self.project / asset["path"]).read_bytes(), FAKE_MP3)
        self.assertEqual(asset["sha256"], hashlib.sha256(FAKE_MP3).hexdigest())
        self.assertTrue(asset["sfxSource"]["isPreview"])
        self.assertFalse(asset["sfxSource"]["originalDownloaded"])
        self.assertEqual(asset["sfxSource"]["sourceReview"], "not_performed")
        self.assertNotIn("ai", asset)  # never infer an uploader's creation process
        self.assertFalse(list(self.project.rglob("*manifest*")))
        self.assertFalse((self.project / "audio/sfx/cues.json").exists())
        result = subprocess.run(["node", "--input-type=module", "-e",
            "import {checkPlan} from './scripts/check-plan.mjs';"
            "const result=checkPlan(process.argv[1]); console.log(JSON.stringify(result));"
            "process.exitCode=result.pass?0:1;", str(self.project)], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_by_attribution_metadata_is_retained_not_published_automatically(self):
        self.transport.detail = DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by/4.0")
        asset = self.fetch(policy="cc-by")
        credit = asset["sfxSource"]
        self.assertTrue(credit["attributionRequired"])
        for key in ("title", "creator", "pageUrl", "licenseUrl", "changes"):
            self.assertIn(key, credit)

    def test_repeated_fetch_and_modified_file_never_overwrite(self):
        asset = self.fetch()
        (self.project / asset["path"]).write_bytes(b"user changed it")
        plan_before = self.plan_path.read_bytes()
        self.transport.requests.clear()
        with self.assertRaisesRegex(ValueError, "already registered"):
            self.fetch()
        self.assertEqual(self.transport.requests, [])
        self.assertEqual((self.project / asset["path"]).read_bytes(), b"user changed it")
        self.assertEqual(self.plan_path.read_bytes(), plan_before)

    def test_untracked_file_and_registered_missing_file_are_not_replaced(self):
        folder = self.project / "audio/sfx"
        folder.mkdir(parents=True)
        path = folder / "fs-12345-preview.mp3"
        path.write_bytes(b"untracked")
        with self.assertRaisesRegex(ValueError, "overwrite"):
            self.fetch()
        self.assertEqual(path.read_bytes(), b"untracked")
        self.assertEqual(self.transport.requests, [])
        path.unlink()
        self.plan["assets"].append({**self.user_asset, "path": "audio/sfx/fs-12345-preview.mp3"})
        self.plan_path.write_text(json.dumps(self.plan))
        with self.assertRaisesRegex(ValueError, "overwrite"):
            self.fetch()

    def test_unknown_license_never_downloads_or_changes_storyboard(self):
        self.transport.detail = DETAIL.replace(b"publicdomain/zero/1.0", b"licenses/by-nc/4.0")
        with self.assertRaises(ValueError):
            self.fetch()
        self.assertEqual(len(self.transport.requests), 1)
        self.assertEqual(self.plan_path.read_bytes(), self.original)
        self.assertEqual(list((self.project / "audio/sfx").iterdir()), [])

    def test_decode_failure_does_not_admit_asset_or_leak_temp_and_lock(self):
        with patch.object(sfx, "inspect_audio", side_effect=ValueError("bad MP3")):
            with self.assertRaisesRegex(ValueError, "bad MP3"):
                sfx.fetch_selected(self.provider, self.project, "12345", "paper-turn", "S01")
        self.assertEqual(self.plan_path.read_bytes(), self.original)
        self.assertEqual(list((self.project / "audio/sfx").iterdir()), [])

    def test_provider_duration_mismatch_is_not_admitted(self):
        self.transport.detail = DETAIL.replace(b'data-duration="0.75"', b'data-duration="1.75"')
        with self.assertRaisesRegex(ValueError, "differs from provider metadata"):
            self.fetch()
        self.assertEqual(self.plan_path.read_bytes(), self.original)
        self.assertEqual(list((self.project / "audio/sfx").iterdir()), [])

    def test_concurrent_storyboard_edit_survives_without_asset_admission(self):
        changed = b'{"assets": [], "editedByUser": true}'
        def edit_during_decode(path):
            self.plan_path.write_bytes(changed)
            return fake_inspect(path)
        with self.assertRaisesRegex(ValueError, "Storyboard changed"):
            sfx.fetch_selected(self.provider, self.project, "12345", "paper-turn", "S01", inspector=edit_during_decode)
        self.assertEqual(self.plan_path.read_bytes(), changed)
        self.assertEqual(list((self.project / "audio/sfx").iterdir()), [])

    def test_symlink_escape_and_lock_block_before_requests(self):
        with tempfile.TemporaryDirectory() as outside:
            (self.project / "audio").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symbolic link"):
                self.fetch()
            self.assertEqual(list(Path(outside).iterdir()), [])
            (self.project / "audio").unlink()
        folder = self.project / "audio/sfx"
        folder.mkdir(parents=True)
        lock = folder / ".sfx-source.lock"
        lock.write_text("other operation")
        with self.assertRaisesRegex(ValueError, "operation active"):
            self.fetch()
        self.assertEqual(lock.read_text(), "other operation")
        self.assertEqual(self.transport.requests, [])

    def test_registry_write_failure_leaves_inspectable_unregistered_preview(self):
        with patch.object(sfx.os, "replace", side_effect=OSError("fixture write failure")):
            with self.assertRaisesRegex(ValueError, "registry update failed; recover manually"):
                self.fetch()
        self.assertEqual(self.plan_path.read_bytes(), self.original)
        self.assertEqual((self.project / "audio/sfx/fs-12345-preview.mp3").read_bytes(), FAKE_MP3)
        self.assertFalse((self.project / "audio/sfx/.sfx-source.lock").exists())


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg/ffprobe unavailable")
class LocalDecodeTests(unittest.TestCase):
    def test_generated_local_tone_decodes_but_is_not_auditioned(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "synthetic.mp3"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.15",
                            "-c:a", "libmp3lame", str(path)], check=True, capture_output=True)
            info = sfx.inspect_audio(path)
            self.assertEqual(info["codec"], "mp3")
            self.assertEqual(info["decode"], "passed")
            self.assertEqual(info["audioReview"], "not_performed")
            path.write_bytes(b"this is HTML, not an mp3")
            with self.assertRaises(subprocess.CalledProcessError):
                sfx.inspect_audio(path)

    def test_truncated_mp3_with_stale_header_duration_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "synthetic.mp3"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.5",
                            "-c:a", "libmp3lame", str(path)], check=True, capture_output=True)
            info = sfx.inspect_audio(path)
            self.assertAlmostEqual(info["durationSeconds"], 0.5, places=3)
            payload = path.read_bytes()
            path.write_bytes(payload[:len(payload) // 2])
            with self.assertRaisesRegex(ValueError, "may be truncated"):
                sfx.inspect_audio(path)


class IntegrationBoundaryTests(unittest.TestCase):
    def test_packaged_optional_entry_does_not_join_normal_creation_pipeline(self):
        result = subprocess.run(["node", "--input-type=module", "-e",
            "import {collectCoreFiles} from './scripts/build-editions.mjs';"
            "console.log(JSON.stringify(['core','full'].map(profile=>collectCoreFiles(process.cwd(),{profile}))));"],
            cwd=ROOT, check=True, capture_output=True, text=True)
        for files in json.loads(result.stdout):
            self.assertIn("scripts/sfx_source.py", files)
            self.assertIn("reference/sfx-sourcing.md", files)
        for filename in ("scripts/init.mjs", "scripts/render.mjs", "template/scripts/mix_sfx.py",
                         "template/scripts/make_sfx.py", "template/scripts/mix_audio.py"):
            self.assertNotIn("sfx_source", (ROOT / filename).read_text())
        for filename in ("reference/sound-design.md", "reference/tools-and-components.md"):
            self.assertIn("sfx-sourcing.md", (ROOT / filename).read_text())


if __name__ == "__main__":
    unittest.main()
