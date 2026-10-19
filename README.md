# anything2video

把主题、文章或产品做成原创视频：调研 → 稿件 → 配音 → 分镜 → 代码动画 → 渲染 → 审片 → 交付。制作经验沉淀在工程与证据里，而不是寄托在一次临场回答上。

看过一条有材质、镜头推进和首尾呼应的 AI 视频后，很容易产生一个判断：只要换成同一个模型，再抄一条提示词，就能得到同等作品。实际动手往往得到另一种结果：标题很大，字幕很密，背景很炫，信息却没有被解释。anything2video 把这些环节串成可复现的工程；你仍然需要能完成任务的模型，但不必把每个导演决定都绑在某个模型上。

**当前 v5.0.0。** 下载一份通用 ZIP 解压即用，或克隆仓库直接安装。导演方法、原生画幅、多点打样与证据门禁帮助稳定制作；Skill 不改变模型权重，不承诺全面等价于 Opus 或一次提示生成精品。代码承担精确信息，审核后的生成素材承担场景，逐件登记来源和披露。

English: A portable skill for producing researched, original code-composited videos with narration, shot contracts, deterministic rendering and measured quality evidence. Model capabilities and application support still need real validation.

## 快速开始

需要 Node.js、npm、uv、ffmpeg/ffprobe 和可用 Chromium。Remotion 相关包固定同版本，依赖与字体、素材各有许可。

```powershell
git clone https://github.com/solplum/anything2video.git
cd anything2video
node scripts/doctor.mjs
node scripts/init.mjs D:/video-projects/my-video my-video
cd D:/video-projects/my-video
npm install
uv sync
npx remotion browser ensure
```

- 初始化器只建模板工程，不产生完整片子；拒绝覆盖非空目录，不自动暂存/提交；工程必须在 skill 外。
- 也支持 `node scripts/init.mjs <slug>`：根目录优先 `A2V_DATA_ROOT`，再读 `~/.anything2video/workdir` 的绝对路径；未知时先询问，不默默落在当前目录。
- 首次使用会同轮问一次**可选的生图 API key**（MiniMax 或任意 OpenAI 兼容接口）：只用于 AI 材质/世界底画面（主要 epic 配方），**对成片约 5%–10% 的效果影响，不填不影响渲染、配音、音乐与交付**；决定（provider 或 none）存 `~/.anything2video/image-channel`，密钥只走环境变量 `A2V_IMAGE_*`、不落盘。
- 浏览器可用环境变量 `BROWSER_EXECUTABLE` 指向已安装版本；风格拿不准先看 [离线视觉样片](samples/index.html)。

## 安装（全平台统一单包架构）

自 v5.0.0 起，项目收束为全平台统一的单包架构，所有宿主统一发现并运行名为 `anything2video` 的规范 Skill。克隆本仓库或解压 Release 包后，直接运行统一安装器：

```bash
# 通用默认安装（支持 Codex、Antigravity、Cursor、OpenClaw 等）
node scripts/install.mjs

# 针对各主流宿主环境
node scripts/install.mjs --claude       # Claude Code (~/.claude/skills/anything2video)
node scripts/install.mjs --workbuddy    # WorkBuddy 桌面端 (~/.workbuddy/skills/anything2video)
node scripts/install.mjs --minimax      # MiniMax Code (~/.minimax/skills/anything2video)
node scripts/install.mjs --export-dir D:/a2v-pkg  # 导出独立完整包（用于豆包工作等手工授权导入）
node scripts/install.mjs --symlink      # 本地开发与实时调试（创建软链，改动即时生效）
```

| 宿主 | 安装位置 | 入口与说明 |
|---|---|---|
| 通用 / Codex / Antigravity / Cursor | `~/.agents/skills/anything2video/` | 标准通用技能目录，新开会话即可识别并调用 `/anything2video` |
| Claude Code | `~/.claude/skills/anything2video/` | 全局安装；亦可指定工程目录装入 `<工程>/.claude/skills/anything2video` |
| WorkBuddy 桌面 | `~/.workbuddy/skills/anything2video/` | 安装后重启应用在技能列表呈现；原生内置官方中英描述与版本作者元数据 |
| MiniMax Code | `{{DATA_DIR}}/skills/anything2video/` | 下一会话查验 `available_skills`，1M 上下文严格遵守大文件落盘传路径纪律 |
| 豆包工作 | 导出独立包后桌面端授权读取 | 在可访问本地文件的工作任务中授权导出目录并显式读取入口 |
| ZCode | `~/.agents/skills/anything2video/` | 支持标准 headless `zcode -p "完整阅读 anything2video/SKILL.md 并执行"` |

