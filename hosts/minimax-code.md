---
name: anything2video-minimax-code
description: Produce original teaching, explainer, promo and brand videos inside MiniMax Code: researched narration with the two-stage user-approved script gate, storyboards, deterministic Remotion animation, voiceover, three-round review plus jury scoring and gated delivery. MiniMax Code 专属能力面：多模态看片、mcode-tools 生成通道（含 H3 Max 类视频模型纪律）、子代理并行建组、1M 上下文与 Flash 档模型现实。Use for original video production in MiniMax Code.
metadata:
  version: "4.3.0"
descriptions:
  zh-Hans: "MiniMax Code 专属版：在 MiniMax Code 中把主题、文章或产品做成原创教学、科普、宣传、品牌视频——调研、文案确认门（方向候选→全文定稿过用户）、分镜、Remotion 代码动画、配音音乐、三轮验收加 jury 评分与交付终检；并附本宿主专属能力面（多模态看片、mcode-tools 生图与 H3 Max 类视频通道、worker/verifier 子代理并行建组、1M 上下文读档策略与 Flash 档模型对策）。"
displayNames:
  zh-Hans: "anything2video（MiniMax Code 专属版）"
---

构建期宿主身份定义：本文件 frontmatter 承载发布身份与发现描述（含 MiniMax Code 内置惯例的 descriptions/displayNames 本地化字段）；专属包入口正文 = 本 frontmatter + 共享 `SKILL.md` 正文 + `<!-- host-chapter -->` 标记之后的宿主专属章（构建时由 `scripts/build-editions.mjs` 的 composeEntry 拼合；无标记的宿主文件产物不受影响）。宿主加载方式、执行边界与验证等级见 `docs/adapters.md`。

<!-- host-chapter -->

## MiniMax Code 能力面（专属附章，2026-10-11 本机基线）

本包 = 共享核心 v4.3.0 + 本章。本章只在本宿主生效，只回答"在 MiniMax Code 里怎么做到"；工程、许可、验收与授权规则一律以共享合同（`reference/production-contract.md`）为准，本章与之冲突时合同赢。基线来自本机实测，当版应用行为有变时以实测为准重核本章。

### 模型与上下文现实

- 本机默认 `MiniMax-M3.1-Flash-Preview`（M Plan 订阅口径）：输入 text+image+video；thinking 恒开（adaptive，不可关闭）；effort 分 default/low/medium/high/xhigh/max（本机已配 max）；输出上限 128k tokens；上下文 512k 起步、本机已切 1M 档。开工前用一次环境快照确认当版默认模型、上下文档位与 effort，不按记忆假定。
- Flash 档的现实与对策：复杂 TSX 镜头的代码一致性弱于旗舰模型（社区同口径：性价比与速度强、质量天花板低于 Claude 第一梯队）。对策不是降低标准而是缩小自由度——严格照 `gallery/cards/` 卡参数表与判例执行（卡赢为默认）、镜头更小步提交（每组完成即 typecheck + 局部渲染）、每个阶段跑 `node <skill>/scripts/check_state.mjs <工程>`；遇复杂运动优先换更贴近的卡，不现场发明动效。
- 1M 上下文用于"读得全"：统一合同、所选配方、所选卡 SPEC、风格台账可常驻会话。但派单与落盘纪律照旧：大 JSON/分镜表落盘传路径，不在 prompt 里往返（合同铁律不因上下文大而豁免）；输出 128k 上限意味着整章 TSX 别指望一次写完，按组分文件落盘。

### 多模态看片（三轮验收与 jury 的宿主通道）

- 模型可读图与视频（当版口径：单轮附件上限 4 个、单图 10MB、单视频 50MB，`/v1/files/upload` 大文件走 files API）。实际工具面（读图工具、附件传入方式）以当前会话工具表为准：先拿一帧已知内容的图实测"真能看到"再用于审片。2026-10-11 实测通过：模型正确读出 AI 素材帧的墨核形态、羽状分叉与"绿幕非纯平涂"细节，并据此修正了抠像路线——读图审片分工可按本节执行。
- 分工映射：A 轮工程真实性以探针数字为先（`probe_motion_quality.py`、`probe_av_sync`、`probe_subtitle_band.py`、finalize_delivery 的黑帧冻帧计数）；B/C 轮真实片段目检与 D 轮 jury 七维评分可用本宿主多模态直接看帧/看片段完成。无论谁看，证据照旧落盘（`qc/round-N.md`、`qc/jury.json`、帧截图路径+哈希）——会话里看过但磁盘无痕不算审过。
- 探针不可省：能看图不等于探针豁免。数字是线索、目检做定性，两道都留记录；合法静止仍按 beat sheet 豁免登记定性。
- D 轮 jury 要求独立评审：本宿主用 task 子代理当评委时，先按 `reference/jury-review.md` 核对独立性要求是否满足（子代理共享主控上下文则不算独立会话），不满足就如实降级记录，不得把子代理评分包装成独立会话评审。

### 生成通道：mcode-tools（生图与 H3 Max 类视频）

