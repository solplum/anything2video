# 子路线：四个实验原型与三个候选

这些条目来自此前的真实来源。本整合版已把选项冒险、卡牌对抗、线路叙事与青花显影接到 `choice-quest`、`card-conflict`、`transit-story`、`porcelain-reveal` 手动实验图元，其余三项仍未实现。原型具有离线共享 SVG 渲染视频与抽帧检查，不代表标准 Remotion CLI、连续主观审片或完整成片验收已经完成。基础版本没有安装该图元时，目录仍可查阅，但不会将它报告为可用。

使用原件、数据、生成服务或外部代码前分别核实实际能力与许可。只看过静帧的项目不写成“动态效果已验证”；不复制上游演示图/片段作为新原创样片。

<a id="choice-adventure"></a>
## 选项冒险 · 角色动画 / 游戏叙事

来源：[vibe RPG](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/rpg/STYLE.md)、[Lemo pixel RPG](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/pixel-rpg/STYLE.md)。前者仅静帧已看。

- 输入：主角目标、可选行动、状态、规则与每个选择的后果。
- 顺序：状态转移表 → 原创场景与角色身份 → 选择动作 → 可见后果 → 结尾回收。
- 先做：一次选择真正改变角色或世界的短片，而非只有像素 UI。
- 检查：选择前后能对照，奖惩与行动有关；比喻属性不得冒充实测数据。
- 已实现原型：[choice-quest 图元](../../styles/choice-quest/SPEC.md) 和 [18 秒无声示例](../../examples/choice-quest/README.md)，包含状态驱动选择、资源消耗与可见空间后果，独立于 `pixel-arcade` 外观。
- 证据：[verification.json](../../examples/choice-quest/verification.json) 记录离线共享 SVG → 系统栅格器 → ffmpeg 视频及抽帧检查。该文件保留初始记录；后续 TypeScript、真实浏览器控制和 web-renderer 的有界检查见[补充验证](../../docs/style-browsing.md)，不替代标准 CLI、连续主观审片或最终成片 QC。
- 仍需：验证标准 CLI 路径、连续主观观看完整动作与分支，再为用户主题制作并验收整片；此原型不代表上游效果等价或通用角色引擎。

<a id="card-conflict"></a>
## 卡牌对抗 · 角色动画 / 游戏叙事

来源：[vibe cards](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/cards/STYLE.md)，仅静帧已看。

- 输入：对抗双方、规则、资源、动作与可解释的胜负/状态变化。
- 顺序：规则表 → 原创卡面与场地 → 出牌/作用/结算 → 可见状态更新。
- 先做：一轮完整的“选择→作用→结果”，包括卡牌的接触、移动和遮挡。
- 检查：观众理解为何变化，卡面长文字可读，拟人化结论不替代事实论据。
- 已实现原型：[card-conflict](../../styles/card-conflict/SPEC.md) 用同一纯规则引擎驱动选牌、资源支付、防护、对手接触、结算与目标物件变化；含灯塔与种子两组原创场景、反事实选择和去文字审查。
- 证据：[初始验证](../../examples/card-conflict/verification.json) 和 [16 秒无声样片](../../examples/card-conflict/README.md) 保留源指纹、26 项测试、TypeScript 与离线共享 SVG 渲染范围；全源整合、浏览器与 web-renderer 另见[补充验证](../../docs/style-browsing.md)。
- 范围：只支持 16:9，规则值是虚构演示，不是实测数据。没有通用对战游戏、标准 CLI 成功、连续主观审片或最终声音/成片验收声明；已有产品卡入场不是对抗系统。

<a id="transit-story"></a>
## 线路叙事 · 图解讲解

来源：[vibe metro](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/metro/STYLE.md)、[Lemo transit map](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/transit-map/STYLE.md)。vibe 静帧已看，动态未看。

