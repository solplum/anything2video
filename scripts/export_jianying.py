#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""跨平台剪映 / CapCut 原生草稿工程导出器（v5.0.0 新增）

吸收自 video-shotcraft（Jianying Export）与 dashi-animationstyle。
将 anything2video 渲染出的成片视频底轨、旁白语音、BGM、SFX 与词级/句级字幕
原子化打包并导出为剪映原生草稿工程（Mac 沙盒与 Windows 格式双向兼容）。

用法：
  uv run scripts/export_jianying.py <工程目录> [--name <草稿名>] [--out <输出目录>] [--install] [--dry-run]
"""

import argparse
import json
import os
import re
import shutil
import sys
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


def parse_timeline(project_dir: Path) -> list[dict]:
    """解析工程中的字幕条目（优先读 script/timeline.json，其次解析 subs.ts 或 .srt）。"""
    timeline_path = project_dir / "script/timeline.json"
    if timeline_path.is_file():
        try:
            data = json.loads(timeline_path.read_text(encoding="utf-8"))
            sentences = data.get("sentences", [])
            fps = data.get("fps", 30)
            items = []
            for s in sentences:
                start_sec = s.get("start", s.get("start_frame", 0) / fps)
                end_sec = s.get("end", s.get("end_frame", 0) / fps)
                text = s.get("text", "")
                if text and end_sec > start_sec:
                    items.append({
                        "text": text,
                        "start_us": int(start_sec * 1_000_000),
                        "duration_us": int((end_sec - start_sec) * 1_000_000)
                    })
            if items:
                return items
        except Exception:
            pass

    # 后备：从 src/common/subs.ts 抓取字幕文本
    subs_ts = project_dir / "src/common/subs.ts"
    if subs_ts.is_file():
        try:
            content = subs_ts.read_text(encoding="utf-8")
            # 匹配 text: "..." 或 text: '...'
            matches = re.findall(r'text:\s*["\']([^"\']+)["\']', content)
            if matches:
                # 均匀估时后备
                return [{"text": m, "start_us": idx * 3_000_000, "duration_us": 2_800_000}
                        for idx, m in enumerate(matches)]
        except Exception:
            pass

    return []


def build_draft_structure(
    project_dir: Path,
    draft_name: str,
    media_bundle_dir: Path,
    use_clean_video: bool = True
) -> tuple[dict, dict]:
    """生成合规的 draft_info.json 与 draft_meta_info.json 数据字典。"""
    project_json_path = project_dir / "project.json"
    project_info = {}
    if project_json_path.is_file():
        try:
            project_info = json.loads(project_json_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    fps = project_info.get("fps", 30)
    width = project_info.get("width", 1920)
    height = project_info.get("height", 1080)
    total_frames = project_info.get("totalFrames", 900)
    total_duration_us = int((total_frames / fps) * 1_000_000)

    draft_id = str(uuid.uuid4()).upper()
    now_ms = int(time.time() * 1000)

    slug = project_info.get("slug", "")
    # 寻找成片视频与音频
    video_candidates = [
        project_dir / f"renders/{slug}.mp4" if slug else None,
        project_dir / f"renders/{slug}_final.mp4" if slug else None,
        project_dir / f"delivery/{slug}.mp4" if slug else None,
        project_dir / "out/final.mp4",
        project_dir / "delivery/final.mp4",
        project_dir / "renders/video.mp4",
        project_dir / "out/video.mp4",
        project_dir / "video.mp4"
    ]
    video_candidates = [p for p in video_candidates if p is not None]
    # 如果没直接命中，扫描 renders/ 和 delivery/ 目录下的第一个 mp4
    for search_dir in [project_dir / "renders", project_dir / "delivery", project_dir / "out"]:
        if search_dir.is_dir():
            video_candidates.extend(sorted(search_dir.glob("*.mp4")))
    narration_candidates = [
        project_dir / "assets/audio_narration.wav",
        project_dir / "audio/audio_narration.wav",
        project_dir / "audio_narration.wav",
        project_dir / "assets/audio.wav"
    ]
    bgm_candidates = [
        project_dir / "assets/bgm.wav",
        project_dir / "audio/bgm.wav",
        project_dir / "bgm.wav"
    ]

    found_video = next((p for p in video_candidates if p.is_file()), None)
    found_narration = next((p for p in narration_candidates if p.is_file()), None)
    found_bgm = next((p for p in bgm_candidates if p.is_file()), None)

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
        dest_video = media_bundle_dir / found_video.name
        if not dest_video.exists():
            shutil.copy2(found_video, dest_video)

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
        dest_narr = media_bundle_dir / found_narration.name
        if not dest_narr.exists():
            shutil.copy2(found_narration, dest_narr)

        materials["audios"].append({
            "id": narr_id,
            "type": "audio",
            "path": str(dest_narr.resolve()),
            "duration": total_duration_us
        })
        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "audio",
            "segments": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "material_id": narr_id,
                    "target_timerange": {"start": 0, "duration": total_duration_us},
                    "source_timerange": {"start": 0, "duration": total_duration_us},
                    "volume": 1.0
                }
            ]
        })
        meta_materials.append({"id": narr_id, "type": 1, "path": str(dest_narr.resolve())})

    # 3. 背景音乐轨
    if found_bgm:
        bgm_id = str(uuid.uuid4()).upper()
        dest_bgm = media_bundle_dir / found_bgm.name
        if not dest_bgm.exists():
            shutil.copy2(found_bgm, dest_bgm)

        materials["audios"].append({
            "id": bgm_id,
            "type": "audio",
            "path": str(dest_bgm.resolve()),
            "duration": total_duration_us
        })
        tracks.append({
            "id": str(uuid.uuid4()).upper(),
            "type": "audio",
            "segments": [
                {
                    "id": str(uuid.uuid4()).upper(),
                    "material_id": bgm_id,
                    "target_timerange": {"start": 0, "duration": total_duration_us},
                    "source_timerange": {"start": 0, "duration": total_duration_us},
                    "volume": 0.35  # BGM 默认回避压制电平
                }
            ]
        })
        meta_materials.append({"id": bgm_id, "type": 1, "path": str(dest_bgm.resolve())})

    # 4. 可编辑字幕文本轨
    subtitles = parse_timeline(project_dir)
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

    # 组装完整的 draft_info.json (Windows 称 draft_content.json，Mac 兼容两者)
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
    dry_run: bool = False
) -> Path:
    """执行剪映草稿导出主逻辑。"""
    project_dir = project_dir.resolve()
    if not project_dir.is_dir():
        raise FileNotFoundError(f"项目目录不存在: {project_dir}")

    name = draft_name or project_dir.name or "anything2video_project"
    # 清理非法路径字符
    name = re.sub(r'[\\/:*?"<>|]', '_', name)

    if install_to_app:
        target_draft_dir = get_default_draft_root() / name
    elif out_dir:
        target_draft_dir = out_dir.resolve() / name
    else:
        target_draft_dir = project_dir / "delivery/jianying_draft" / name

    if dry_run:
        print(f"[dry-run] 将生成剪映工程: {target_draft_dir}")
        draft_info, draft_meta = build_draft_structure(
            project_dir, name, target_draft_dir / "Resources"
        )
        print(f"[dry-run] 轨道总数: {len(draft_info['tracks'])} | 素材总数: {len(draft_meta['draft_materials'])}")
        return target_draft_dir

    resources_dir = target_draft_dir / "Resources"
    resources_dir.mkdir(parents=True, exist_ok=True)

    draft_info, draft_meta = build_draft_structure(project_dir, name, resources_dir)

    # 写入草稿主数据 (Mac 入口叫 draft_info.json，Windows 叫 draft_content.json，双写互保)
    (target_draft_dir / "draft_info.json").write_text(
        json.dumps(draft_info, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (target_draft_dir / "draft_content.json").write_text(
        json.dumps(draft_info, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (target_draft_dir / "draft_meta_info.json").write_text(
        json.dumps(draft_meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✓ 剪映原生草稿工程成功导出至: {target_draft_dir}")
    print(f"  - 包含轨道: {[t['type'] for t in draft_info['tracks']]}")
    print(f"  - 媒体资源打包于: {resources_dir}")
    if install_to_app:
        print("  - 已安装至剪映草稿库，打开剪映即可在项目列表中直接点开编辑！")

    return target_draft_dir


def main():
    parser = argparse.ArgumentParser(description="导出 anything2video 工程为剪映原生草稿")
    parser.add_argument("project", type=Path, help="anything2video 工程目录")
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
            dry_run=args.dry_run
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
