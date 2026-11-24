# anything2video v5.1.0 优化说明

## 改动摘要

1. **配音清晰度与自然韵律（MiniMax + voice_fx + semantic anchors）**
   - `template/scripts/narration_lib.py`：抽取 `narration.py` 共享解析/对齐/工件生成，支持句中 `{#id}` 锚点与 `## swell`（=42 帧），生成 `src/common/anchors.ts`（区分 `measured` / `estimated`），配套 `template/src/common/anchor.ts`（`at()`/`span()`/`local()`/`secOf()`）。
   - `template/scripts/tts_build.py`：`TTS_ENGINE=auto` 在设置 `MINIMAX_API_KEY` 时默认启用 `minimax`（`speech-2.6-hd`，同章无显式间隔连续句 ≤1500 字整块调用 `/v1/t2a_v2`，44.1kHz FLAC + `subtitle_file` 词级切句，无词匹配自动退回停顿 DP 对齐；文本发送至 MiniMax 云端并按字符计费）。
   - `template/scripts/voice_fx.py`：`tts_build` 默认启用 `VOICE_FX=on`（80Hz HPF → -20dBFS 2.5:1 RMS 压缩 → 5-9kHz 齿音抑制 → `-18 LUFS` 立体声综合响度归一 → `-1.5 dBFS` 4× 过采样真峰值限幅 `≤-1.0 dBTP`）；`align_narration.py` 默认 `off` 可按需开启。
2. **背景音乐响度平衡与节拍匹配（mix_audio + music_fit）**
   - `template/scripts/mix_audio.py`：非 epic 模式缺省走相对响度床 `--bed-lu -1.5`（参考片实测旁白 `-18.12 LUFS`，Mixkit `tapis-615` `-1.14 LU` 与 `vertigo-597` `-1.69 LU` @ RMS `0.08` 均值取整得 `-1.5` LU，保守档 `-5.0` LU）；显式 `--bed` 保留绝对 RMS 口径。
   - `template/scripts/music_fit.py`：单曲 `--music-fit auto` 调 `beat_grid.analyze`，在置信 `≥ CONF_MIN` 且 `≥ 8` 重拍时执行 1 拍等功率 crossfade 的头尾拼剪或整小节循环，并保留原曲自然尾音（仅 1.5s 淡入）；弱节拍环境曲（如 Mixkit `tapis-615`）诚实回退传统循环淡入淡出。
3. **画面锐度与生成速度**
   - `scripts/init.mjs` + `scripts/render.mjs` + `scripts/check-qc.mjs`：新工程默认 `renderScale: 1.5`（1280×720 → 1920×1080 终渲，preview/stills 保持 1×，QC 与 sidecar 按缩放维度校验）；默认并发改为 `max(1, min(6, floor(cpus/2)))`；支持 `A2V_GL` 与 `A2V_BUNDLE_CACHE`（默认 `0` 关闭）。
   - `template/src/common/kit/FastMoveBlur.tsx`：基于 `@remotion/motion-blur@4.0.507`（默认 `samples=6`）的高速层动态模糊包装。
4. **声画同步检查与精简清单**
   - `scripts/semantic-sync-pack.mjs`：批抽句中点与 `{#id}` 锚点帧生成 `qc/semantic-sync/index.md` 对照表。
   - 新增 `reference/speed-and-quality.md` 与 `reference/quick-checklist.md`，收紧入口文档字数守住 40,000B 预算。

## 实测结果与未接入边界

- 外部 e2e（`/Users/sol/workspace/a2v-e2e`）：MiniMax 整块合成 + `voice_fx` 实测 `-18.0 LUFS`、`tp_out <= -1.0 dBTP`、终渲成片 `1920x1080`、速调 `--force` 重渲后锚点帧随语速自动重排。
- **未接入 AI 生成配乐**：实测 MiniMax `/v1/music_generation`（`music-2.0` / `music-1.5`）对新用户返回 HTTP 410 `status_code=2153`，已于 `reference/bgm-bakeoff.md` 记录为未接入，沿用 Mixkit/用户实录曲与显式程序编曲备选。
- **未放开 2D `<canvas>` 超采样**：`styles/*/Scene.tsx` 中 16 个含固定像素/像素读取画布的风格维持 `renderScale: 1`。