- 输入：事件/关系图、分支、停顿与汇合的真实含义。
- 顺序：图结构 → 路线布局 → 到站事件 → 标签揭示 → 回看主线。
- 先做：一个有分支和汇合的段落，先确认图本身准确。
- 检查：未发生的站点不提前误导、线交叉与换乘可区分、标签不互挡。
- 已实现原型：[transit-story](../../styles/transit-story/SPEC.md) 提供事件驱动节点、分支汇合、先到等待、条件换乘、延迟与阻塞对照；[五版样片与验证](../../examples/transit-story/README.md) 为离线共享 SVG 实渲与抽帧检查。
- 范围：原创平面因果线路，不是单纯 draw-on 或红色 line-art；Lemo 的纸面透视、纸纤维与真实空间相机处理仍未实现。标准 Remotion CLI、连续主观审片与成片 QC 不据此通过。

<a id="cobalt-reveal"></a>
## 青花显影 · 绘画动画

来源：[vibe qinghua](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/qinghua/STYLE.md)，仅静帧已看。

- 输入：原创或授权的完整钴蓝白底画面、叙事焦点、信息安全区。
- 顺序：画面设计 → 分层/显影遮罩 → 浓淡扩散与留白 → 代码文字合成。
- 先做：主体轮廓、材料与显影顺序都清楚的一段，不以蓝色滤镜代替。
- 检查：扩散不毁形、文字无生成乱码、前后镜头材料一致。
- 已实现原型：[porcelain-reveal](../../styles/porcelain-reveal/SPEC.md) 使用原创莲塘双鱼、固定种子多点渗化、湿边积色和定色；[横竖屏 14 秒无声样片](../../examples/porcelain-reveal/README.md) 由共享 SVG 核心实渲。沿用 `cobalt-reveal` 子路线 ID，不新增同名候选或运行时皮肤。
- 证据：[原始验证](../../examples/porcelain-reveal/verification.json) 保留独立原型阶段记录，整合与补充检查见[浏览说明](../../docs/style-browsing.md)。标准 Remotion CLI 已尝试，但 Chromium 启动受阻；目录记录 `blocked`，没有成功渲染认证。
- 范围：程序原创平面画心，不等价于参考整幅画作的丰富度，不是真实流体或制瓷仿真。替换画作须核实原创/授权并重验显影覆盖与留白；生图通道、费用及最终成片验收另核。

<a id="paper-lightbox"></a>
## 纸雕灯影 · 空间长镜

来源：[Lemo paper-lantern](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/paper-lantern/STYLE.md)，本次仅读规范。

- 输入：平行纸层、孔洞轮廓、背光、各层间距与相机范围。
- 顺序：层叠草模 → 原创镂空遮罩 → 背光/层间影 → 受约束的运镜与主体动作。
- 先做：一次相机移动揭示真实层间关系的短片。
- 检查：透光与遮挡一致、纸层不互穿、阴影随空间而不是贴在屏幕上。
- 缺口：光箱结构与材料组件，不等同于平面拼贴、皮影幕布或铰链立体书。

<a id="printed-longtake"></a>
## 版画长镜 · 空间长镜

来源：[Lemo printed-long-take](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/printed-long-take/STYLE.md)，本次仅读规范。

- 输入：深度场景、连续相机路径、固定在物体/世界坐标的墨线与纸切面。
- 顺序：灰模路线 → 深度层 → 随形刻线与单一重点色 → 完整长镜回看。
- 先做：视角改变时刻线仍稳定附着的连续段落。
- 检查：墨线不游泳、不闪烁；空间关系、焦点与文字可读性不被纹理遮住。
- 缺口：世界坐标材质与镜头整合，不是给影棚套一个排线后处理。

<a id="measured-pointcloud"></a>
## 点云测绘 · 原理拆解 / 实证数据

来源：[Lemo lidar-survey](https://github.com/lemomo-ai/lemo-opuscar/blob/main/styles/lidar-survey/STYLE.md)，本次仅读规范。

- 输入：真实数据集、来源许可、坐标系、尺度与可复算测量结果。
- 顺序：来源与单位核查 → 导入/归一化 → 分类层与测量 → 点到面的解释镜头。
- 先做：一个能从源数据复算的量，而非散点“扫描”特效。
- 检查：原坐标到画面坐标可追溯，测量尺度正确，抽样/降采样不能伪造精度。
- 缺口：数据导入、测量与误差验证。没有数据时只能叫“示意点云研究”，不能叫测绘证据。

[返回制作路线](README.md) · [来源与许可边界](sources.md)
