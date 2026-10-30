#!/usr/bin/env python3
"""Optional, explicit Freesound preview sourcing; never called by init/render/mix.

Python standard library only. Fetch additionally needs ffmpeg/ffprobe. Selected
assets join script/storyboard.json, not a separate audio inventory. See
reference/sfx-sourcing.md for selection, attribution and review boundaries.

Independently implemented; the pinned video-shotcraft sourcing tool informed the
requirements, not this implementation (reference/sfx-sourcing.md lists sources).
"""

import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


SITE = "https://freesound.org"
PAGE_LIMIT = 2 * 1024 * 1024
PREVIEW_LIMIT = 32 * 1024 * 1024
MAX_DURATION = 120
ACTIONS = {
    "paper-turn": {"query": "paper page turn", "align": "onset", "note": "纸张翻页；先试现有 mgaudio.paper"},
    "stamp": {"query": "stamp wood hit", "align": "peak", "note": "印章落定；先试风格绑定合成拟音"},
    "slide": {"query": "short whoosh", "align": "peak", "note": "滑入/运镜；避开过长尾音"},
    "impact": {"query": "cinematic impact", "align": "peak", "note": "重物/标题落地；只给真正重拍"},
    "click": {"query": "mechanical switch click", "align": "onset", "note": "真实开关/点击，不默认游戏提示音"},
    "typing": {"query": "keyboard typing", "align": "onset", "note": "真实输入动作；控制连发密度"},
    "reveal": {"query": "shimmer reveal", "align": "peak", "note": "光效揭示；需配合片种试听"},
    "riser": {"query": "cinematic riser", "align": "end", "note": "蓄力到命中；保留预备段"},
    "transition": {"query": "soft transition whoosh", "align": "peak", "note": "切换声桥；不是每个切点都要声音"},
}


def sound_id(value):
    value = str(value).removeprefix("fs:")
    if not re.fullmatch(r"[1-9][0-9]{0,11}", value):
        raise ValueError("Sound ID must be a positive Freesound ID, e.g. fs:12345")
    return value


def https_host(url, host):
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.netloc != host or parts.fragment
            or any(ord(c) < 32 for c in url)):
        raise ValueError(f"Expected HTTPS URL on {host}")
    return parts


class SameHostRedirect(HTTPRedirectHandler):
    """Check each redirect *before* issuing it, not only the final response."""

    def __init__(self, host):
        self.host = host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        https_host(newurl, self.host)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def http_get(url, limit, host):
    https_host(url, host)
    request = Request(url, headers={"User-Agent": "anything2video-sfx-source/1.0"})
    with build_opener(SameHostRedirect(host)).open(request, timeout=20) as response:
        https_host(response.geturl(), host)
        payload = response.read(limit + 1)
        if len(payload) > limit:
            raise ValueError(f"Response exceeds {limit} bytes")
        return payload, response.geturl(), response.headers.get_content_type()


class MetadataPage(HTMLParser):
    """Collect only public metadata, never scripts, uploaded HTML or instructions."""

    def __init__(self, payload):
        super().__init__(convert_charrefs=True)
        self.players, self.license_links, self.canonicals, self.words = [], [], [], []
        self.stack, self.sidebars = [], 0
        self.feed(payload.decode("utf-8"))
        self.close()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        sidebar = "bw-sound__sidebar" in values.get("class", "").split()
        self.sidebars += int(sidebar)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append((tag, sidebar))
        if values.get("data-sound-id"):
            self.players.append(values)
        # The provider's sound template owns this sidebar/anchor. Arbitrary CC
        # links in descriptions, comments, or the site footer are not licenses.
        if (tag == "a" and any(item[1] for item in self.stack)
                and values.get("title") == "Go to the full license text"):
            self.license_links.append(values.get("href", ""))
        if tag == "link" and "canonical" in values.get("rel", "").split():
            self.canonicals.append(values.get("href", ""))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        self.words.append(data)