默认用户级安装，已有目录会被保护，更新先备份。安装后先核实实际读取的入口路径、配方和可执行工具——不要仅凭“已经加载”就认为渲染可用；无法执行 Shell 的环境可以帮你写稿和分镜，但不能交付一个实际渲染好的 MP4。完整说明、运行时能力面与验证等级见 [docs/adapters.md](docs/adapters.md) 与 [reference/environment-capabilities.md](reference/environment-capabilities.md)。自建发行包：`node scripts/build-editions.mjs <仓库外输出目录>`。

<!-- style-catalog:start -->
## 风格：家族与变体

63 个兼容 ID → 59 个选择入口；62 个有样片，等距剖解仍缺预览。12 个支持 config.style；其余通过 kit 手动接线。唯一元数据源：[styles/catalog.json](styles/catalog.json)。

| 家族 | 保留的变体 | 归类原因 |
|---|---|---|
| 暗色信息设计 | [deep-space](samples/index.html#deep-space) / [mg-purple](samples/index.html#mg-purple) | 共享暗底与信息版式；青色产品宣传和紫色知识讲解仍保留各自皮肤、配方和覆盖层。 |
| 微缩等距场景 | [isometric-city](samples/index.html#isometric-city) / [clay-town](samples/index.html#clay-town) | 共享等距投影；硬面建筑的位移与黏土软材质的逐帧弹动分别保留。 |
| 印象派光色 | [light-dabs](samples/index.html#light-dabs) / [lily-pond](samples/index.html#lily-pond) | 共享光斑短笔触语法；前者固定笔位，后者水面与植物分档沸腾，保留各自参数和场景。 |
| 套色印刷 | [ink-plate](samples/index.html#ink-plate) / [riso-print](samples/index.html#riso-print) | 共享分版与套印；四墨网格几何编舞和双色滚筒工艺仍是两个独立变体。 |

新增 [铜版雕刻 engraving](styles/engraving/SPEC.md)：随形排线与渐细刀口塑造明暗，交叉线加深背光，透明设色后置。[横屏样片](samples/engraving-sample.mp4) · [原生竖屏](examples/engraving/portrait.mp4) · [可复现源码](examples/engraving)。12 秒无声材质研究，不能当作完整旁白影片验收。

[![铜版雕刻实际渲染](samples/posters/engraving-sample.jpg)](samples/engraving-sample.mp4)

打开 [离线家族选择页](samples/index.html) 先挑家族，再切换变体；[全部变体与历史配方参考](samples/all.html) 可查每个旧 ID。分类不改变 renderer、种子、recipe 关联或旧导入路径。绘画材料不同的风格继续保留，不按同一展示题材删除。
<!-- style-catalog:end -->

## 能替代什么，不能证明什么

这套方法可以迁移常见的代码视频工作：知识讲解、软件流程动画、产品宣传、风格化叙事和一些品牌片。原先交给某个高端模型的规划与编码，可以交给其他有相应执行能力的助手，再用同样的门禁验收。它没有证明任何模型在理解、编码、审美或长任务稳定性上彼此等同，也不能保证首次成片达到参考片水平；一个代理看不懂源码或没有渲染环境，Skill 无法补出这些能力。没有对照实验，就不声称模型替代率、成本节省比例或质量分数。更实际的目标是：同一条任务书、同一份镜头合同、同一套验收，让换工具后的输出仍然可以判断、追责和修复。

入口 `SKILL.md` 决定该读哪个配方；`recipes/` 给出叙事结构；`reference/` 给出运动、构图、声音和审片规则；`template/` 是 Remotion 工程；`styles/` 保存可复用风格资产；`scripts/` 提供安全初始化、覆盖检查和渲染入口。工作链是：

```text
主题与资料 → 可核实稿件 → 真实配音时间轴 → 镜头合同
           → 小样 → 全片代码 → 三轮验收 → 视频与可复现工程
```

Remotion 把 React 组件按指定帧渲染成视频，因此文字、数字、图示和运动可以精确控制。对于复杂材质，可以把有来源、经过审核的生成素材作为世界底；所有精确信息仍由代码绘制。混合路线必须披露，不能把"画面由代码合成"写成"所有像素都没有外部素材"。

## 从任务书到成片

从一个短而清楚的主题开始，例如缓存。任务书不越长越好，它要约束受众、学习目标、平台、时长和验收：

```text
先完整读anything2video的SKILL.md和production-contract.md。
为刚入门的开发者解释缓存命中和未命中。
发布平台抖音，中文旁白，原生1080x1920，约2分钟。
观众看完应能判断一个请求什么时候读数据库。
每个镜头要有信息变化，使用一个请求对象贯穿演示。
先核实事实，再写稿；所有文字、数字和图解由代码绘制。
我授权你选择音色、视觉方向和音乐；记录你的决定。
先验开场、复杂中段和结尾，至少三轮审片再交付。
提供MP4、工程、字幕、封面、素材来源与ffprobe规格。
没有子代理就顺序完成，不跳过混音和QC。
```

缺少学习目标时，模型容易把"缓存是什么"写成概念列表；有了目标，镜头就能围绕请求移动、命中返回、未命中读取来设计。

**稿件与镜头合同**：先核实事实，后写口播，一行一句，过长字幕用 `|` 切块。配音决定真实句长，不能先硬写两分钟分镜、最后再把语速拉快硬塞进去。TTS 输出清洁的 `audio_narration.wav`，混音输出 `audio.wav`，两者用途不同，反复混音必须保持正本哈希不变。`storyboard.json` 使用1起含端点帧号：

```json
{
  "shots": [
    {
      "id": "S01",
      "from": 1,
      "to": 180,
      "group": "G1",
      "component": "src/shots/Request.tsx",
      "purpose": "建立请求与缓存的关系",
      "action": "请求对象沿路径进入缓存"
    }
  ],
  "claims": [],
  "assets": []
}
```

真实工程需要全部镜头连续覆盖总帧数。Remotion帧号从0开始，Sequence的from应是镜头from减1；漏镜头或错换算会产生空场与音画偏差。

**怎样接近高质量参考片**：最值得借鉴的是结构——有一个贯穿对象，它在每章做事；每章有明确材质世界；首尾有呼应；字幕给画面留空间；运动有起因、过程和落点。软件教程的贯穿对象可以是一枚请求、一份文件或一个制作模块，从输入走向输出。每个镜头问三件事：它承载哪个知识点？哪件事在变化？观众最终看到了什么结果？"标题淡入、背景慢推"可以用在章节呼吸段，但不应成为全部镜头的动作。需要质感时，生成素材负责有机材质，代码负责准确内容；素材必须检查乱字、伪铭文、透视和形态错误，不合格就改构图、换素材或简化视觉，不把伪影藏在模糊和暗角里。

## 配方与资产

| 资产 | 位置 | 说明 |
|---|---|---|
| 制作配方 | `recipes/` | 讲知识 `explainer.md` · 卖功能 `promo.md` · 风格化叙事 `custom.md` · 谱系/品牌历史 `epic.md` · 历史档案纪录片 `documentary.md`；explainer 参考随仓库附在 `reference/explainer/`，不依赖本机其他目录 |
| 生产合同 | `reference/production-contract.md` | 旧配方里的宿主、授权、画幅和音频口径统一由它覆盖 |
| 风格资产 | `styles/<sku>/` | 63 个兼容 ID 的图元/皮肤来源见 catalog；59 个选择入口，12 个运行时皮肤；anatomy 暂无预览，共享笔触复制要求见 `styles/shared/README.md` |
| 动效配方卡 | `gallery/` | 180 张配方卡 + demo 参考源码（移植自 video-shotcraft，Apache-2.0，分镜抽卡用），见 `gallery/README.md` |
| 可编组件 | `template/src/common/kit/` | PageCam 2.5D 运镜、WordLitCaption 词级点亮字幕、ChapterBadge、GoldenQuote、RecapFrame、VarText 可变字体轴、StrokeText 单笔画字体、PhotoStage 底图语法、RostrumStage 档案翻拍微距舞台；共享运动数学层 `common/motion/` |
| 音乐 | `audio-engine/mgaudio` + `scripts/bgm_*.py` | 程序编曲（MIT+CC0 vendor，溯源见 `audio-engine/VENDOR.md`）与曲库分析/主题反查/标注轮；音乐反应层数据走 `audio_features`；纪律见 `reference/music-plan.md` 与 `reference/bgm-bakeoff.md` |
| 声音设计 | `reference/sound-design.md` | 风格绑定 SFX、曲库与音效分类检索 |
| 材质与镜头 | `reference/materials.md` · `reference/ai-frame-sop.md` | 材质场景参考；一帧先行四路线与首尾同帧图生视频见 ai-frame-sop §2.5 |
| 方法论 | `reference/` | 导演手册 `directing-playbook.md`、参考片拆解 `reference_breakdown.py`、史诗方法论 `epic-brand-film`（市面爆款风向，热门向优先）、审美判例 `aesthetic-rules.md`、D 轮评审 `jury-review.md` |

## 生产与验收

```text
调研 → 稿件与真实配音时间轴 → 结构化分镜 → 多点小样
     → 建镜头 → 混音与渲染 → 三轮验收修复 → measured delivery
```

- `scripts/init.mjs`：安全复制纯模板，无自动git动作。
- `scripts/doctor.mjs`：本地命令检查与图像通道状态（环境三件套 + 首用决定文件，只记 provider、不回显密钥）；不验证账户或云端额度——加 `--probe-image` 可显式做一次真实生成探测（**计一张图费用，默认不跑**），欠费/鉴权失败明确报错并给充值或降级路线。
- `scripts/check-plan.mjs`：连续帧覆盖、空片、来源、文件和素材哈希；还需核对真实镜头注册与渲染。
- `scripts/render.mjs`：跨平台Node渲染，Composition规格与声明必须一致，保存ffprobe原始证据。
- `scripts/check-qc.mjs`：拒绝草稿、片段、未审素材、缺项和旧媒体/源码证据，独立计帧与全片解码；不自动证明艺术质量或实际观看。
- [导演手册](reference/directing-playbook.md) 与 [生产流程](reference/production-workflow.md)：原因/动作/结果、多点打样、根因修复及真实完整审片。
- `template/scripts/tts_build.py`：按 project.json 的 slug/fps 生成清洁旁白、时间轴与字幕，同步 totalFrames；旧正本需 --force 才能更新。音频路径逃逸和 config 不一致会拒绝。
- `template/scripts/mix_audio.py`：不可变旁白正本、可复测重混、音乐压低；默认不注入风格音效。
- `template/scripts/mix_sfx.py`：钉帧音效通用通道（cues 表 + sfx-mix.json 台账，混音后第三步，防双混）。
- 三轮验收后加 D 轮独立评分评审（[jury-review](reference/jury-review.md)）：7 维锚点评分，任一维度 <7 阻塞。
- `probe_av_sync.mjs`：纯旁白首句检查，最终媒体时长另测；不能代表全部字幕逐句对齐。
- `probe_delivery.py`：实际规格，交付说明不手写分辨率。
- `scripts/export_jianying.py`：全轨草稿导出（视频/旁白/BGM/字幕全轨拆分，Mac 沙盒隔离与 Windows 路径支持）。
- `scripts/probe_readability.mjs`：真实视频抽取 480px 缩略图，结合显式图元清单检查字号、字幕带与越界；不做 OCR，抽帧成功仍需实际看片。命令、schema 与退出码见 [可读性检查](reference/readability.md)。
- `project.visualDirection`：同文案关键帧/运动方向比较或既有 SKU 回归，接入现有 check-plan；[证据格式与选择方法](reference/visual-direction.md)。

```powershell
npm run typecheck
node <skill>/scripts/check-plan.mjs <project>
node <skill>/scripts/render.mjs <project> preview 12 <1起开始帧>
node <skill>/scripts/render.mjs <project> video
node <skill>/scripts/check-qc.mjs <project> qc/final.json
```

三轮分别看工程真实性、视觉与教学、反向挑错：第一轮检工程（类型检查、覆盖、素材文件、音画、实际规格与解码），第二轮检教学（能否看懂因果、字幕是否遮挡、动作是否有落点、素材有没有伪影），第三轮从反面挑最弱镜头，复核事实、承诺和修改造成的回归。先渲开场、一个最复杂中段和结尾——开场成立而中段塌掉，是常见失败。小样阶段检查字体、听感、字幕带、动作与转场，再施工全部镜头。真实运动片段必须包含开场、复杂中段与片尾，不能以类型检查或截图集代替整片审片。

最终证据门禁：工程先从draft改为production再重渲全片，真实完整播放和听取后，按生产契约记录八项`qc/final.json`审查，再运行`node <skill>/scripts/check-qc.mjs <project> qc/final.json`。它独立计帧和完整解码，核对媒体/源码/证据哈希；源码或素材变动让旧证据失效。缺少实际检查就保持not_performed，不能自动填写passed。

初始化是 draft。正式前改 project.status 为 production 再重渲。媒体 sidecar 记录媒体/源码全 SHA256 和帧范围，视觉/声音默认 not_performed；实际完整播放与听取后才填 QC。源码、字幕、音频或素材变化都会使旧证据失效。

横屏传统模板1280×720@30；竖屏目标1080×1920@30，需要重新布局和Composition，不是横屏放大。AI生成素材必须披露，发布平台的声明入口仍需使用。不存在"保证过审"规则。

**国内发布**：抖音版本要原生竖屏，关键信息避开右侧操作区与底部介绍区。制作安全区是保守建议，最终以账号发布预览为准。字幕每屏只留能读完的短句，命令太长分段展示。有AI生成画面或合成配音，按当期发布界面启用适用的AI声明，并保留相关标识；成片内的一行"AI辅助制作"不能代替平台按钮。模型对比要把范围写完整：标题可以讲"用anything2video替代某个模型做视频的流程"，不能没有测试就写"所有能力全面碾压"。

## 成本与失败处理

成本来自模型调用、TTS、素材生成、渲染和复核。项目不提供虚构的每条价格；先做一个10到15秒小样，记录调用与渲染耗时，才能估算自己环境的成本。

模型写错代码时，先把失败缩到单个镜头；声音通道不可用时，记录回退原因；素材连续不合格时，重写构图；速度太慢时，先减并发与高成本特效；输出规格不符时，从Composition和配置修起，不在交付说明里改口。所谓稳定，是失败能被发现、结果能被复测、改动能被定位——让这个流程留在工程里，才是Skill比一条漂亮提示词更有价值的地方。

## 回归验证

```powershell
npm --prefix template ci
npm --prefix template run typecheck
node --test tests/runtime.test.mjs tests/editions.test.mjs tests/qc.test.mjs tests/source-consistency.test.mjs tests/readability.test.mjs tests/visual-direction.test.mjs tests/iso-craft.test.mjs tests/line-art-teaching.test.mjs tests/v5-capabilities.test.mjs tests/style-system.test.mjs tests/engraving.test.mjs tests/engraving-assets.test.mjs
node scripts/style-catalog.mjs --check
cd template
uv sync
uv run python -m unittest discover -s tests -v
```

测试覆盖运行时、独立包、风格兼容与 chooser 行为、雕刻几何/样片源码一致性、证据新鲜性、音频正本、真实错位、章表和生成素材合同，另有真实源一致性门禁（宿主入口版本、包清单、样片哈希、缓存垃圾）。测试证明具体工程行为，不证明审美与跨模型等价。风格家族/共享代码、雕刻来源与实际验证范围见 [本轮风格记录](docs/style-system-round1.md)。历史变更与验证范围见 [v3报告](docs/optimization-v3.md)、[v3.1六端扩展](docs/optimization-v3.1.md)、[v3.6](docs/optimization-v3.6.md)、[v3.7](docs/optimization-v3.7.md)、[v3.8](docs/optimization-v3.8.md)、[v3.9](docs/optimization-v3.9.md)、[v3.10](docs/optimization-v3.10.md) 与 [v4.0](docs/optimization-v4.0.md)，历史 [v2报告](docs/optimization-v2.md) 保留。

## 许可与鸣谢

代码与文档 [MIT](LICENSE)。字体分别为SIL OFL，许可随文件分发。早期样例音乐署名见 [examples/README.md](examples/README.md)。新工程音乐与AI素材分别记录；曲库中 `wx-*` 四首为**外部音乐**（微信视频提取、曲目原名未识别），经作者决定随本仓库分发并在 [assets/audio/ATTRIBUTION.md](assets/audio/ATTRIBUTION.md) 逐条标注来源与状态，**版权归原作者所有**，商用/发布/跨平台使用前必须确权；其余外部用户曲不打包分发。参考来源：[Remotion 文档](https://www.remotion.dev/docs/)（代码渲染与帧约定）、[WorkBuddy Skill说明](https://open.workbuddy.cn/docs/skill)与[IDE Skills文档](https://www.workbuddy.cn/docs/ide/Features/Skills)（安装入口参考）、抖音AI标识公告的公开转述（发布时以平台当前规则和界面为准）。

explainer规范与本模板同源于 [anything2explainer](https://github.com/Vincentwei1021/anything2explainer)。参考案例仅用于学习手法；不随包分发他人视频或抽帧。本项目无 Anthropic、平台或其他工具官方合作关系。
