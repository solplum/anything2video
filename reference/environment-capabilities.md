# 统一环境能力面与宿主适配指南

> **核心原则**：全平台统一采用单一 Skill 身份 `anything2video`。公共制作核心（剧本门禁、分镜、Remotion 代码动画、音频引擎、样式库、样片池与 QC 验收合同）在所有宿主中完全一致；宿主之间的差异**不是不同的 Skill 包，而是运行时能力（Runtime Capabilities）的异构**。

---

## 1. 运行时能力模型 (Runtime Capabilities)

任何 Agent 宿主（Antigravity、Claude Code、Codex、Cursor、MiniMax Code、WorkBuddy、豆包工作、ZCode 等）加载 `anything2video` 时，其能达到的出片完整度取决于以下 6 维实际能力，而非包名或静态配置：

```
┌─────────────────────────────────────────────────────────────┐
│                    anything2video 统一核心                  │
│   (SKILL.md + recipes + gallery + styles + template + qc)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ 动态探测 (scripts/doctor.mjs)
                               ▼
┌───────────────────┬───────────────────┬───────────────────┐
│  ① 执行与命令通道 │  ② 视觉与多模态   │  ③ 素材生成通道   │
│  (Shell / CLI)    │  (Frame Inspect)  │  (Image / Video)  │
├───────────────────┼───────────────────┼───────────────────┤
│  ④ 代理与并行机制 │  ⑤ 浏览器与渲染   │  ⑥ 上下文与记忆   │
│  (Task / Worker)  │  (Remotion / Head)│  (Context Window) │
└───────────────────┴───────────────────┴───────────────────┘
```

### 1.1 ① 执行与命令通道 (Shell / CLI)
- **完整制片能力**：具备本地 Bash/Shell 执行权，能运行 `node`、`uv`、`ffmpeg`、`ffprobe`。可完成全链渲染、音频合成、混音与探针检测。
- **只读 / 无命令降级**：沙箱或纯对话环境无法执行本地命令时，**自动降级为编剧与分镜模式**：输出文案候选、定稿脚本、逐镜分镜表与代码建议，**严禁声称已渲染出成片 MP4**。
- **开工前验证**：新环境接入时，要求助手执行 `node --version`、`uv --version` 并回显真实输出，作为执行力基线。

### 1.2 ② 视觉与多模态审片通道 (Visual & Multimodal Inspection)
- **多模态直检**：具备图像/视频输入能力的模型（如 Claude 3.5/3.7、MiniMax M3.1、GPT-4o 等），可直接读取抽取的 stills 关键帧（`stills/frame-*.png`）与成片片段进行 B 轮视觉因果与 C 轮反向审查。
- **探针数字先行**：多模态目检不能免除工程探针。A 轮必须以客观数字为准（`probe_motion_quality.py`、`probe_subtitle_band.py`、`finalize_delivery.mjs` 冻帧检测）；数字是线索，模型目检定性，两道记录均须落盘于 `qc/`。
- **D 轮 Jury 独立性**：D 轮独立打分要求独立会话。若宿主仅能通过子代理（共享主控上下文）评审，必须如实记录降级情况，严禁将内部子代理打分伪造成独立评审。

### 1.3 ③ 素材生成通道 (Image & Video Generation Channels)
- **统一通道判定**：
  1. 环境变量 `A2V_IMAGE_API_BASE`、`A2V_IMAGE_API_KEY`、`A2V_IMAGE_MODEL`（加可选 `A2V_IMAGE_PROVIDER`）为第一判据。
  2. 首用决定文件 `~/.anything2video/image-channel` 记录所选 provider（`openai` / `minimax` / `none`）。
  3. 通过 `node <skill>/scripts/doctor.mjs` 报告通道状态。
- **宿主内置通道纪律**（WorkBuddy / 豆包工作 / MiniMax Code 等）：
  - 若宿主界面或内置工具提供生图/生视频通道，产物落盘后按 `reference/ai-frame-sop.md` §5 严格登记来源、提示词与许可。
  - **绝不绕过确定性渲染**：AI 生成内容仅承担 5%–10% 的材质/世界底/氛围职责，所有文字、数据、架构与核心事实永远由 TSX 代码绘制。
  - 视频生成（如 H3 Max 类模型）严格遵循首尾同帧、镜头固定、无运动漂移三铁律（ai-frame-sop §2.5）。