def text_field(value, label):
    if not isinstance(value, str) or not value.strip() or len(value) > 2000:
        raise ValueError(f"Missing/invalid {label}")
    if any(ord(c) < 32 for c in value):
        raise ValueError(f"Control character in {label}")
    return value.strip()


def canonical_sound_url(url, sid):
    parts = https_host(url, "freesound.org")
    match = re.fullmatch(rf"/people/([^/]+)/sounds/{sid}/", parts.path)
    if not match or parts.query:
        raise ValueError(f"Missing canonical detail URL for fs:{sid}")
    return text_field(unquote(match[1]), "creator")


def preview_kind(url, sid):
    parts = https_host(url, "cdn.freesound.org")
    match = re.fullmatch(rf"/previews/[0-9]+/{sid}_[0-9]+-(hq|lq)\.mp3", parts.path)
    if not match or parts.query:
        raise ValueError(f"Unexpected preview URL for fs:{sid}")
    return "mp3-preview-" + match[1]


def license_identity(url):
    parts = urlsplit(url)
    if (parts.scheme not in {"http", "https"}
            or parts.netloc not in {"creativecommons.org", "www.creativecommons.org"}
            or parts.query or parts.fragment):
        raise ValueError("Unknown license URL")
    path = parts.path.rstrip("/")
    if path == "/publicdomain/zero/1.0":
        code = "CC0-1.0"
    else:
        match = re.fullmatch(r"/licenses/by/(1\.0|2\.0|2\.5|3\.0|4\.0)", path)
        if not match:
            raise ValueError("License is not recognized CC0 or CC BY (NC/SA/Sampling+ are not admitted)")
        code = "CC-BY-" + match[1]
    return code, "https://creativecommons.org" + path + "/"


def require_license(code, policy):
    if policy not in {"cc0", "cc-by"}:
        raise ValueError("Unknown license policy")
    if code != "CC0-1.0" and not (policy == "cc-by" and code.startswith("CC-BY-")):
        raise ValueError("License outside policy; CC BY requires explicit --license cc-by and publication credits")


