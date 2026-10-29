# 工具与组件索引（按需）

用于找已有实现，不是开工必读清单。授权、输入/输出证据与验收统一遵守 [production-contract.md](production-contract.md)，执行顺序见 [production-workflow.md](production-workflow.md)。本页不替代脚本帮助或对应专题。版本沿革和上游记录见 [context-index.md](context-index.md)。

## 路径约定

- 下表 `scripts/` 链接是 Skill 根目录工具，运行时用 `<skill>/scripts/...`。
- `template/scripts/` 随初始化复制到工程的 `scripts/`，从工程根运行；不能把工具同名误认为同一目录。
- Python 环境用 uv；带 PEP 723 内联依赖的 Skill 根脚本用 `uv run <skill>/scripts/<名>.py` 脚本模式。工程内音频命令用 `uv run python scripts/<名>.py`。
- 旧 shell/调用接口保留兼容；工程规格和最终证据仍走统一 Node 入口。

## 工程、状态与渲染

首次环境/桌面宿主检查见 [environment-capabilities](environment-capabilities.md) 与 [desktop-hosts](desktop-hosts.md)；原生竖屏的模板接线见 [portrait-wiring](portrait-wiring.md)。

| 任务 | 入口与边界 |
|---|---|
| 初始化、诊断 | [init.mjs](../scripts/init.mjs)、[doctor.mjs](../scripts/doctor.mjs)；包外空目录、能力探测见契约 |
| 续作进度 | [check_state.mjs](../scripts/check_state.mjs)：intake → scripted → approved → voiced → planned → rendered → reviewed → delivered；按磁盘证据计算，overclaim 退出 1，`--write` 同步状态 |
| 计划、静帧、片段、全片 | [check-plan.mjs](../scripts/check-plan.mjs)、[render.mjs](../scripts/render.mjs)；所有模式检查完整计划/素材/类型，Composition 与声明一致 |
| 最终 QC、原子交付 | [check-qc.mjs](../scripts/check-qc.mjs)、[finalize_delivery.mjs](../scripts/finalize_delivery.mjs)；媒体/源码/范围/审核证据绑定，终检不代替实际看听 |
| 可编辑工程 | [export_jianying.py](../scripts/export_jianying.py)：剪映/CapCut 视频、旁白、BGM、字幕轨草稿；支持 Mac/Windows 路径，实际应用打开另验 |
| 渲后辉光 | [bloom_grade.py](../template/scripts/bloom_grade.py)：opt-in 的 bloom/halation 三档；改像素，所以在审片前定稿后照常跑证据链 |

<a id="audio-tools"></a>
## 配音、音乐与音效

