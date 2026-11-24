# 生产速查清单（v5.1.0）

| 阶段 | 必跑命令 / 产物 | 核心门禁 |
|---|---|---|
| 0. 初始化 | `doctor.mjs` → `init.mjs <绝对路径> <slug>` | 包外空目录；默认 `renderScale: 1.5`；装 `npm ci` + `uv sync` |
| 1. 调研 | `research/creative-brief.md`、`style-ledger.md` | 选定视觉套餐（2D Canvas 16 风格须把 `renderScale` 改回 `1`） |
| 2. 文案 | 对话确认方向与全文 → `script/narration.txt` + `approval.json` | 必须过实际用户；句中用 `{#id}` 锚点、`## swell` 留呼吸停顿 |
| 3. 配音 | `uv run python scripts/tts_build.py`（有 `MINIMAX_API_KEY` 默认 `minimax`） | 同章整块合成 + `voice_fx`（-18 LUFS / ≤-1.0 dBTP）；产 `anchors.ts` |
| 4. 配乐 | `mix_audio.py`（默认 `--bed-lu -1.5` + `--music-fit auto`） | 相对响度 `-1.5` LU（保守 `-5.0`）；混音读正本 `audio_narration.wav` |
| 5. 分镜/镜头 | `at()`/`span()`/`local()` 引用 `anchors.ts`；高速层可选 `FastMoveBlur` | 禁抄字面量帧号（`check-plan.mjs` 警告）；事实绑 `claims` |
| 6. 渲染/对位 | `check-plan.mjs` → `render.mjs preview/stills/video` | 迭代可用 `A2V_SCALE=1 A2V_BUNDLE_CACHE=1`；正式关缓存按 `1.5×` |
| 7. 审片 | `semantic-sync-pack.mjs` + `review-pack.mjs` + A/B/C/D 四轮 | 实看 `qc/semantic-sync/index.md`；独立评委出 `qc/jury.json`（全 ≥7） |
| 8. 交付 | `check-qc.mjs` → `finalize_delivery.mjs <工程> <mp4>` | `status='production'` 重渲；`master/share` 重测响度与解码后落 `delivery/` |