class FreesoundProvider:
    def __init__(self, allow_network=False, transport=None):
        self.allow_network = allow_network
        self.transport = transport or http_get

    def request(self, url, *, audio=False):
        if not self.allow_network:
            raise ValueError("Network disabled; explicitly pass --allow-network for this operation")
        host, limit = ("cdn.freesound.org", PREVIEW_LIMIT) if audio else ("freesound.org", PAGE_LIMIT)
        https_host(url, host)
        payload, final, mime = self.transport(url, limit, host)
        https_host(final, host)
        if not payload or len(payload) > limit:
            raise ValueError("Empty or oversized provider response")
        allowed = {"audio/mpeg", "audio/mp3", "application/octet-stream"} if audio else {"text/html"}
        if mime not in allowed:
            raise ValueError("Unexpected response type; login/error pages are not audio")
        return payload, final

    def search(self, action, query=None, policy="cc0", limit=8, max_duration=10):
        require_license("CC0-1.0", policy)
        if action not in ACTIONS or not 1 <= limit <= 20:
            raise ValueError("Use a known action and --limit 1..20")
        if not math.isfinite(max_duration) or not 0 < max_duration <= MAX_DURATION:
            raise ValueError(f"--max-duration must be >0 and <= {MAX_DURATION}")
        query = text_field(query if query is not None else ACTIONS[action]["query"], "query")
        license_filter = 'license:"Creative Commons 0"' if policy == "cc0" else 'license:("Creative Commons 0" OR "Attribution")'
        url = SITE + "/search/?" + urlencode({"q": query, "f": license_filter + f" duration:[0 TO {max_duration}]"})
        payload, final = self.request(url)
        if urlsplit(final).path != "/search/":
            raise ValueError("Search redirected away from public results")
        page, candidates = MetadataPage(payload), {}
        for player in page.players:
            sid = sound_id(player["data-sound-id"])
            duration = float(player.get("data-duration", "nan"))
            if not math.isfinite(duration) or duration <= 0:
                raise ValueError("Search markup changed: missing sound duration")
            if duration > max_duration:
                continue
            candidates[sid] = {
                "id": "fs:" + sid, "title": text_field(player.get("data-title"), "title"),
                "detailUrl": SITE + "/s/" + sid + "/", "durationSeconds": duration,
                "licenseChecked": False,
            }
        if not page.players and not re.search(r"no (?:sounds|results)|0 sounds|couldn't find|did not match", " ".join(page.words), re.I):
            raise ValueError("Search markup unrecognized; no fallback license or download")
        return {"provider": "freesound", "action": action, "query": query, "licensePolicy": policy,
                "results": list(candidates.values())[:limit],
                "note": "Candidates only; detail license and intended use must be checked. No audio downloaded or auditioned."}

    def detail(self, sid, policy):
        sid = sound_id(sid)
        payload, final = self.request(SITE + "/s/" + sid + "/")
        creator = canonical_sound_url(final, sid)
        page = MetadataPage(payload)
        if any(urljoin(final, url) != final for url in page.canonicals):
            raise ValueError("Conflicting canonical sound identity")
        players = [p for p in page.players if p.get("data-sound-id") == sid and p.get("data-mp3")]
        if len(players) != 1:
            raise ValueError("Detail markup changed: expected one matching sound player")
        player = players[0]
        if player.get("data-username") and player["data-username"] != creator:
            raise ValueError("Conflicting sound creator")
        duration = float(player.get("data-duration", "nan"))
        if not math.isfinite(duration) or not 0 < duration <= MAX_DURATION:
            raise ValueError(f"Sound duration must be >0 and <= {MAX_DURATION} seconds")
        if page.sidebars != 1 or len(page.license_links) != 1:
            raise ValueError("Missing or ambiguous detail-page license")
        code, license_url = license_identity(page.license_links[0])
        require_license(code, policy)
        preview = player["data-mp3"]
        return {"provider": "freesound", "id": "fs:" + sid, "title": text_field(player.get("data-title"), "title"),
                "creator": creator, "pageUrl": final, "license": code, "licenseUrl": license_url,
                "previewUrl": preview, "rendition": preview_kind(preview, sid),
                "licenseEvidence": "sound sidebar / full license text anchor",
                "declaredDurationSeconds": duration, "detailPageSha256": hashlib.sha256(payload).hexdigest(),
                "licenseCheckedAt": datetime.now(timezone.utc).isoformat()}

    def preview(self, details):
        sid = sound_id(details["id"])
        kind = preview_kind(details["previewUrl"], sid)
        payload, final = self.request(details["previewUrl"], audio=True)
        if preview_kind(final, sid) != kind or final != details["previewUrl"]:
            raise ValueError("Preview identity changed during download; select again from refreshed detail")
        return payload, final


def require_audio_tools():
    if any(shutil.which(tool) is None for tool in ("ffprobe", "ffmpeg")):
        raise ValueError("Fetch needs ffprobe and ffmpeg; no audio downloaded")