| 任务 | 实现 / 详细说明 |
|---|---|
| 音色 A/B | [voice_bakeoff.py](../scripts/voice_bakeoff.py)、[voice-bakeoff.md](voice-bakeoff.md)：同三句代表台词，实际可用端点与试听决定 |
| TTS 与逐字符字幕 | [tts_build.py](../template/scripts/tts_build.py)：产正本、timeline、subs 与 `SubEntry.chars`；edge 实测词边界，估计时间戳须如实标注 |
| 用户自带配音 | [align_narration.py](../template/scripts/align_narration.py)：能量停顿 DP 对齐到句、块内线性铺开，约 ±0.15s 是估计，不手填假精度 |
| 无旁白章表 | [chapter_timeline.py](../template/scripts/chapter_timeline.py)：读 project fps、保留章元数据；声音/无声声明仍走契约 |
| 旁白＋BGM、钉帧 SFX | [mix_audio.py](../template/scripts/mix_audio.py)（如 `--bed 0.055`；沙音显式 `--sfx sand`）、[mix_sfx.py](../template/scripts/mix_sfx.py) 第三步与防双混台账；[声音设计](sound-design.md) |
| 录音曲试听与查询 | [bgm-bakeoff.md](bgm-bakeoff.md)、[bgm-library.md](bgm-library.md)、[bgm_query.py](../scripts/bgm_query.py)：题材×落位功能读逐段档案；可用且许可登记的用户曲优先，缺音源/未确权曲仅作参考 |
| 曲库客观分析与对话标注 | [bgm_analyze.py](../scripts/bgm_analyze.py)、[bgm_review.py](../scripts/bgm_review.py)：能量/分段/入出点/BPM → [checkout 的曲库档案](https://github.com/solplum/anything2video/tree/5f2e5e0e7bd4b392455f9be4e4bb1c050e21c537/assets/audio/bgm/profiles)（未随发行包携带，读取前确认本地存在；入口见 [曲库指南](bgm-library.md)）；试听在页面、标注在对话，不以 HTML 表单代问，候选规范见选曲文档 |
| 多段音乐编排 | [music-plan.md](music-plan.md)：`music_plan.json` schema、接力与许可台账 |
| 显式程序编曲 | [bgm_generate.py](../scripts/bgm_generate.py)、[audio-engine](../audio-engine/README.md)；双通道选择见选曲文档，来源/依赖见 [VENDOR](../audio-engine/VENDOR.md) |
| 拍点、包络与音乐反应 | [beat_grid.py](../template/scripts/beat_grid.py)、[audio_features.py](../template/scripts/audio_features.py)、[common/music.ts](../template/src/common/music.ts)：100fps 归一化包络×5通道、分类 onset 与网格，`createMusic` 提供 env/envPeak/hit/beatAt；真值/约束见 [music-beat-sync.md](music-beat-sync.md) §7 |
| 音效素材与许可 | [checkout 的 SFX 素材目录](https://github.com/solplum/anything2video/tree/5f2e5e0e7bd4b392455f9be4e4bb1c050e21c537/assets/audio/sfx)（未随发行包携带，先确认素材可用）与随包 [ATTRIBUTION](../assets/audio/ATTRIBUTION.md)；风格绑定拟音/in-key SFX 走 audio-engine，按声音设计登记 |

## 参考、生成与专项检查

| 任务 | 实现 / 使用时读取 |
|---|---|
| 对标拆解 | [reference_breakdown.py](../scripts/reference_breakdown.py)、[reference-breakdown.md](reference-breakdown.md)：接触表、节奏网格、热图、参考帧；不证明模型归属 |
| 世界底 / 一帧先行 | [gen_world_frames.py](../template/scripts/gen_world_frames.py)、[ai-frame-sop.md](ai-frame-sop.md)：四路线、首尾同帧图生视频、素材三查 |
| 图生视频停顿分段 | [plan_segments.py](../scripts/plan_segments.py)：真实停顿切分，整数秒只取停顿内，计费秒数/接缝遮罩；见 AI SOP 路线 C |
| 运动连续性 / 字幕带 | [probe_motion_quality.py](../scripts/probe_motion_quality.py)、[probe_subtitle_band.py](../scripts/probe_subtitle_band.py)；合法静止按分镜/beat sheet，命中看实际帧定性 |
| 动作关键窗 | [action_review.py](../scripts/action_review.py)、[action-review.md](action-review.md)：接触/交接/跟踪动作，默认 0.2s 条带＋ROI，真实 PTS/哈希，仍 needs_review |
| 小屏 / 线头闭合 | [probe_readability.mjs](../scripts/probe_readability.mjs)、[readability.md](readability.md)；[probe_line_ends.mjs](../scripts/probe_line_ends.mjs) 适用风格见契约 |
| 音画 / 媒体 | [probe_av_sync.mjs](../template/scripts/probe_av_sync.mjs)、[probe_delivery.py](../template/scripts/probe_delivery.py)；首句探针不证明全片对位或听感 |
| 其他工程探针 | [template/scripts](../template/scripts)：blank/liveness/subject/time/frame_cost/material_substance；先声明 ROI/背景/合法静止，不能无条件外推 |
| 审美与量尺 | [directing-playbook.md](directing-playbook.md)（含逐镜静态审计）、[aesthetic-rules.md](aesthetic-rules.md)、[jury-review.md](jury-review.md)；机器测试不代替实际审查 |

## 动效组件与风格资产

所有既有路径、导入、seed 与风格 ID 保持兼容。风格元数据只认 [catalog](../styles/catalog.json)，完整家族/变体展示在 [samples/index.html](../samples/index.html)，旧 ID 查 [samples/all.html](../samples/all.html)。接线与共享依赖看 [styles/README.md](../styles/README.md)；当前是否运行时皮肤由 catalog 的 `runtimeSkin` 和实际 `STYLE_SKINS` 决定，不在入口重复抄数量。样片只证明已展示内容，非当前宿主端到端或整片认证。

| 能力 | 实现 / 路由 |
|---|---|
| 动效配方卡、参数与参考源码 | [gallery/README.md](../gallery/README.md)、[cards](../gallery/cards)、[demos-ref](../gallery/demos-ref)、[lib-ref](../gallery/lib-ref)；卡数量以目录/索引为准。pdoom 方法论卡没有本仓 demo 时按卡参数实现，来源在卡尾 |
| 基础 2.5D/数字/闪切/滚动 | [common/kit](../template/src/common/kit)：PageCam、DigitRoll、FlashCut、VerticalTicker，lagged/dampedSettle/mulberry32 |
| 演绎结构四件套 | WordLitCaption、ChapterBadge、GoldenQuote、RecapFrame；底料 `SubEntry.chars`，接线见 [explainer](../recipes/explainer.md)，三铁律见导演手册 |
| 共享运动数学、底图语法 | [common/motion](../template/src/common/motion)：hermite/monotone/quantize/smear；[PhotoStage](../template/src/common/kit/PhotoStage.tsx)：Ken Burns 钳制、snap push、freeze-to-card |
| 可变字体、单笔画字体 | [VarText](../template/src/common/kit/VarText.tsx)：varSettings/breatheWght；[StrokeText](../template/src/common/kit/StrokeText.tsx)：光学 kern、writtenLength、笔头坐标，仅拉丁。中文手写按 gallery 的 draw-svg-trace；字体许可分别登记 |
| 精密机械解剖 | [kit/iso](../template/src/common/kit/iso)：math/primitives/lathe/tube/sorter/IsoMachine；`isometric-anatomy` 仍为无随包预览的实验入口 |
| 真实档案与翻拍微距 | [documentary](../recipes/documentary.md)、[RostrumStage](../template/src/common/kit/RostrumStage.tsx)：古籍/图纸/照片舞台、Ken Burns、印鉴/纸纹；真实档案权属台账见契约 |
| 油画与共享依赖 | light-dabs/lily-pond/swirl-oil/scream-warp 复制时同时带 `styles/shared/paint/strokes.ts`，见 [shared README](../styles/shared/README.md) |
| 铜版雕刻 | [engraving 来源与许可](../styles/engraving/UPSTREAM.md)、[可复现例子](../examples/engraving/README.md)；样片是 12 秒无声材质研究 |
| 沙画环境层 | [sand-ambient.tsx](../styles/sand/sand-ambient.tsx)：DustDrift/PetalFall/SandStream/PaperBreath，continuous 场景可选；阅读/情绪停留可真正静止 |
| 宣传/史诗、品牌与材质 | [promo-style-guide](promo-style-guide.md)、[epic-brand-film](epic-brand-film.md)、[brand-assets](brand-assets.md)、[materials](materials.md) |

选中能力后完整读它的专题/SPEC，保留许可与归属，不把本索引当实现或质量认证。
