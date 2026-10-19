# 上手指南

[返回首页](../README.md) · [宿主安装](adapters.md) · [生产合同](../reference/production-contract.md)

先选一条路线：只想验证渲染，运行首页的 [铜版雕刻样片](../examples/engraving/README.md)；要做自己的主题，安装 Skill 并按下面的流程建工程。样片自带镜头，通用模板则需要助手继续创作。

## 环境与依赖

| 能力 | 依赖与检查 | 边界 |
|---|---|---|
| 克隆、安装与工程脚本 | Git、Node.js、npm；`node scripts/doctor.mjs` | doctor 只检测命令，不自动安装依赖 |
| 代码渲染 | 模板锁文件中的 Remotion/React、Chromium；工程内 `npm ci`、`npx remotion browser ensure` | 下载依赖与浏览器需要网络；已有浏览器可显式指定 |
| 媒体处理与规格检查 | `ffmpeg`、`ffprobe` 可在 PATH 调用 | doctor 成功仍不等于真实视频已渲染或解码 |
| 配音与音频处理 | uv、Python `>=3.11,<3.15`；工程内 `uv sync` | 版本范围来自 `template/pyproject.toml`；uv 可准备匹配的 Python |
| 视觉、声音审查 | 宿主实际支持查看图像、播放视频与听音频，或人工复核 | 缺少能力时保留待审状态，不自动记为通过 |

项目没有声明自己的 Node 最低版本；使用能运行锁定依赖的受支持 Node.js 版本，不要把某台机器上的版本当作跨平台最低要求。Remotion 相关包固定为同一版本，不单独升级其中一个包。

### 网络、密钥与费用

- 安装依赖和浏览器、使用云端模型/TTS/生图通道需要相应网络连接。完整工程的“离线”能力取决于所用素材和服务；样片页本身可本地播放。
- 助手模型由宿主提供。Skill 不附带模型账号或额度，也不会替你绕过宿主权限。
- 默认中文 TTS 使用在线 `edge-tts`，不要求另填 API key。英文自动模式尝试本地 Kokoro，导入失败时回退到 Edge；Kokoro 需额外依赖，不包含在默认音频安装中。可以使用已授权的成品配音，再建立时间轴。
- 生图是可选能力，程序材质不需要图像 API。使用 MiniMax 或 OpenAI 兼容图像服务时，配置 `A2V_IMAGE_API_BASE`、`A2V_IMAGE_API_KEY`、`A2V_IMAGE_MODEL`，必要时设置 `A2V_IMAGE_PROVIDER`。不要把 key 发进文档、提交到 Git，或粘进命令日志。
- 首用选择可记在 `~/.anything2video/image-channel`，只记录 `minimax`、`openai` 或 `none`；密钥只通过环境配置提供。
- 默认 doctor 不调用生图服务，也不检查余额。只有显式执行 `node scripts/doctor.mjs --probe-image` 才会发送真实请求，生成一张图并可能计费。

## 第一条自己的视频

### 1. 安装并确认入口

按 [宿主适配](adapters.md) 安装，然后在新会话中确认实际读取的 `SKILL.md` 路径。默认安装位置是 `~/.agents/skills/anything2video`；不同宿主的发现方式要实际验证。

安装器保护已有目录，不做自动升级或备份。更新前保留自己的改动，备份旧安装，再明确替换；也可用 `--symlink` 供本地开发，或 `--export-dir <目录>` 导出供手动导入。不要把视频工程放进 Skill 安装目录。

### 2. 初始化包外工程

在克隆后的仓库根目录运行。以下相对路径命令可用于 POSIX shell 或 PowerShell，目标 `../my-video` 必须不存在或为空：

```sh
node scripts/doctor.mjs
node scripts/init.mjs ../my-video my-video
cd ../my-video
npm ci
uv sync
npx remotion browser ensure
npm run typecheck
```

初始化会写 `project.json`，默认 `status: draft`、1280×720、30fps、`totalFrames: null`。它不会生成完整分镜、镜头或可交付影片，也不会运行 git add/commit。先完成下一步，再尝试渲染。

使用绝对路径也可以，含空格时加引号：

```sh
node scripts/init.mjs "/absolute/path/to/my-video" my-video
```

只传一个 slug 的 `node scripts/init.mjs my-video` 需要先配置绝对数据根：优先读 `A2V_DATA_ROOT`，其次读 `~/.anything2video/workdir`。未知根目录时会报错，不会默默写入当前目录。

### 3. 完成创作与工程

1. 给助手主题/资料、受众、语言、目标平台、画幅、时长与观众应获得的结论。
2. 确认视觉方向与稿件。默认先讨论文案方向，再确认全文；只有明确的稿件级授权才可跳过文案确认。
3. 生成或导入配音，从真实音频建立时间轴，再设计镜头；不要用加快语速硬塞进预设时长。
4. 声明完整 `project.json` 与 `script/storyboard.json`，编写并注册真实镜头，检查每帧覆盖。模板里的示例标题和内容要替换。
5. 先看开场、复杂中段和结尾的小样，再继续全片。原生竖屏要重排构图和 Composition，不能靠横屏放大完成。