### 1.4 ④ 代理与并行建组机制 (Subagents & Task Concurrency)
- **存在子代理**（如 MiniMax worker/verifier、Claude Code subagents、Antigravity subagents）：
  - 仅对独立文件所有权的镜头组做并行建组；
  - 派单需附全部分镜、共享 API、帧号规则、配方卡路径；
  - verifier 适合承担 B/C 轮独立复核，worker 仅提交代码与测试。
- **无子代理**：顺序完成各镜头组，质量标准绝不降级。

### 1.5 ⑤ 浏览器与渲染环境 (Headless Browser & Remotion)
- **Remotion 浏览器配置**：在部分国内网络环境下 `npx remotion browser ensure` 可能会遇到下载停滞。统一方案：设置环境变量 `BROWSER_EXECUTABLE` 指向本机 Chrome 或 Edge（如 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` 或 Windows 对应路径），`scripts/render.mjs` 原生支持直接调用，彻底避免被 ensure 卡住。

### 1.6 ⑥ 上下文现实与磁盘纪律 (Context & Memory Discipline)
- **大上下文（512k/1M）的正确用法**：大上下文用于保持统一合同、配方 SPEC、风格台账常驻；但**大 JSON、分镜表、TSX 源码必须落盘传路径**，严禁在 Prompt 中来回往返冗长文本。
- **小步提交与高频验证**：对于推理一致性偏弱或易截断的模型，严格缩小自由度——照 `gallery/cards/` 抽卡对标，每组镜头完成即执行 `npm run typecheck` 与局部渲染，每阶段跑 `node <skill>/scripts/check_state.mjs <工程>` 核对七态证据（稿件授权另按生产契约人工检查；无旁白路线不能只凭此阶梯判断进度）。

---

## 2. 常见宿主发现路径与安装对应

统一包 `anything2video` 支持标准化的发现路径，各宿主开箱即用：

| 宿主环境 | 推荐安装命令 | 标准发现路径 | 发现机制与注意点 |
| :--- | :--- | :--- | :--- |
| **通用 / Codex / Antigravity / Cursor** | `node scripts/install.mjs` | `~/.agents/skills/anything2video` | 标准全局技能目录，新开会话自动加载 |
| **Claude Code** | `node scripts/install.mjs --claude` | `~/.claude/skills/anything2video` | 用户级全局，或加 `[工程路径]` 装入 `.claude/skills/` |
| **WorkBuddy (桌面版)** | `node scripts/install.mjs --workbuddy` | `~/.workbuddy/skills/anything2video` | 本机实证本地目录，重启后技能列表呈现 |
| **MiniMax Code (桌面版)** | `node scripts/install.mjs --minimax` | `~/.minimax/skills/anything2video` | 或 `--data-dir <真实DATA_DIR>`，下一会话生效 |
| **豆包工作 (桌面版)** | `node scripts/install.mjs --export-dir <导出目录>` | 导出独立目录供显式授权 | 工作模式开启电脑操作，在任务中授权该目录 |
| **ZCode** | `node scripts/install.mjs` | `~/.agents/skills/anything2video` | 支持普通 headless `zcode -p`，工作流 API 按需探测 |
| **本地开发软链** | `node scripts/install.mjs --symlink [--claude/--workbuddy]` | 软链目标路径 | 开发调试推荐，改动即时生效 |

---

## 3. 首次接入检查清单 (Checklist)

无论是哪个 Agent 宿主，新工程或新会话请先按以下 5 步核验真实能力，并将结果记录到工程 `research/`：

1. **核验加载路径**：确认当前会话实际读取的 `anything2video` 绝对路径与声明版本一致（如 v5.0.0）。
2. **运行环境诊断**：执行 `node <skill>/scripts/doctor.mjs`，核验 Node、uv、ffmpeg、ffprobe 及生图通道。
3. **视觉多模态摸底**：抽取一帧已知图像测试模型是否真能看清细节，决定审片是否启用多模态目检。
4. **渲染浏览器确认**：确认 `npx remotion browser ensure` 或指定 `BROWSER_EXECUTABLE` 可正常出图（`stills` 模式试渲第 1 帧）。
5. **代理与任务分工**：核验工具表中是否存在子代理派单工具，决定多镜头组是并行还是顺序构建。
