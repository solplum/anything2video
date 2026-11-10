# 早期作品、Skill 与视频参考

此索引把已有材料接回制作路线，不把旧资产重新算作新增，也不把“参考过”写成“已整片复验”。仓库既有路径核对基于 `8626d3bd91d779e56ea63a48e55ce827c7df13f8`；初版外部来源记录于 2026-11-03；2026-11-04 更正遗漏来源、草稿状态、若干数值及当前许可边界，具体文件与版本见[更正记录](../reference-corrections-2026-11-04.md)。这不表示已重新观看所有源影片。外部链接可能变化，实际采用前核查对应修订版本和文件许可。

## 既有资产如何进入整片

| 来源 | 现在已有 | 接入路线 | 仍需完成 |
|---|---|---|---|
| [anything2explainer](../explainer/README.md) | 历史文档、RAG 镜头源码与对照帧 | 图解讲解 | 本题的解释模型、事实绑定与真实教学验证 |
| [video-shotcraft](../../gallery/README.md) | 卡库、demos-ref、lib-ref、公共 kit | 产品演示、原理拆解、节奏短片、空间长镜 | 从单镜头编排到全片因果与能量结构 |
| [mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) | 弹点、线沸、墨版、公路夜、软糖、锁定等既有重写 | 图解讲解、绘画动画、节奏短片 | 复验签名与实现质量，不能再加同名 15 张卡 |
| [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) | 多种绘画图元、一帧先行、A/B/C/D 素材方法 | 绘画动画、角色动画 | 本片图层、真实动作与材质连续性 |
| [lanshu](https://github.com/cclank/lanshu-create-ai-presenter-video) | 波普、立体书、黏土、影棚长镜的既有重写 | 产品演示、角色动画、空间长镜 | 本片空间与动作，非真人口播自动化 |
| [Anatomy](../../styles/isometric-anatomy/SPEC.md) | 等距机械图元、装配与读数方法 | 原理拆解 | 缺随包预览，先做实渲因果闭环 |
| [铜版雕刻](../../styles/engraving/UPSTREAM.md) | 现有随形排线引擎、横竖屏研究 | 绘画动画、档案叙事 | 原创主题的镜头与声音，现有仅 12 秒无声研究 |
| [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) | 8 张方法卡，引用外部场景，本仓没有对应 demo | 节奏短片 | 完整结构、论据与阅读时间；概率示意与事件引信已更正，不把原曲当作获授权素材 |
| [cinetic](https://github.com/Leonxlnx/cinetic) | [15 张草稿配方](../../gallery/cards/ATTRIBUTION.md)，均未提供本仓实现/演示 | 产品演示、原理拆解、节奏短片 | MIT；先实现与动态回验，不能把配方数量当组件数量；错峰/低通/缩放 fps 换算见更正记录 |
| [xilo-opus-video](https://github.com/Kianzzz/xilo-opus-video) | [导演手册](../directing-playbook.md) 已明确借鉴：差异化方向小样、确认 brief、逐镜检查与选择性重做 | 各路线的准备与审片 | 历史方法借鉴，不只是发现索引；MIT 代码文档不替代本片素材权利与实渲验收 |
| [video-talkcraft](https://github.com/Vincentwei1021/video-talkcraft) | [DotFieldBg](../../template/src/common/DotFieldBg.tsx) 头注明确点阵幕底移植 | 产品演示的现有幕底；不是完整口播管线 | 当前 PolyForm Noncommercial 1.0.0；不是 shotcraft 的 Apache-2.0。未查到覆盖本地该移植的进一步特别许可，发布/商用前须确认适用历史版本与授权范围 |

详细许可继续保留在 [第三方许可](../../LICENSE-THIRDPARTY)、[kit 出处](../../template/src/common/kit/ATTRIBUTION.md)、[风格说明](../../styles/README.md) 和各卡中，不用本索引替代。

## 之前提到的 Skill，分别放在哪里

| 参考 | 使用方式与路线 | 本次边界 |
|---|---|---|
| [vibe-knowledge](https://github.com/andyhuo520/vibe-knowledge) | 游戏叙事→角色动画；线路叙事→图解讲解；青花显影→绘画动画 | 看过上游 RPG/cards/metro/qinghua 静帧，源运动描述来自 STYLE；本地另有独立实现的 choice-quest、card-conflict、transit-story 与 porcelain-reveal 无声原型及离线共享 SVG/抽帧证据，不是上游动态等价证明；[NOTICE](https://github.com/andyhuo520/vibe-knowledge/blob/main/NOTICE.md) 区分 MIT 代码文档与不随许可开放的演示作品，未复制样图/视频/BGM |
| [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | 现有雕刻；纸雕灯影/版画长镜→空间长镜；点云→原理拆解 | 新候选来自 STYLE，未新看动态；演示素材、声音与第三方资产许可分别核对，不能由代码 MIT 推导全部素材许可 |
| [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | 角色设定、转面、表情过渡→角色动画 | 方法参考，未整体引入表演引擎；示例角色及依赖另核 |
| [match-cut](https://github.com/Sac-Y/match-cut) | 已有跨路线剪辑模式 | 保留 [本仓接力合同](../match-cut-beat-relay.md)，不当成画风；品牌片示例不是可直接复用的产品素材 |
| [huashu-motion](https://github.com/alchaincyf/huashu-motion) | 词锚点、到达与揭示、局部修订→各路线 | 区别于 huashu-art-motion；不复制独立授权的作者形象或另建通用引擎 |
| [pixelfx](https://github.com/patch-gg/pixelfx) | 预备/接触/恢复效果→角色动画和游戏候选 | 仅方法参考，随机访问帧需先验证确定性；Patch Pixel 字体不随 MIT |
| [motion-prompt](https://github.com/showheyohtaki/motion-prompt) | 动效词汇可发现性→图解与节奏 | 未宣称新增整套组件；实际移植须保留文件级出处 |
| [animate](https://github.com/cth9191/animate) | 因果节拍、身份与形变→角色动画 | 已独立吸收部分方法，不再复制相似画风或替换渲染器 |
| [vibe-knowledge-film](https://github.com/HeyChengC/vibe-knowledge-film) | 最难镜头先试、遮字幕动作检查→角色/图解 | 与上方 vibe-knowledge 是不同项目；不复制其排除授权的参考片文字、设计与示例 |
| [story-studio](https://github.com/konlu/story-studio) | 事实/争议/演绎与编辑单位的研究参考 | **当前许可 CC BY-NC-SA 4.0，旧 MIT 记录已过时。** 本次不移植其代码/文档/素材；仅独立说明一般事实核对方法 |
| [video-editor-skills](https://github.com/appariciojunior/video-editor-skills) | 实录剪辑是今后独立能力，不等于图解制作 | CC BY-NC 4.0，另有 DaVinci Resolve Studio 依赖；不引入当前包或宣称已支持该管线 |

上表加上上一节的已收录 Skill，记录本轮找到的历史参考；没有精确出处的旧对话或作品不补造，不以“新来源数量”当新增能力数量。一般方法可独立设计，实现与素材的许可仍分别保留。

许可补充：anything2explainer 当前上游为 PolyForm Noncommercial 1.0.0，本仓 [vendored README](../explainer/README.md) 保留两仓共同作者的特别许可说明；未证实该说明覆盖新增上游内容或 video-talkcraft。保留历史移植与许可文本，不以当前上游许可单独断言历史使用违法，也不推定授权自动扩展。

[JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) 是另一个历史作品参考，不是上述八张卡的 mexicat 来源；本轮未建立其代码/歌曲的复用许可。[awesome-ai-motion](https://github.com/guanmo-ai/awesome-ai-motion) 是发现索引，不计作直接移植的 skill，索引 MIT 不覆盖所链接的第三方作品。

## 实际视频参考与观看范围

以下四片过去检查过抽帧和指定窗口，不等于本次完成原速整片播放或听取。链接指向外部参考，不在仓库重新分发其视频。

| 视频 | 历史观察窗 | 本仓落点 |
|---|---|---|
| [产品卡逐层装配](https://vincentwei1021.github.io/video-shotcraft/media/product-card-progressive-assemble.mp4) | 0.2–4.3s 抽帧：框架、内容、价格与 CTA 顺序 | 已有 `ProductCardProgressiveAssemble`，接产品任务的证明链 |
| [卡群翻转](https://vincentwei1021.github.io/video-shotcraft/media/card-flock-tumble.mp4) | 2.1–2.8s 抽帧：卡群收拢与标题 | 已有 `CardFlockTumble`，作为局部转场 |
| [爆炸拆解](https://vincentwei1021.github.io/video-shotcraft/media/exploded-view.mp4) | 1.0–4.5s 抽帧：分层、标注、阴影、回装 | 原理拆解动作参考；历史观察曾记约 0.63–0.80s 短暂消失，使用前复验 |
| [文字几何接力](https://vincentwei1021.github.io/video-shotcraft/media/word-relay-geometry.mp4) | 1.8–3.6s、4.1–5.3s 抽帧 | 已有 `WordRelayGeometry`，表达关系而非增加一个画风 |

[match-cut iPhone](https://github.com/Sac-Y/match-cut/blob/main/examples/iphone-duo/README.md) 与 [Big Mac](https://github.com/Sac-Y/match-cut/blob/main/examples/big-mac/README.md) 的既往检查是 1 fps contact sheet，不足以认证连续动作或声音。没有实际附件的“对比见视频”与泛指的火柴人救援题材不补造出处。

## 历史作品不改写成当前认证

- [style-ledger](../style-ledger.md) 保存《命》、anything2video 自宣传、shotcraft-promo 与各批样片记录。
- [RAG 参考](../explainer/sample-rag/README.md) 保留解释型整片的素材与实现上下文。
- [manifest](../../samples/manifest.json) 保留每个样片来源与音轨信息。
- `lighttable`、`choice-quest`、`transit-story`、`porcelain-reveal` 与 `card-conflict` 已在本整合版注册为手动试验图元；各自初始验证记录保留。后四者分别通过 `choice-adventure`、`transit-story`、`cobalt-reveal` 与 `card-conflict` 子路线发现。补充 TypeScript、真实浏览器和 web-renderer 证据见[浏览说明](../../docs/style-browsing.md)，不据此宣称标准 CLI 或整片验收通过。

这些材料决定“可借什么”，本片的真实渲染、播放、听取和最终 QC 决定“完成了什么”。