详细要求以 [SKILL.md](../SKILL.md)、[生产合同](../reference/production-contract.md) 与所选 [配方](../recipes) 为准。配方文档与运行时配置不是一一对应的开关：模板 `recipe` 的运行时值为 `explainer`、`promo`、`epic`；`custom` / `documentary` 是制作路线，需要按其文档实现镜头。

### 4. 渲染、审片与交付

下面以仓库目录名 `anything2video`、工程名 `my-video` 且两者位于同级为例。**这些命令要求稿件、时间轴、分镜与镜头已经完成。**

在视频工程内检查类型：

```sh
npm run typecheck
```

再回到仓库根目录运行统一入口：

```sh
cd ../anything2video
node scripts/check-plan.mjs ../my-video
node scripts/render.mjs ../my-video preview 12 1
node scripts/render.mjs ../my-video video
```

- `preview 12 1` 表示从第 1 帧开始渲染 12 秒；结束帧自动限制在全片范围内，起始帧必须有效。统一入口帧号 **1 起、含端点**；Remotion 原生 CLI 的 `--frame` 则为 0 起。
- 视频默认写入 `renders/<slug>_v1.mp4`，预览为 `renders/<slug>_preview.mp4`，均带 `.delivery.json`。输出默认拒绝覆盖，确需替换时显式使用 `--overwrite`。
- 需要指定已有浏览器时，给统一入口设置 `BROWSER_EXECUTABLE`。使用 Remotion 原生 CLI 时传 `--browser-executable`。
- 限制并发可设置 `A2V_CONCURRENCY`。POSIX shell 可用 `A2V_CONCURRENCY=2 node ...`；PowerShell 先执行 `$env:A2V_CONCURRENCY = "2"`，再运行命令。
- 正式交付前，将工程 `status` 改为 `production`，重新渲染全片。渲染成功不等于审片通过。

完成三轮检查与独立评分评审、修复缺陷，并实际播放/听取完整影片后，按生产合同填写 `qc/final.json`：

```sh
node scripts/check-qc.mjs ../my-video qc/final.json
```

门禁核对媒体、源码、证据、帧数、规格与全片解码；不自动证明观众能看懂、真实看过全片或艺术质量。未进行的检查保留 `not_performed`。改动源码、素材、字幕或音频后，旧证据会失效，必须重渲并复核。

## 浏览风格样片

克隆或解压完整包后，用本地浏览器打开 `samples/index.html`：先选家族，再切换变体，支持名称/ID 搜索和类型/气质筛选。`samples/all.html` 保留全部变体及历史配方参考。

GitHub 仓库中的 HTML 链接显示源文件，不是在线演示站。不要只另存一个 HTML 文件，否则相邻 MP4、poster 和源码链接会缺失。

实际能力以 [styles/catalog.json](../styles/catalog.json) 为准：`runtimeSkin: true` 的 ID 才能填入 `config.style`，并且仅覆盖配方配色和覆盖层。主体图形仍由镜头接入相应 kit；其他 ID 按 [风格规范](../styles/README.md) 手动接入。换一个 ID 不会自动重写整片构图和动画。

## 常见问题

| 现象 | 先检查什么 |
|---|---|
| “装好了”但助手没使用 Skill | 确认真实入口路径；重载宿主，必要时显式要求完整阅读 `SKILL.md` |
| doctor 报命令缺失 | 安装对应依赖并确认 PATH；缺可选生图配置本身不使 doctor 失败 |
| 初始化拒绝目标目录 | 工程不能与 Skill 重叠，也不能覆盖非空目录；选择新的外部目录 |
| 初始化后无法渲染 | `totalFrames`、真实分镜和镜头还未完成；这是草稿骨架，不是自动生成的影片 |
| Chromium 下载或启动失败 | 核对网络、系统依赖及可执行文件路径；可以指定已有受支持浏览器，不绕过安全限制 |
| TTS 或生图失败 | 按实际错误检查服务、网络、额度或授权；记录回退，改用已有授权配音或程序材质 |
| 视频存在但 QC 拒绝 | 检查 production 状态、全片范围、素材审核和证据是否与当前源码/媒体匹配 |
| 换 style 后没有出现对应动画 | `config.style` 只换配色/覆盖层；镜头还需使用该风格图元 |

## 回归验证

以下命令在仓库 checkout 中执行，发行安装包不包含测试目录。先按锁文件准备依赖：

```sh
npm --prefix template ci
npm --prefix template run typecheck
node --test tests/*.test.mjs
node scripts/style-catalog.mjs --check
cd template
uv sync
uv run python -m unittest discover -s tests -v
```

测试覆盖的是具体工程行为和证据一致性，不证明审美、跨宿主端到端能力或模型等价。提交前也应检查改动对应的实际图像/视频，以及安装包中是否包含新文档和必要资产。风格目录由 `scripts/style-catalog.mjs` 从 `styles/catalog.json` 生成，不手改生成页或重复维护数量。

风格系统的来源、兼容范围与实测边界见 [风格记录](style-system-round1.md)；历史迭代报告保留在仓库的 `docs/optimization-*.md`，它们描述各自版本，不覆盖当前生产合同。
