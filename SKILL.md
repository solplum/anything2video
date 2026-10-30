---
name: anything2video
description: Create original teaching videos, explainers, promotional films and brand films from a topic, article or product. Produce researched narration with a two-stage user-approved script gate, shot plans, deterministic Remotion animation, licensed or disclosed generated assets, audio, rendered video and measured quality evidence. Works across all modern agent harnesses (Antigravity, Codex, Claude Code, Cursor, WorkBuddy, etc.).
version: "5.0.0"
author: "solplum"
metadata:
  version: "5.0.0"
  category: video-generation
  descriptions:
    zh-Hans: "在任意 Agent 环境中从主题、文章或产品制作原创教学、科普、宣传与品牌视频：调研、文案确认门（方向候选→全文定稿过用户）、分镜、代码动画、配音音乐、三轮验收加 jury 评分与交付终检。"
    en: "Create original teaching, explainer, promo and brand videos inside any modern agent harness: research, two-stage user-approved script gate, storyboards, Remotion animation, voiceover/music, three-round review plus jury scoring and gated delivery."
  displayNames:
    zh-Hans: "anything2video"
    en: "anything2video"
---

# anything2video

把主题、文章或产品做成可复现、可验收的原创视频：教学、科普、宣传、品牌与档案纪录片。以代码动画/合成为主，可加入可追溯、经审核的素材；不主攻复制影片、实拍采访或真人口播剪辑，不承诺模型等价或一次成精品。

## 入口与权威

1. 制作/续作先完整读 [统一生产契约](reference/production-contract.md) 与 [生产流程](reference/production-workflow.md)。**共享授权、工程与验收只由契约定义**；入口负责路由、流程安排顺序。既有明确授权按契约记录，不重复等待。
2. 按套餐读一个配方：[宣传](recipes/promo.md)、[讲解](recipes/explainer.md)、[史诗](recipes/epic.md)、[纪录片](recipes/documentary.md)；自由组合读 [custom](recipes/custom.md)。完整风格库与旧 ID 保留。core 可能只有静态 poster；运动比较按 [资源配置](docs/package-profiles.md#optional-sample-videos) 取样片，不能把看图称为播放。
3. 分镜前读 [导演手册](reference/directing-playbook.md)；其余按需加载，不默认全读历史/上游。

## 不可略过的提醒

- 文案默认先讨论方向、再由实际用户确认全文；**泛化“自行决策/不计成本”不是稿件授权**。已明确的稿件级授权、用户自带稿、续作哈希与变更处理，都按 [文案确认门](reference/production-contract.md#script-approval) 执行；不擅改已批准旁白。
- 精确文字、数字、图解由代码承载；事实与资产均须可追溯。参考片只借方法，不拿其帧或片段拼成原创片。生成素材须登记和实查，不能把混合合成称为纯代码或免版权。
- 动画由帧号与固定 seed 决定；镜头合同 1 起含端点、Remotion 0 起，只转换一次。清单、类型检查都不证明镜头真实挂载。
- `audio_narration.wav` 是清洁正本，`audio.wav` 是派生混音；不得用 mtime 猜来源、把混音回灌正本或未经授权更新旁白。
- 探针只证明所测项。真实运动片段、整片播放与完整听取不能由截图、测试或日志代替；未做就是 `not_performed`，阻塞未清零不交最终版。
- 尊重用户已选画幅、风格、许可和发布范围。平台会变化，格式与发布口径只查契约的 [画幅与发布](reference/production-contract.md#publication)，不把历史平台记录当当期政策，也不顺带发布。

## 按任务加载

| 当前需要 | 读取入口 |
|---|---|
| 首次安装、宿主或执行能力不明 | [环境能力](reference/environment-capabilities.md)、[适配与安装](docs/adapters.md)；实测后选择并行或顺序，不凭宿主名假定能力 |
| 选套餐/沿用风格 | 契约 [选型与持久决策](reference/production-contract.md#selection)、[风格台账](reference/style-ledger.md)、[完整选择页](samples/index.html)；元数据唯一来源 [catalog](styles/catalog.json)，接线读 [styles](styles/README.md) 与所选 SPEC |
| 文化、历史、文学、诗词、神话或科普事实调研 | [语料注册表](reference/corpus-sources.md)：候选前轻摸底、定稿前重核对；现代产品/软件教程走官方资料 |
| 有对标片/需材质或生成画面 | [参考片拆解](reference/reference-breakdown.md)、[材质](reference/materials.md)、[AI 一帧先行 SOP](reference/ai-frame-sop.md)；排 AI 镜头前核实通道 |
| 动作、词/拍落点、停留或切换 | [运动语言](reference/motion-language.md)、[事件编排](reference/cue-choreography.md)、[gallery](gallery/README.md)；选卡后读参数/判例 |
| 可选匹配剪辑＋节拍接力 | [剪辑模式](reference/match-cut-beat-relay.md)；独立于画风/配方，仅作用于声明的接力切点 |
| 音色、选曲、声音制作 | [音色试听](reference/voice-bakeoff.md)、[选曲试听](reference/bgm-bakeoff.md)、[音乐编排](reference/music-plan.md)、[音乐卡点](reference/music-beat-sync.md)、[声音设计](reference/sound-design.md)；只读当前通道 |
| 打样、派单、专项验收 | [视觉方向](reference/visual-direction.md)、[派单协议](reference/workflow-orchestration.md)、[动作复核](reference/action-review.md)、[小屏可读性](reference/readability.md)、[独立评分](reference/jury-review.md) |
| 找命令、组件、兼容接口或导出路线 | [工具与组件索引](reference/tools-and-components.md)；不需要时不读 |
| 查历史返工、上游实现或回写经验 | [上下文资料索引](reference/context-index.md)；历史是解释与复验线索，不是第二套生产规则 |

## 从这里继续

续作运行 `node <skill>/scripts/check_state.mjs <工程>`，据磁盘证据继续，不重建。新工程按流程第 0 步确定包外目录并运行 `doctor` / `init`。产物留工程内，验证过的资产/经验才回写 Skill。打包/发现成功不等于宿主端到端作片；纯聊天不能凭空渲染 MP4。
