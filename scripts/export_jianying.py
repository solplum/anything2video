#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Experimental JianYing / CapCut draft-data exporter (not desktop-import validated).

Consumes project.json, a verified full rendered MP4, optional raw narration/BGM,
and (only with --include-subtitles) timed script/timeline.json. It does not create
a clean video, separate baked captions/audio, or reconstruct mix plans/SFX/word styling.
The rendered video's audio stays authoritative; optional raw stems start muted.
Producer-side media/timing checks are not a final-QC or editor-compatibility claim.

Usage:
  python scripts/export_jianying.py <project> [--video renders/film_v1.mp4]
      [--include-subtitles] [--name <name>] [--out <directory>] [--dry-run]
"""

import argparse
import json
import hashlib
import math
import os
import re
import shutil
import sys
import subprocess
from fractions import Fraction
import time
import uuid
from pathlib import Path


def get_default_draft_root() -> Path:
    """获取本机默认剪映草稿目录。"""
    if sys.platform == "darwin":
        # macOS 剪映沙盒工程根目录
        return Path.home() / "Movies/JianyingPro/User Data/Projects/com.lveditor.draft"
    elif sys.platform == "win32":
        # Windows 剪映默认工程根目录
        local_app = os.environ.get("LOCALAPPDATA", "")
        if local_app:
            return Path(local_app) / "JianyingPro/User Data/Projects/com.lveditor.draft"
        return Path.home() / "AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft"
    else:
        # Linux / WSL 兼容目录
        return Path.home() / ".jianying/draft"


def read_object(file: Path) -> dict:
    try:
        value = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ValueError(f"Cannot read JSON {file}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {file}")
    return value


def positive_integer(value, label: str) -> int:
    if type(value) is not int or value <= 0:
        raise ValueError(f"{label} must be a positive integer")
    return value


def project_settings(project_dir: Path) -> dict:
    info = read_object(project_file(project_dir, Path("project.json")))
    for key in ("fps", "width", "height", "totalFrames"):
        positive_integer(info.get(key), f"project.{key}")
    if not isinstance(info.get("slug"), str) or not re.fullmatch(r"[A-Za-z0-9_-]+", info["slug"]):
        raise ValueError("project.slug must contain only letters, digits, underscores or hyphens")
    return info


def seconds(value, label: str) -> Fraction:
    if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
        raise ValueError(f"{label} must be a finite nonnegative number")
    return Fraction(str(value))


def microseconds(value: Fraction) -> int:
    # Convert endpoints once; adjacent frame boundaries stay identical at e.g. 30 fps.
    return round(value * 1_000_000)


def caption_range(entry: dict, fps: int | None, label: str) -> tuple[Fraction, Fraction]:
    if not isinstance(entry, dict) or not isinstance(entry.get("text"), str) or not entry["text"].strip():
        raise ValueError(f"{label} requires nonempty text")
    families = [("from", "to"), ("start", "end"), ("start_frame", "end_frame")]
    present = [pair for pair in families if any(key in entry for key in pair)]
    if len(present) != 1 or not all(key in entry for key in present[0]):
        raise ValueError(f"{label} requires exactly one complete timing pair: from/to, start/end, or start_frame/end_frame")
    first, last = present[0]
    if first == "start":
        begin, end = seconds(entry[first], label + ".start"), seconds(entry[last], label + ".end")
    else:
        positive_integer(fps, "timeline fps (required for frame timing)")
        a, b = entry[first], entry[last]
        if type(a) is not int or type(b) is not int:
            raise ValueError(f"{label} frame boundaries must be integers")
        # Canonical from/to are 1-based inclusive. Legacy *_frame are 0-based end-exclusive.
        begin = Fraction(a - 1 if first == "from" else a, fps)
        end = Fraction(b, fps)
    if begin < 0 or end <= begin:
        raise ValueError(f"{label} has an invalid or empty time range")
    return begin, end


def parse_timeline(project_dir: Path, project_info: dict | None = None) -> list[dict]:
    """Read timed JSON only; never estimate times from TS/SRT text.

    Canonical sentence/subtitle from/to: 1-based inclusive frames. Legacy start/end:
    seconds; start_frame/end_frame: 0-based, end-exclusive frames. Mixed pairs fail.
    Nested subtitle chunks are preferred to sentence text; character timings and
    bilingual layout are not reconstructed in this experimental exporter.
    """
    timeline_path = project_dir / "script/timeline.json"
    if timeline_path.exists() or timeline_path.is_symlink():
        timeline_path = project_file(project_dir, timeline_path)
    if not timeline_path.is_file():
        subs_path = project_dir / "src/common/subs.ts"
        if subs_path.is_file():
            # The untouched, empty template is not a subtitle track. Other TS is unsupported.
            source = project_file(project_dir, subs_path).read_text(encoding="utf-8")
            if not re.search(r"export\s+const\s+SUBS\s*:[^=]+?=\s*\[\s*\]\s*;", source):
                raise ValueError("Timed script/timeline.json is required; nonempty subs.ts/SRT import is unsupported")
        if list(project_dir.glob("*.srt")) or list((project_dir / "script").glob("*.srt")):
            raise ValueError("SRT import is unsupported; provide timed script/timeline.json")
        return []
    data = read_object(timeline_path)
    fps = data.get("fps", (project_info or {}).get("fps"))
    if fps is not None:
        positive_integer(fps, "timeline.fps")
    if project_info and fps != project_info["fps"]:
        raise ValueError("timeline.fps differs from project.fps")
    totals = [data[key] for key in ("total_frames", "totalFrames") if key in data]
    for value in totals:
        positive_integer(value, "timeline total_frames")
    if len(set(totals)) > 1:
        raise ValueError("Conflicting timeline total_frames/totalFrames")
    total = totals[0] if totals else (project_info or {}).get("totalFrames")
    if project_info and total != project_info["totalFrames"]:
        raise ValueError("timeline total_frames differs from project.totalFrames")
    limit = Fraction(total, fps) if total is not None and fps is not None else None
    sentences = data.get("sentences")
    if not isinstance(sentences, list):
        raise ValueError("timeline.sentences must be an array")
    if not sentences:
        subs_path = project_dir / "src/common/subs.ts"
        if subs_path.is_file() and not re.search(
                r"export\s+const\s+SUBS\s*:[^=]+?=\s*\[\s*\]\s*;", project_file(project_dir, subs_path).read_text(encoding="utf-8")):
            raise ValueError("Empty timeline.sentences cannot export nonempty subs.ts; this subtitle format is unsupported")
    items = []
    previous_end = Fraction(0)
    for index, sentence in enumerate(sentences):
        label = f"sentences[{index}]"
        parent_begin, parent_end = caption_range(sentence, fps, label)
        if limit is not None and parent_end > limit:
            raise ValueError(f"{label} exceeds project duration")
        chunks = sentence.get("subs", [sentence])
        if not isinstance(chunks, list) or not chunks:
            raise ValueError(f"{label}.subs must be a nonempty array when present")
        for sub_index, chunk in enumerate(chunks):
            sub_label = f"{label}.subs[{sub_index}]" if "subs" in sentence else label
            begin, end = caption_range(chunk, fps, sub_label)
            if begin < parent_begin or end > parent_end:
                raise ValueError(f"{sub_label} falls outside its sentence")
            if begin < previous_end:
                raise ValueError(f"{sub_label} overlaps or is out of order")
            start_us, end_us = microseconds(begin), microseconds(end)
            if end_us <= start_us:
                raise ValueError(f"{sub_label} is shorter than microsecond precision")
            items.append({"text": chunk["text"], "start_us": start_us, "duration_us": end_us - start_us})
            previous_end = end
    return items


def project_file(project_dir: Path, path: Path) -> Path:
    root = project_dir.resolve()
    candidate = (path if path.is_absolute() else root / path).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError(f"Missing or outside-project media: {path}")
    return candidate


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe_media(path: Path, count_frames: bool = False) -> dict:
    command = ["ffprobe", "-v", "error"]
    if count_frames:
        command.append("-count_frames")
    command.extend(["-show_streams", "-show_format", "-of", "json", str(path)])
    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=120, check=True)
        probe = json.loads(process.stdout)
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise ValueError(f"Cannot verify media with ffprobe: {path}: {error}") from error
    if (not isinstance(probe, dict) or not isinstance(probe.get("streams"), list)
            or any(not isinstance(stream, dict) for stream in probe["streams"])):
        raise ValueError(f"Invalid ffprobe response: {path}")
    return probe


def verify_video(path: Path, info: dict, require_sidecar: bool = False, project_dir: Path | None = None) -> dict:
    sidecar_path = path.with_name(path.name + ".delivery.json")
    if sidecar_path.exists() or sidecar_path.is_symlink():
        sidecar = read_object(project_file(project_dir or path.parent, sidecar_path))
        frames = sidecar.get("frames")
        if (type(sidecar.get("schemaVersion")) is not int or sidecar["schemaVersion"] != 1
                or not isinstance(frames, dict) or any(type(frames.get(key)) is not int for key in ("from", "to"))
                or sidecar.get("mode") != "video"
                or sidecar.get("frames") != {"from": 1, "to": info["totalFrames"]}):
            raise ValueError(f"Not a full-render video sidecar: {sidecar_path}")
        if sidecar.get("mediaSha256") != sha256_file(path):
            raise ValueError(f"Stale media hash: {sidecar_path}")
    elif require_sidecar:
        raise ValueError(f"Automatic selection requires a full-render .delivery.json; use --video for legacy media: {path}")
    probe = probe_media(path, count_frames=True)
    videos = [stream for stream in probe["streams"] if stream.get("codec_type") == "video"]
    if len(videos) != 1:
        raise ValueError(f"Expected one video stream: {path}")
    video = videos[0]
    try:
        valid = (video.get("width") == info["width"] and video.get("height") == info["height"]
                 and int(video.get("nb_read_frames", video.get("nb_frames", 0))) == info["totalFrames"]
                 and all(abs(float(Fraction(video[key])) - info["fps"]) <= 0.001
                         for key in ("avg_frame_rate", "r_frame_rate"))
                 and abs(float(video.get("duration", probe.get("format", {}).get("duration")))
                         - info["totalFrames"] / info["fps"]) <= 1 / info["fps"] + 0.02)
    except (KeyError, ValueError, TypeError, ZeroDivisionError):
        valid = False
    if not valid:
        raise ValueError(f"Video dimensions, fps, duration or frame count do not match the full project: {path}")
    if (info.get("audio", {}).get("mode") != "silent"
            and not any(stream.get("codec_type") == "audio" for stream in probe["streams"])):
        raise ValueError(f"Video has no authoritative audio; declare project.audio.mode='silent' only for intentional silence: {path}")
    return probe


def select_video(project_dir: Path, info: dict, video_path: Path | None = None) -> Path:
    if video_path is not None:
        selected = project_file(project_dir, video_path)
        verify_video(selected, info, project_dir=project_dir)
        return selected
    candidates = set()
    invalid = []
    for directory in ("renders", "delivery", "out"):
        for path in sorted((project_dir / directory).glob("*.mp4")):
            sidecar_path = path.with_name(path.name + ".delivery.json")
            if not sidecar_path.is_file():
                continue
            sidecar = read_object(project_file(project_dir, sidecar_path))
            if sidecar.get("mode") in ("preview", "stills"):
                continue
            candidate = project_file(project_dir, path)
            try:
                verify_video(candidate, info, require_sidecar=True, project_dir=project_dir)
            except ValueError as error:
                invalid.append(str(error))
            else:
                candidates.add(candidate)
    if invalid:
        raise ValueError("Invalid full-render candidate; choose a valid --video explicitly: " + "; ".join(invalid))
    if len(candidates) != 1:
        raise ValueError(f"Expected exactly one verified full render, found {len(candidates)}; choose --video <project-relative MP4>")
    return candidates.pop()


def select_audio(project_dir: Path, canonical: list[Path], legacy: list[Path]) -> Path | None:
    # Canonical producer output wins over legacy copies; never pick between ambiguous aliases.
    for paths in (canonical, legacy):
        matches = {project_file(project_dir, path) for path in paths if path.is_file()}
        if len(matches) > 1:
            raise ValueError("Ambiguous audio files: " + ", ".join(str(path) for path in sorted(matches)))
        if matches:
            return matches.pop()
    return None


def bundle_media(source: Path, directory: Path, dry_run: bool) -> Path:
    target = directory / source.name
    if not dry_run:
        # Do not silently keep stale bytes from an earlier export.
        if target.exists() and sha256_file(target) != sha256_file(source):
            raise ValueError(f"Bundled media already exists with different bytes: {target}")
        if not target.exists():
            directory.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    return target


def build_draft_structure(
    project_dir: Path,
    draft_name: str,
    media_bundle_dir: Path,
    use_clean_video: bool = False,
    *,
    video_path: Path | None = None,
    dry_run: bool = False,
    include_subtitles: bool = False
) -> tuple[dict, dict]:
    """Generate experimental draft dictionaries after producer-side validation."""
    if use_clean_video:
        raise ValueError("Clean-video generation is unsupported; supply an independently prepared --video")
    project_info = project_settings(project_dir)
    fps, width, height = (project_info[key] for key in ("fps", "width", "height"))
    total_duration_us = microseconds(Fraction(project_info["totalFrames"], fps))
    subtitles = parse_timeline(project_dir, project_info) if include_subtitles else []
    draft_id = str(uuid.uuid4()).upper()
    now_ms = int(time.time() * 1000)
    slug = project_info["slug"]
    found_video = select_video(project_dir, project_info, video_path)
    assets = project_dir / "public/assets" / slug
    found_narration = select_audio(project_dir, [assets / "audio_narration.wav"], [
        project_dir / "assets/audio_narration.wav", project_dir / "audio/audio_narration.wav",
        project_dir / "audio_narration.wav"
    ])
    found_bgm = select_audio(project_dir, [assets / "bgm.wav", assets / "bgm.mp3"], [
        project_dir / "assets/bgm.wav", project_dir / "audio/bgm.wav", project_dir / "bgm.wav"
    ])

    audio_durations = {}
    for audio in (found_narration, found_bgm):
        if audio is None:
            continue
        probe = probe_media(audio)
        streams = [stream for stream in probe["streams"] if stream.get("codec_type") == "audio"]
        try:
            duration = Fraction(str(streams[0].get("duration", probe.get("format", {}).get("duration"))))
        except (IndexError, ValueError, TypeError, ZeroDivisionError) as error:
            raise ValueError(f"Cannot verify audio duration: {audio}") from error
        if duration <= 0:
            raise ValueError(f"Audio must have positive duration: {audio}")
        audio_durations[audio] = microseconds(duration)

    materials = {
        "videos": [],
        "audios": [],
        "texts": [],
        "speeds": [
            {
                "curve_speed": None,
                "id": str(uuid.uuid4()).upper(),
                "mode": 0,
                "speed": 1.0,
                "type": "speed"
            }
        ]
    }
    tracks = []
    meta_materials = []

    # 1. 视频主轨
    if found_video:
        video_id = str(uuid.uuid4()).upper()
        # 复制到 Resources/
        dest_video = bundle_media(found_video, media_bundle_dir, dry_run)

        materials["videos"].append({
            "id": video_id,
            "type": "video",
            "path": str(dest_video.resolve()),
            "duration": total_duration_us,
            "width": width,
            "height": height
        })
        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "video",
            "segments": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "material_id": video_id,
                    "target_timerange": {"start": 0, "duration": total_duration_us},
                    "source_timerange": {"start": 0, "duration": total_duration_us},
                    "speed": 1.0,
                    "volume": 1.0
                }
            ]
        })
        meta_materials.append({"id": video_id, "type": 0, "path": str(dest_video.resolve())})

    # 2. 旁白音轨
    if found_narration:
        narr_id = str(uuid.uuid4()).upper()
        dest_narr = bundle_media(found_narration, media_bundle_dir, dry_run)

        materials["audios"].append({
            "id": narr_id,
            "type": "audio",
            "path": str(dest_narr.resolve()),
            "duration": audio_durations[found_narration]
        })
        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "audio",
            "segments": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "material_id": narr_id,
                    "target_timerange": {"start": 0, "duration": min(total_duration_us, audio_durations[found_narration])},
                    "source_timerange": {"start": 0, "duration": min(total_duration_us, audio_durations[found_narration])},
                    "volume": 0.0  # Raw stem starts muted; video already carries the final mix.
                }
            ]
        })
        meta_materials.append({"id": narr_id, "type": 1, "path": str(dest_narr.resolve())})

    # 3. 背景音乐轨
    if found_bgm:
        bgm_id = str(uuid.uuid4()).upper()
        dest_bgm = bundle_media(found_bgm, media_bundle_dir, dry_run)

        materials["audios"].append({
            "id": bgm_id,
            "type": "audio",
            "path": str(dest_bgm.resolve()),
            "duration": audio_durations[found_bgm]
        })
        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "audio",
            "segments": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "material_id": bgm_id,
                    "target_timerange": {"start": 0, "duration": min(total_duration_us, audio_durations[found_bgm])},
                    "source_timerange": {"start": 0, "duration": min(total_duration_us, audio_durations[found_bgm])},
                    "volume": 0.0  # No reconstruction of looping, transitions, ducking or SFX.
                }
            ]
        })
        meta_materials.append({"id": bgm_id, "type": 1, "path": str(dest_bgm.resolve())})

    # 4. 可编辑字幕文本轨
    if subtitles:
        text_segments = []
        for sub in subtitles:
            text_id = str(uuid.uuid4()).upper()
            content_json = json.dumps({
                "styles": [
                    {"fill": {"content": {"solid": {"color": [1.0, 1.0, 1.0]}}}, "range": [0, len(sub["text"])]}
                ],
                "text": sub["text"]
            }, ensure_ascii=False)

            materials["texts"].append({
                "id": text_id,
                "type": "text",
                "content": content_json,
                "font_size": 8.0,
                "alignment": 1
            })
            text_segments.append({
                "id": str(uuid.uuid4()).upper(),
                "material_id": text_id,
                "target_timerange": {"start": sub["start_us"], "duration": sub["duration_us"]},
                "source_timerange": {"start": 0, "duration": sub["duration_us"]}
            })

        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "text",
            "segments": text_segments
        })

    # Experimental historical draft shape; target desktop import remains unverified.
    draft_info = {
        "canvas_config": {"height": height, "ratio": "original", "width": width},
        "color_space": 0,
        "duration": total_duration_us,
        "fps": fps,
        "id": draft_id,
        "materials": materials,
        "platform": {
            "app_version": "5.9.0",
            "os": "mac" if sys.platform == "darwin" else "windows"
        },
        "tracks": tracks,
        "version": 360000
    }

    # 组装 draft_meta_info.json
    draft_meta = {
        "draft_id": draft_id,
        "draft_name": draft_name,
        "draft_fold_path": str(media_bundle_dir.parent.resolve()),
        "tm_draft_create": now_ms,
        "tm_draft_modified": now_ms,
        "draft_materials": meta_materials,
        "draft_materials_copied": True
    }

    return draft_info, draft_meta


def export_jianying(
    project_dir: Path,
    draft_name: str | None = None,
    out_dir: Path | None = None,
    install_to_app: bool = False,
    dry_run: bool = False,
    video_path: Path | None = None,
    include_subtitles: bool = False
) -> Path:
    """执行剪映草稿导出主逻辑。"""
    project_dir = project_dir.resolve()
    if not project_dir.is_dir():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")

    name = draft_name or project_dir.name or "anything2video_project"
    # 清理非法路径字符
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    if name.strip() in ("", ".", ".."):
        raise ValueError("Draft name must not be empty, dot or dot-dot")

    if install_to_app:
        target_draft_dir = get_default_draft_root() / name
    elif out_dir:
        target_draft_dir = out_dir.resolve() / name
    else:
        target_draft_dir = project_dir / "delivery/jianying_draft" / name

    if not install_to_app and out_dir is None and not target_draft_dir.resolve().is_relative_to(project_dir):
        raise ValueError(f"Default draft output escapes project: {target_draft_dir}")
    if target_draft_dir.exists() or target_draft_dir.is_symlink():
        raise FileExistsError(f"Draft output already exists; choose another --name or --out: {target_draft_dir}")

    if dry_run:
        print(f"[dry-run] 将生成剪映工程: {target_draft_dir}")
        draft_info, draft_meta = build_draft_structure(
            project_dir, name, target_draft_dir / "Resources", video_path=video_path, dry_run=True, include_subtitles=include_subtitles
        )
        print(f"[dry-run] 轨道总数: {len(draft_info['tracks'])} | 素材总数: {len(draft_meta['draft_materials'])}")
        return target_draft_dir

    resources_dir = target_draft_dir / "Resources"

    draft_info, draft_meta = build_draft_structure(project_dir, name, resources_dir, video_path=video_path, include_subtitles=include_subtitles)

    # Write both historical entry filenames; this does not establish desktop compatibility.
    (target_draft_dir / "draft_info.json").write_text(
        json.dumps(draft_info, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (target_draft_dir / "draft_content.json").write_text(
        json.dumps(draft_info, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (target_draft_dir / "draft_meta_info.json").write_text(
        json.dumps(draft_meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✓ 实验性 Jianying draft 数据已生成: {target_draft_dir}")
    print("  - 未验证剪映/CapCut 桌面导入；不替代最终 QC。视频保留原声，原始旁白/BGM 轨默认静音。")
    if include_subtitles:
        print("  - 已显式生成文本轨；成片可能已有烧录字幕，导入后请检查重复叠字。")
    print(f"  - 包含轨道: {[t['type'] for t in draft_info['tracks']]}")
    print(f"  - 媒体资源打包于: {resources_dir}")
    if install_to_app:
        print("  - 已写入默认草稿目录；能否被当前桌面版本识别仍须人工验证。")

    return target_draft_dir


def main():
    parser = argparse.ArgumentParser(description="导出实验性 Jianying 草稿数据（尚未验证桌面兼容）")
    parser.add_argument("project", type=Path, help="anything2video 工程目录")
    parser.add_argument("--include-subtitles", action="store_true", help="显式添加可编辑文本轨；成片已有烧录字幕时会重复叠字")
    parser.add_argument("--video", type=Path, default=None, help="明确指定完整成片（工程内路径）；无 sidecar 的旧版成片须显式指定")
    parser.add_argument("--name", type=str, default=None, help="草稿名称")
    parser.add_argument("--out", type=Path, default=None, help="自定义导出目录")
    parser.add_argument("--install", action="store_true", help="直接安装到本机剪映草稿库")
    parser.add_argument("--dry-run", action="store_true", help="只校验并打印工程结构")

    args = parser.parse_args()
    try:
        export_jianying(
            project_dir=args.project,
            draft_name=args.name,
            out_dir=args.out,
            install_to_app=args.install,
            dry_run=args.dry_run,
            video_path=args.video,
            include_subtitles=args.include_subtitles
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