def inspect_audio(path):
    """Technical decode only. Landmarks and listening remain separate existing steps."""
    require_audio_tools()
    result = subprocess.run([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-select_streams", "a",
        "-show_entries", "stream=codec_name,sample_rate,channels:format=duration,format_name",
        "-of", "json", str(path),
    ], check=True, capture_output=True, text=True, timeout=30)
    probe = json.loads(result.stdout)
    streams, fmt = probe.get("streams", []), probe.get("format", {})
    duration = float(fmt.get("duration", "nan"))
    if (len(streams) != 1 or streams[0].get("codec_name") != "mp3" or fmt.get("format_name") != "mp3"
            or not math.isfinite(duration) or not 0 < duration <= MAX_DURATION):
        raise ValueError("Expected one bounded MP3 preview stream, not an original/lossless file")
    stream = streams[0]
    channels, rate = int(stream.get("channels", 0)), int(stream.get("sample_rate", 0))
    if channels not in {1, 2} or not 8000 <= rate <= 192000:
        raise ValueError("Unsupported preview channels/sample rate")
    decoded = subprocess.run([
        "ffmpeg", "-v", "error", "-xerror", "-nostdin", "-protocol_whitelist", "file,pipe",
        "-i", str(path), "-map", "0:a:0", "-t", str(MAX_DURATION + 1),
        "-ar", "8000", "-ac", "1", "-f", "s16le", "-",
    ], check=True, capture_output=True, timeout=30)
    # A truncated MP3 can decode with exit 0 while retaining its original Xing
    # duration. Count actual decoded samples; allow normal MP3 padding only.
    actual_duration = len(decoded.stdout) / (8000 * 2)
    tolerance = max(0.10, 2304 / rate)
    if not 0 < actual_duration <= MAX_DURATION or abs(actual_duration - duration) > tolerance:
        raise ValueError("Decoded duration differs from MP3 header; preview may be truncated")
    return {"codec": "mp3", "sampleRate": rate, "channels": channels,
            "durationSeconds": actual_duration, "containerDurationSeconds": duration,
            "decode": "passed", "audioReview": "not_performed"}


def project_path(root, relative):
    path = root
    for part in Path(relative).parts:
        if part in {"..", "."} or Path(part).is_absolute():
            raise ValueError("Unsafe project path")
        path = path / part
        if path.is_symlink():
            raise ValueError(f"Refusing symbolic link in project path: {path}")
    if not path.resolve().is_relative_to(root):
        raise ValueError("Path escapes project")
    return path


