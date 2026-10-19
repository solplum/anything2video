# anything2video

**把主题、文章或产品，做成有旁白、图解和动画的原创视频。**

一套给 AI 编程助手使用的制作 Skill：从调研与文案，到分镜、Remotion 代码动画、配音、渲染和审片。交付 MP4，也保留可以继续改稿、换镜头、重新渲染的工程。

*A portable agent skill for researched, narrated videos built with Remotion, with editable source and verifiable delivery evidence.*

[快速开始](#快速开始) · [选择风格](#选择风格) · [制作流程](#制作流程) · [文档导航](#文档导航)

## 先看效果

下面都是仓库中的实际渲染，点击图片打开 MP4。GitHub 如未内嵌播放，可下载后查看。

| 线条讲解 · 把受力关系画清楚 | 铜版雕刻 · 用排线表现明暗 |
|:---:|:---:|
| [![桥梁受力：线条讲解实际编码帧](examples/line-art-teaching/teaching-480.png)](examples/line-art-teaching/teaching.mp4) | [![一枚梨的明暗：铜版雕刻实际渲染帧](samples/posters/engraving-sample.jpg)](samples/engraving-sample.mp4) |
| 13.7 秒，有旁白、音乐与音效。[A/B 对照与源码](examples/line-art-teaching/README.md) | 12 秒无声材质研究。[原生竖屏](examples/engraving/portrait.mp4) · [复现与源码](examples/engraving/README.md) |

更多视觉方向见 [风格样片库](samples/README.md)。短样片展示的是具体风格和处理方法，不代表任意主题都已完成端到端验证。

## 适合做什么

- **知识讲解、文章改视频**：把概念拆成因果、流程、对比和可读的图解
- **产品与软件演示**：围绕问题、功能、证据与行动组织镜头
- **风格叙事、品牌历史、档案纪录片**：结合代码动画与有来源、经过审核的图片或影像

你提供主题或资料，以及受众、平台、语言、时长和目标。助手按制作流程完成调研、稿件与工程；默认会先与你确认文案方向和全文。支持中文/英文旁白与中英双语字幕，横竖屏需要各自布局。

交付目标包括 MP4、可编辑工程、旁白与字幕、封面、事实/素材来源及实际规格与 QC 记录。纯聊天窗口无法执行渲染；以实拍采访为主或真人口播剪辑，也不是这套工具的主要用途。

## 快速开始

### 1. 准备环境

- 能读写文件、执行 Shell 的 AI 编程助手；宿主需要能实际检查图像、视频和声音，或把对应审查留给人完成
- **Node.js + npm、Git、ffmpeg/ffprobe、可用 Chromium**；配音与音频工具另需 **uv、Python 3.11–3.14**
- 首次安装依赖、下载浏览器和云端配音需要网络。Remotion 依赖版本已锁定，使用仓库锁文件

```sh
git clone https://github.com/solplum/anything2video.git
cd anything2video
node scripts/doctor.mjs
```

`doctor` 检查本地命令和可选图像通道配置；它不会安装依赖，也不证明浏览器、账户额度或宿主加载已就绪。完整制作前修复对应缺项；无声雕刻样片可跳过 uv/Python。详见 [环境与常见问题](docs/getting-started.md#环境与依赖)。

### 2. 安装给助手使用

在仓库根目录选择适合宿主的一条命令：

```sh
node scripts/install.mjs               # 通用目录：~/.agents/skills/anything2video
node scripts/install.mjs --claude      # Claude Code
node scripts/install.mjs --workbuddy   # WorkBuddy
node scripts/install.mjs --minimax     # MiniMax Code
```

重新加载宿主后，确认它实际读到了 `anything2video/SKILL.md`。如果宿主未自动发现，显式提供入口的绝对路径。安装器会拒绝覆盖已有目录；更多宿主、手动导入和更新方法见 [安装与宿主适配](docs/adapters.md)。

然后给助手一个清楚的任务，例如：

```text
使用 anything2video，先完整阅读 SKILL.md 和 reference/production-contract.md。
为刚入门的开发者解释缓存命中与未命中，中文旁白，约 90 秒，16:9 横屏。
观众看完应能判断一个请求什么时候需要读数据库。
先给我文案方向，再确认全文；用同一个请求贯穿演示。
先做开场、复杂中段和结尾的小样，再制作全片。
交付 MP4、可编辑工程、字幕、封面和来源/QC 记录。
```

助手会在 Skill 目录之外建项目。自己初始化工程的命令和后续步骤见 [第一条自己的视频](docs/getting-started.md#第一条自己的视频)。初始化只产生草稿骨架，仍需完成稿件、配音、分镜与镜头代码。

### 3. 先跑通一个样片（可选）

想先确认渲染环境，可以复现上面的铜版雕刻。它自带场景与字体，**不需要模型、生图或 TTS API key**，也不需要 Python 音频工具。在仓库根目录运行，目标目录必须尚不存在：

```sh
node examples/engraving/prepare.mjs ../a2v-engraving-demo
cd ../a2v-engraving-demo
npm ci
npm run typecheck
npx remotion browser ensure
npx remotion render src/index.ts Engraving out/engraving.mp4 --codec=h264 --crf=18 --concurrency=2
```

结果是 `out/engraving.mp4`：1280×720、30fps、12 秒的无声研究片。原生竖屏与带媒体/源码哈希的渲染入口见 [完整复现说明](examples/engraving/README.md)。这个例子验证渲染链路，不代替有旁白影片的完整制作流程。

<!-- style-catalog:start -->
## 选择风格

克隆或解压后，用本地浏览器打开 [samples/index.html](samples/index.html)：先选家族，再切换变体；也可搜索名称、ID，或按类型/气质筛选。[全部变体](samples/all.html) 保留旧 ID。GitHub 中的 HTML 链接显示源码，需在本地打开完整样片包。

当前目录：**63 个风格 ID · 59 个选择入口 · 62 个有预览 · 12 个运行时皮肤**。数据自动来自 [styles/catalog.json](styles/catalog.json)，未提供预览的风格会在选择页明确标出。

只有标记 `runtimeSkin: true` 的 ID 可用于 `config.style`，且只覆盖配色与覆盖层；主体动画仍需接入对应图元。其他风格按 [各自规范与 kit](styles/README.md) 手动接入。选择风格不会自动重写镜头。
<!-- style-catalog:end -->

## 制作流程

**任务与资料 → 文案确认 → 真实配音时间轴 → 分镜 → 多点小样 → 镜头代码 → 混音与渲染 → 审片修复 → 交付**

- **先解释清楚**：每个镜头说明一个问题，有具体动作和结果；文字、数字、图表与字幕由代码控制
- **先打样再铺开**：同时看开场、复杂中段和结尾，使用实际音色、字幕和目标画幅
- **以真实输出验收**：检查工程、画面与听感，再反向挑错并独立评审；类型检查和截图不能替代整片观看
- **改动可追溯**：渲染保存实际规格、媒体哈希和源码指纹；修改后重新渲染并复核，未执行的检查保持 `not_performed`

制作契约见 [production-contract](reference/production-contract.md)，操作顺序见 [production-workflow](reference/production-workflow.md)。Skill 提供方法与工具，成片仍取决于模型能力、素材和审片；不保证一次提示就完成精品，也不证明不同模型能力等价。

## API key、成本与许可

- **助手本身**：使用你所在宿主的模型与计费方式；仓库不附带模型服务或额度
- **配音**：默认脚本可用 `edge-tts` 在线合成，无需单独填写 TTS key；依赖服务可用性，也可导入已授权配音。其他 TTS 的账户与费用按所选服务处理
- **AI 图像**：可选，仅生成材质/场景底时需要；程序绘制路线无需生图 key。配置使用 `A2V_IMAGE_API_BASE`、`A2V_IMAGE_API_KEY`、`A2V_IMAGE_MODEL` 环境变量，不把密钥写进仓库。`doctor --probe-image` 会真实生成一张图并可能计费，默认不运行
- **制作成本**：模型、语音、素材、渲染算力和复核分别计算。先用小样测自己的环境，不提供未经实测的单片价格或质量提升比例

代码与文档采用 [MIT](LICENSE)。Remotion、字体、音乐、音效和生成素材各有自己的许可，**仓库许可不等于素材可任意商用**。尤其曲库 `wx-*` 外部音乐仍需确权，详见 [音频来源](assets/audio/ATTRIBUTION.md)。发布时核对素材权限、平台当前规则与适用的 AI 内容标识。

## 文档导航

| 想做什么 | 从这里开始 |
|---|---|
| 配好环境、建第一个工程、排查失败 | [上手指南](docs/getting-started.md) · [宿主适配](docs/adapters.md) |
| 理解制作与交付标准 | [Skill 入口](SKILL.md) · [生产合同](reference/production-contract.md) · [导演手册](reference/directing-playbook.md) |
| 选择叙事结构 | [知识讲解](recipes/explainer.md) · [产品宣传](recipes/promo.md) · [自由风格](recipes/custom.md) · [品牌史诗](recipes/epic.md) · [档案纪录片](recipes/documentary.md) |
| 选风格、接入图元或设计运动 | [风格资产](styles/README.md) · [样片来源](samples/README.md) · [动效配方卡](gallery/README.md) |
| 做好声音、字幕与小屏可读性 | [音色选择](reference/voice-bakeoff.md) · [音乐编排](reference/music-plan.md) · [声音设计](reference/sound-design.md) · [可读性检查](reference/readability.md) |
| 复现案例或贡献修改 | [线条讲解 A/B](examples/line-art-teaching/README.md) · [铜版雕刻](examples/engraving/README.md) · [回归验证](docs/getting-started.md#回归验证) |

## 鸣谢

讲解规范与模板源于 [anything2explainer](https://github.com/Vincentwei1021/anything2explainer)。第三方代码归属见 [LICENSE-THIRDPARTY](LICENSE-THIRDPARTY)，程序编曲来源见 [audio-engine/VENDOR.md](audio-engine/VENDOR.md)，样片与素材的来源和使用边界随对应目录保留。本项目与所列模型、宿主或发布平台无官方合作关系。
