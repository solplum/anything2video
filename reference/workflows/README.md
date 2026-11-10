# 先选怎么做，再选长什么样

想要的画风可以保留。下面八条路线回答的是“这部片怎么做”：准备什么、先验证哪一段、采用什么工序、重点检查什么。它们与 [全部画风](../../samples/index.html) 的外观分类是两回事。

| 想做什么 | 制作路线 | 先验证什么 |
|---|---|---|
| 把一个知识点讲明白 | [图解讲解](diagram-explainer.md) | 因果变化是否看得懂 |
| 让观众看到产品怎样完成任务 | [产品演示](product-demo.md) | 操作与结果是否真实 |
| 解释零件、系统或算法如何运转 | [原理拆解](mechanism-breakdown.md) | 结构与读数是否同源 |
| 用原件、照片和地图讲历史 | [档案叙事](archive-narrative.md) | 原件、引文和许可是否可靠 |
| 让绘画、笔触和材料成为叙事语言 | [绘画动画](painted-animation.md) | 一帧和连续材质是否成立 |
| 让一个角色完成有因果的行动 | [角色动画](character-animation.md) | 身份、接触与结果是否连贯 |
| 沿一个空间连续交代信息 | [空间长镜](spatial-longtake.md) | 相机、遮挡和焦点是否成立 |
| 用关键语句和能量变化做短片 | [节奏短片](rhythmic-short.md) | 信息、阅读与节奏是否协调 |

同一画风可进入多条路线，推荐列表不是兼容白名单。比如黏土既能讲供水原理，也能演一个角色故事；对应的准备与验收不能只换一个名字。选择复杂混合片时，按主要制作风险选一条主路线，局部镜头按需借用其他工序，不必读完八篇。

## 已有资源与待做增量

- [早期 Skill、既有作品与视频参考](sources.md)：区分已有移植、方法参考、历史记录和看过的范围。
- [原型与候选子路线](treatments.md)：选项冒险、卡牌对抗、线路叙事和青花显影已接入 `choice-quest`、`card-conflict`、`transit-story`、`porcelain-reveal` 实验图元，具有离线共享 SVG 视频与抽帧证据；标准 Remotion CLI、连续主观运动审片和成片 QC 未完成；补充浏览器与 web-renderer 检查见[浏览说明](../../docs/style-browsing.md)。纸雕灯影、版画长镜、点云测绘三项仍未实现，不计入画风总数。
- 现有 ProductCardProgressiveAssemble、CardFlockTumble、WordRelayGeometry 是已收录的镜头组件；这里新增的是通往整片的工序，不重复记成新资产。

## 四个独立选择

1. **画风**：`styles/catalog.json` 的既有 ID、家族和样片。旧中文名、导入路径、seed 和样片链接保留。目录兼容基础版本的 63 个画风；本整合版新增的 lighttable、choice-quest、transit-story、porcelain-reveal 与 card-conflict 也可识别。它们保留实验状态，基础版本未安装时不会被当作可用图元。
2. **制作路线**：本目录的八种整片工序，记入独立 `research/production-route.json`，不修改旧 `project.workflow` 的含义，也不要求旧工程补字段。
3. **叙事配方**：运行时仍为 `promo`、`explainer`、`epic`。画风默认 recipe 不变；`documentary` 是档案制作文档，不是运行时开关。
4. **剪辑方式**：默认 `standard`；明确需要才用 `match-cut-beat-relay`。与路线和画风独立。

另外，A 代码 / B 分层素材 / C 生成动态 / D 混合是逐镜素材方法。只有明确提供时，选择文件才记录 `materialMethod`；未选时为 `null`，不默认为代码绘制。分镜可以分别采用不同方法，它不会启用外部服务。

## 可用的目录工具

不需要额外依赖，Node.js 运行：

```sh
node scripts/production-routes.mjs list
node scripts/production-routes.mjs treatments
node scripts/production-routes.mjs show 产品演示
node scripts/production-routes.mjs plan --route product-demo --style deep-space
node scripts/production-routes.mjs plan --route mechanism-breakdown --style isometric-anatomy
node scripts/production-routes.mjs check
# 在完整源码或安装包检查所有已引用的源文件：
node scripts/production-routes.mjs check --files
# 测试文件仅随源码提供：
node --test tests/production-routes.test.mjs
```

`plan` 只输出选择 JSON，不写磁盘、不改旧工程、不装依赖、不渲染。确认适用后将输出存入新工程的 `research/production-route.json`，并在 creative-brief 说明理由；现有文件先比较，不直接重定向覆盖。`runtime` 仅是供核对的配置投影，不是完整配置文件。

`runtimeSkin=false` 的画风只返回手动图元路径，绝不把其 ID 自动写入 `config.style`；切换配色也不会自动重画主体。CLI 不读取任意旧工程、不迁移其字段；续作沿用旧流程。

## 本次能力边界

目录和八份工序已可用于选择与查阅。校验覆盖元数据、路径引用和兼容选择，不认证新影片，没有新增自动渲染路线；已接入的五个新增原型仍是手动实验图元。组件、样片、生成通道与全片质量须在实际工程验证。`check --files` 会诚实报告不完整 checkout 中缺少的引用，不将缺文件悄悄视为成功。