def fetch_selected(provider, project, sid, action, usage, policy="cc0", inspector=None):
    """One explicitly selected asset; preserve every other storyboard field/asset."""
    if not provider.allow_network:
        raise ValueError("Network disabled; explicitly pass --allow-network for this operation")
    sid, usage = sound_id(sid), text_field(usage, "usage")
    if action not in ACTIONS:
        raise ValueError("Unknown action")
    require_license("CC0-1.0", policy)
    root = Path(project).resolve(strict=True)
    skill = Path(__file__).resolve().parents[1]
    if root.is_relative_to(skill) or skill.is_relative_to(root):
        raise ValueError("Project and skill package must not overlap")
    project_path(root, "project.json").read_bytes()  # require an existing video project
    plan_path = project_path(root, "script/storyboard.json")
    original = plan_path.read_bytes()
    plan = json.loads(original)
    if not isinstance(plan, dict) or not isinstance(plan.get("assets", []), list):
        raise ValueError("Existing storyboard.assets must be an array")
    assets = plan.setdefault("assets", [])
    if any(not isinstance(asset, dict) for asset in assets):
        raise ValueError("Malformed existing asset record; repair it before sourcing")
    if any(asset.get("sfxSource", {}).get("id") == "fs:" + sid
           for asset in assets if isinstance(asset.get("sfxSource", {}), dict)):
        raise ValueError("This sound is already registered; existing bytes/provenance will not be overwritten")
    # The name never suggests an uploader original or a lossless master.
    relative = f"audio/sfx/fs-{sid}-preview.mp3"
    destination = project_path(root, relative)
    if destination.exists() or any(asset.get("path") == relative for asset in assets):
        raise ValueError("Refusing to overwrite existing/untracked/modified preview or asset record")
    require_audio_tools()
    directory = project_path(root, "audio/sfx")
    directory.mkdir(parents=True, exist_ok=True)
    lock = project_path(root, "audio/sfx/.sfx-source.lock")
    try:
        handle = lock.open("x")
    except FileExistsError as error:
        raise ValueError("SFX source operation active (or stale lock); inspect .sfx-source.lock before recovery") from error
    temporary = []
    try:
        with handle:
            # Network metadata is never loaded from a stale search result/cache.
            details = provider.detail(sid, policy)
            payload, downloaded_url = provider.preview(details)
            with tempfile.NamedTemporaryFile(dir=directory, suffix=".mp3", delete=False) as tmp:
                temporary.append(Path(tmp.name))
                tmp.write(payload)
            analysis = (inspector or inspect_audio)(temporary[-1])
            if abs(analysis["durationSeconds"] - details["declaredDurationSeconds"]) > max(0.10, 2304 / analysis["sampleRate"]):
                raise ValueError("Decoded duration differs from provider metadata; preview may be incomplete")
            provenance = {**details, "downloadUrl": downloaded_url, "isPreview": True,
                          "originalDownloaded": False, "downloadedAt": datetime.now(timezone.utc).isoformat(),
                          "action": action, "licensePolicy": policy, "changes": [], "analysis": analysis,
                          "sourceReview": "not_performed",
                          "attributionRequired": details["license"].startswith("CC-BY-")}
            # ai is deliberately not guessed from a hosting site's metadata.
            asset = {"path": relative, "sha256": hashlib.sha256(payload).hexdigest(),
                     "source": details["pageUrl"], "license": details["license"], "usage": usage,
                     "sfxSource": provenance}
            assets.append(asset)
            with tempfile.NamedTemporaryFile(dir=plan_path.parent, suffix=".json", mode="w", encoding="utf-8", delete=False) as tmp:
                temporary.append(Path(tmp.name))
                json.dump(plan, tmp, ensure_ascii=False, indent=2, allow_nan=False)
                tmp.write("\n")
            os.chmod(temporary[-1], stat.S_IMODE(plan_path.stat().st_mode))
            if project_path(root, "script/storyboard.json").read_bytes() != original:
                raise ValueError("Storyboard changed during sourcing; no asset admitted, retry after edits finish")
            project_path(root, relative)
            # Atomic exclusive creation: even a competing new file cannot be replaced.
            os.link(temporary[0], destination)
            try:
                os.replace(temporary[-1], plan_path)
            except OSError as error:
                # Retain inspectable bytes rather than deleting a potentially edited file.
                raise ValueError(f"Preview saved at {destination}, but registry update failed; recover manually: {error}") from error
            return asset
    finally:
        for path in temporary:
            path.unlink(missing_ok=True)
        lock.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("actions", help="Offline action vocabulary/query suggestions")
    search = commands.add_parser("search", help="Explicit metadata-only search; never downloads audio")
    search.add_argument("action", choices=ACTIONS)
    search.add_argument("--query", help="Override suggested English search words")
    search.add_argument("--limit", type=int, default=8)
    search.add_argument("--max-duration", type=float, default=10)
    fetch = commands.add_parser("fetch", help="Fetch one selected preview and register in storyboard.assets")
    fetch.add_argument("id")
    fetch.add_argument("--project", required=True, help="Existing project outside the skill package")
    fetch.add_argument("--action", choices=ACTIONS, required=True)
    fetch.add_argument("--usage", required=True, help="Intended shot/action; not an audition claim")
    for command in (search, fetch):
        command.add_argument("--license", choices=("cc0", "cc-by"), default="cc0")
        command.add_argument("--allow-network", action="store_true", help="Explicit consent for this command's network requests")
    args = parser.parse_args(argv)
    try:
        if args.command == "actions":
            result = ACTIONS
        else:
            provider = FreesoundProvider(args.allow_network)
            if args.command == "search":
                result = provider.search(args.action, args.query, args.license, args.limit, args.max_duration)
            else:
                result = fetch_selected(provider, args.project, args.id, args.action, args.usage, args.license)
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(f"sfx_source: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