- `mcode-tools` 现状（2026-10-11 首次宿主级实测）：CLI 未进 Bash 工具 PATH；找到 app 内置 cli.mjs 直跑报 `MCODE_AUTH_BROKER_ENDPOINT`/`MCODE_AUTH_BROKER_CAPABILITY_FILE` 未注入，`tool_search` 按需注册表为空——**broker 鉴权环境变量当版不注入 Bash，connector 目录读不到，且不得绕过鉴权**。因此 image/video/music 三类目录与 H3 暴露形态在当版不可确认，路线 C 暂无可用通道。能力发现仍以实测为准：未来版本若能在会话内跑通 `mcode-tools connector tools -k image|-k video|-k music`，生成类调用 bash timeout 给足 600，上传/取回用 `upload_temp_url`/`get_asset_url`。
- 能力门照统一合同：分镜排 AI 镜头前，doctor `imageChannel` 报告或宿主实测产物二者有其一。**mcode-tools 不可用 ≠ 没有生成能力**：本机 `A2V_IMAGE_*` 环境变量 + `doctor.mjs imageChannel` 才是生图通道的第一判据（2026-10-11 实测 `gen_ink_layer.py → minimax image-01 → 1280×720` 走通，生成→验真两查→登记全链通过，路线 B 成立）。provider 决定记入 `~/.anything2video/image-channel` 供 doctor 汇报；凭据只从环境变量读取，不落盘、不写进工程。
- 生图：prompt 照 `reference/ai-frame-sop.md` §2 模板；路线 B 绿幕素材保留原画面坐标；生成验真两查（输出目录新增文件数=出图数；PNG info 无 ImageMagick `date:create`）。
- 生视频（桌面端官方定位含视频生成，H3 Max 一代；实际可用模型与参数以 connector 目录暴露为准，不按产品名假定）：路线 C 首尾同帧纪律照 ai-frame-sop §2.5 全套——①镜头完全固定，不推拉摇；②全程构图/画风/配色不漂、不增删物体、不出新文字；③逐条列"什么在动、怎么动"。先 5 秒短条试跑取最好片段，实际 fps/时长/裁切实测；生成计费与时长预算属关键决策点，先与用户确认口径。
- 内置生成通道不绕过确定性渲染与 QC（与豆包/WorkBuddy 同口径）：AI 素材只承担 ai-frame-sop §1 分工表里的材质/世界底职责（约占画面 5–10%），精确信息永远由代码画；产物按 §5 登记表逐条登记 model/prompt/seed 或 n/a/reference/三查/披露。

### 子代理与并行建组（共享流程 §5 的宿主映射）

- 本宿主内置代理：mavis 主控（delegation 开）、worker（read/write/edit/bash/grep/glob，有界生产者）、verifier（怀疑式独立复核）、explore。主控 `task` 派单、`task_output` 收结果；代理名与工具以当前会话工具表实际提供为准（合同铁律：只在真实存在时使用，不伪造）。
- 派单书照 production-workflow §5 全件：全部分镜、共享 API、全局/本地帧号换算、边界禁令、验证命令、各镜头所抽卡路径；仅独立文件所有权的组并行，其余顺序做、质量不降级。verifier 适合承担 B/C 轮独立复核；worker 只交回镜头 ID、源码、测试与未完成项，主控整合。

### 权限、skills 机制与运行面

- 本机 permissionMode=bypassPermissions：渲染、依赖安装、长命令不被确认打断；吞吐更高、护栏更少——check-plan、typecheck、三轮验收、check-qc 一项不得少，bypass 不等于免检。
- Skills 无 CLI：本包装于 `~/.minimax/skills/anything2video-minimax-code/`，更新后**下一会话生效**；用 `skill({name: "anything2video-minimax-code"})` 核对 Location。持久决策（工作根、image-channel、风格台账）以磁盘文件为准，不靠会话记忆转述。
- 不发明 headless 入口：开源 mcode CLI 是独立产品线，与桌面端会话行为不互证；无 `minimax -p` 这类桌面端用法（adapters.md 明令）。跨会话续作靠 `check_state.mjs` 从磁盘证据算进度与待办，不靠"上个会话记得"；八态阶梯含 approved 文案确认门，改稿哈希对账自动复位。
- 渲染浏览器：`npx remotion browser ensure` 在本机网络下可能长期停滞（2026-10-11 实测约 15 分钟近乎 0 下载）。直接设 `BROWSER_EXECUTABLE` 指向本机 Chrome/Edge——`render.mjs` 原生支持该变量，`selectComposition`/`renderStill`/`renderMedia` 全部走通；别先卡在 ensure 上。

### 首次接入核对清单（新会话先过一遍，结果记入工程 `research/`）

1. `skill({name: "anything2video-minimax-code"})` 返回本包 Location，核对指向 `~/.minimax/skills/anything2video-minimax-code/`。
2. `node --version`、`uv --version`、`ffmpeg -version`、`ffprobe -version` 贴原始输出；工程内跑 `node <skill>/scripts/doctor.mjs` 出环境与图像通道报告。
3. 读图实测：抽一帧已知内容的图确认模型真能看到内容（不是只拿到文件路径），再决定审片分工。
4. 生成通道判定：先查 `node <skill>/scripts/doctor.mjs` 与 `A2V_IMAGE_*` 环境变量（本机已实证可用的生图第一判据）；`mcode-tools connector tools` 能跑通就加测 image/video/music 三类目录并试跑最小图，跑不通（当版已知 broker 未注入 Bash）**不要据此断定宿主无生图能力**。走通"生成→验真两查→登记"链路后再排 AI 镜头。
5. `task` 工具核对：确认 worker 派单链路真实存在，再决定 §5 并行建组还是顺序执行。
