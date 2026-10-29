# 全平台统一 Harness 架构与宿主适配指南

> **架构收束说明**：自 v5.0.0 起，项目全面放弃旧版的“六端独立发行包分立构建（`hosts/` + `edition.json`）”模式，收束为**全平台统一的单包架构**。所有宿主环境统一发现并运行名为 `anything2video` 的规范 Skill。

同一包提供完整的 `SKILL.md`、`recipes`、`reference`、`styles`、`template`、`scripts`、`gallery`、`audio-engine` 与样片目录。可选 `--profile core` 仅不复制样片 MP4，完整画廊/缩略图/来源记录仍在；`--profile full` 保留样片媒体，仓库旧命令默认仍为 full，详见[安装配置](package-profiles.md)。公共制作核心（事实、素材、音频、分镜、动效卡与 QC 交付合同）完全一致；宿主差异仅体现在加载路径与运行时能力（CLI/Shell 权限、多模态看片、生图通道与子代理分工），详见 [`reference/environment-capabilities.md`](../reference/environment-capabilities.md)。

---

## 1. 统一安装命令

从仓库根目录直接运行通用安装器 `scripts/install.mjs`：

```bash
# 1. 默认/通用安装：安装至 ~/.agents/skills/anything2video（支持 Codex、Antigravity、Cursor、OpenClaw 等）
node scripts/install.mjs

# 2. Claude Code：安装至 ~/.claude/skills/anything2video
node scripts/install.mjs --claude
# 也可指定项目级路径（安装至 <工程>/.claude/skills/anything2video）
node scripts/install.mjs --claude /path/to/my-project

# 3. WorkBuddy 桌面端：安装至 ~/.workbuddy/skills/anything2video
node scripts/install.mjs --workbuddy

# 4. MiniMax Code 桌面端：安装至 ~/.minimax/skills/anything2video
node scripts/install.mjs --minimax
# 若使用自定义 App Data 目录：
node scripts/install.mjs --minimax --data-dir /path/to/minimax/data

# 5. 导出独立完整包（用于豆包工作等无自动发现目录的宿主手动授权导入）
node scripts/install.mjs --export-dir /path/to/export

# 6. 本地开发与实时调试（创建软链，改动即时生效）
node scripts/install.mjs --symlink
node scripts/install.mjs --symlink --claude
```

安装器按选定配置校验并复制资产，排除 `.git`、`.venv`、`node_modules`、测试缓存与私有凭据；若目标目录已存在，安装器会主动拦截以保护现有文件。

---

## 2. 各宿主发现与适配边界

### Universal / Codex / Antigravity / Cursor
- **路径**：`~/.agents/skills/anything2video`（或工程级 `.agents/skills/anything2video`）。
- **发现方式**：标准 Agent Skills 规范，新开会话即可直接调用 `/anything2video` 或识别指令。
- **依据**：遵循官方 [OpenAI Codex Skills](https://developers.openai.com/codex/skills/) 与通用 Agent 规范。

### Claude Code
- **路径**：全局 `~/.claude/skills/anything2video/` 或项目 `.claude/skills/anything2video/`。
- **使用**：新会话通过 `/anything2video <主题>` 调用或直接给入口绝对路径。
- **依据**：[Anthropic Claude Code Skills 官方规范](https://code.claude.com/docs/en/skills)。

### WorkBuddy (桌面版)
- **路径**：`~/.workbuddy/skills/anything2video/`。
- **发现方式**：本机实证的桌面版本地技能发现目录（依据见 `reference/desktop-hosts.md`），安装后重启应用在技能列表呈现。
- **注意**：`SKILL.md` frontmatter 已原生集成官方要求的 `description_zh`、`version` 与 `author` 字段；输入框回车确认消息上屏；开工前执行 `node --version` 验证真实执行力。

### MiniMax Code (桌面版)
- **路径**：`{{DATA_DIR}}/skills/anything2video/`（默认 `~/.minimax/skills/anything2video/`）。
- **发现方式**：下一会话通过 `available_skills` 查验，或原生调用 `skill({name: "anything2video"})` 核对 Location。
- **能力注意**：1M 上下文严格遵守“大文件落盘传路径”纪律；mcode-tools 生成通道与 `A2V_IMAGE_*` 环境变量配合使用；多模态看片用于 B/C 轮定性目检；Remotion 推荐设置 `BROWSER_EXECUTABLE`。

### 豆包工作 (桌面版)
- **路径**：通过 `--export-dir` 导出后在桌面端工作任务中显式授权读取。
- **注意**：开启“电脑操作”后本地读取能力已实证；写文件与命令执行按当前版本实际权限验证。不可执行命令时自动降级为编剧与分镜输出。

### ZCode
- **路径**：`~/.agents/skills/anything2video`。
- **使用**：支持普通 headless `zcode -p "完整阅读 anything2video/SKILL.md 并执行" --cwd <工程>`；工作流注入 API 仅在环境真实提供时可选使用。

---

## 3. 验证等级

1. **包完整性检查**：入口 YAML frontmatter、通用超集元数据、配方、样片 manifest 与许可完整无缺。
2. **工程环境检查**：`node scripts/doctor.mjs` 检查 Node/uv/ffmpeg/ffprobe 与生图通道状态。
3. **宿主发现验证**：应用确认实际加载的入口路径与版本号，不等于独立出片。
4. **端到端制片实测**：该应用实际加载 Skill 并独立完成一条视频工程渲染、三轮验收与交付。

统一任务书与生产合同以 `reference/production-contract.md` 为唯一权威。
