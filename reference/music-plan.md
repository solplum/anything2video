# 音乐编排表（Music Plan）

> 2026-10-11 定案（grilling 总定案）：BGM 从「单曲+从头开始」升级为**主题索引驱动的多段编排**——
> 入库时逐曲逐段打双轴标签（题材×功能，见 `bgm-library.md` 使用约定 4），做片时按「视频题材+落位」
> 反查命中（`scripts/bgm_query.py`），出本编排表过用户拍板，`mix_audio.py` 消费渲染。单曲 `bgm.wav`
> 模式永久向后兼容。工程落点：`public/assets/<slug>/music_plan.json`。

## 流程位置

分镜定稿（beat sheet 出炉）后、贴片混音前：

1. **反查提名**：按片子的题材（1–2 个）+ 每个落位的功能（钩子/垫底/hero/收尾）跑 `bgm_query.py`；
   用户曲库（`by=user`）命中必占首选，曲池曲/程序编曲作补充位，无命中不硬凑。
2. **出编排表**：主控按 beat sheet 把命中段落填成 `music_plan.json`（schema 见下）——切点尽量落在
   曲内段落边界（档案 `segments`）与 bar 边界（`script/beat_grid.json` 的 downbeats），切点提前 2 帧
   （≈0.067s@30fps）落拍感知更紧（mvd 实证规则）。
3. **过用户拍板**：编排表随贴片候选一起给用户（每段一句话 rationale），可改可换曲；拍板后落盘。
4. **混音**：`uv run python scripts/mix_audio.py` 自动检测编排表优先消费；校验 fail fast。

## Schema（v1）

```json
{
  "schema_version": 1,
  "cues": [
    {
      "track": "singal.wav",
      "track_in": 17.4,
      "track_out": 29.6,
      "timeline_start": 21.0,
      "timeline_end": 33.2,
      "crossfade_in": 1.2,
      "fade_in": 0.3,
      "fade_out": 0.8,
      "section": "hero",
      "rationale": "singal 高能段对位产品揭幕（beat sheet hero 60-75% 落位）"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `track` | ✓ | 音轨文件名。解析顺序：工程 `public/assets/<slug>/` → skill 曲库 `assets/audio/bgm/` → 绝对路径 |
| `track_in` / `track_out` | ✓ | 曲内入/出点（秒）。**时长必须与落位一致**（容差 0.05s）；出点不得超曲长 |
| `timeline_start` | ✓ | 视频落位起点（秒） |
| `timeline_end` |  | 落位终点；缺省自动 = start + (track_out − track_in) |
| `crossfade_in` |  | 与**前一段**的重叠交叉淡化时长（秒）。与前段重叠时**必须覆盖重叠区**（硬校验），等功率曲线 |
| `fade_in` / `fade_out` |  | 段内淡入/淡出（默认 0）；首末段进场/离场用，crossfade 区自然叠加 |
| `section` |  | 功能标注（钩子/垫底/hero/收尾），来自档案 func，记录用 |
| `rationale` |  | 一句话理由，给用户拍板看 |

## 硬校验（mix_audio fail fast）

1. `cues` 非空；每 cue 必填 `track/track_in/track_out/timeline_start`。
2. `0 ≤ track_in < track_out`；`track_out ≤ 曲长 + 0.05s`。
3. 落位时长 = 曲内时长（±0.05s）；落位不越片长（+0.1s 容差）。
4. `timeline_start` 非降序（乱序报错）；**相邻段允许留空隙**（空隙=无音乐，交给旁白/SFX）。
5. 与前段重叠时 `crossfade_in` 必须覆盖重叠量，否则报错。
6. 每段**段级 RMS 归一到响度床**（--bed），跨曲响度一致；旁白 duck 照旧作用于整条音乐轨。

## 纪律

- **用户拍板不可跳过**：编排表是创作决策（同 bakeoff 圈选地位），只改数字不算改曲，换曲/换段必须用户确认。
- **程序编曲单文件也可进编排表**：`bgm_generate.py` 产物（wav）落工程内，作为 cue 的 track——
  编排表天然统一两通道；程序编曲的段切点以 beat sheet 为合同（轴 B 定案），曲库曲以 beat_grid 实测为真值。
- **换轨证据链**：编排表改动会改变成片与 mix.json（`music_plan_sha256`/`music_tracks` 登记），
  交付/ QC 不能沿用旧证据，按统一合同重新走最终门。
- 词表冻结：题材/功能轴受控词见 `bgm-library.md` 使用约定 4；新词先扩词表再标注。
