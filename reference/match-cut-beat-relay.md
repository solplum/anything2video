# 可选剪辑模式：匹配剪辑＋节拍接力

把同一含义交给下一个物件、动作或世界，而不是每隔一拍换张图。**这是 editing mode，不是视觉风格、配方、滤镜或一键成片承诺。** 纸艺、黏土、写实、粉笔等都可以搭配；原有风格 ID、`recipe`、`config.style` 与镜头组件不变。仅对明确列出的相邻切点使用匹配规则，其余镜头照旧。

共享授权、稿件、素材、音乐与最终验收只由[统一生产契约](production-contract.md)定义；这里给选择该模式后的实施方法。没有新付费依赖，不要求 Renoise，也不替代已有旁白/音乐授权。可全部用代码做图形预演，或使用已获许可的素材；生成图像/视频另遵守已有通道和预算边界。

## 1. 先写含义，再找形似

在 `research/creative-brief.md` 分开记“视觉风格”和“剪辑模式”，并写一条接力含义与结尾回收：

- 产品片：每个世界确实表达同一个有依据的特性，不因“都是圆的”硬塞不相关物件；引入人物或情境就要有叙事回收。
- 讲解片：球→轮→涡轮可以承接能量传递，但必须交代驱动、接触与结果，不能把比喻当成未经来源支持的事实。
- 纯图形/纸艺练习：种子→太阳→刻度盘可以表达生长、时间和收获的同一概念；这是创作隐喻，不是产品功能证据。

每镜写主体、隐喻、谁推动什么、怎样握持、起始/结束状态。无手的图形可把 grip 写成有理由的 `n/a`，同时声明是图形变换而非真实物理。不要把多个物件的局部角度拼成一个从未完成的“完整开合”。先保全动作、阅读和批准旁白，再挑拍点；切点密度不等于速度感，不靠普遍加速或删阅读停留凑拍。

## 2. 先音乐与便宜预演，后昂贵素材

1. 沿用已选风格/配方和稿件授权，按[音乐流程](music-beat-sync.md)确定可用的音乐真值。录音曲取实测网格；明确选择程序编曲/节拍研究才使用编写网格。节拍不可靠时，不声称音乐锁定：保持原有内容节奏，或在原授权范围内另选可用网格，不能悄悄回退 120 BPM。
2. 画低成本关键状态：统一主体锚点和占比，先检查出镜/入镜配对。可用代码占位物，不必先生成视频；占位物不能冒充已完成镜头。
3. 写下述合同、执行计划检查；在包外独立 `status: "draft"` 工程中，用已有 renderer 制作带实际已选音乐的 animatic。测试节拍的合成 click 可以明确标为研究音轨，不能宣称实际选曲已验证。
4. 按原速带声看完整接力段，再看完整物理动作；修改镜头数、动作窗或切点，保留阅读/情绪 hold。关键状态与节拍成立后才投入视频生成或高成本细化，不从一次静帧通过推导运动通过。
5. 每次改音乐、旁白或源素材后重新锚定、重渲和复核。新 mode 不自动修改镜头、不安装工具、不调用模型，也不自动批准稿件或预算。

## 3. 工程与分镜合同

### 选择是独立字段

在既有 `project.json` 增加：

```json
{"editingMode": "match-cut-beat-relay"}
```

这是字段片段，不是完整工程文件。省略或 `"standard"` 不启用该模式，不改变原有输出。退出已启用的模式时同时移除全片/镜头 `matchCut` 声明，避免留下未生效却看似受检的合同。运行时视觉仍由原风格和已挂载的镜头决定，不能只填字段就声称成片有匹配剪辑。完整可复现输入和使用步骤见[本地例子](../examples/match-cut-beat-relay/README.md)。

### 全片 `storyboard.matchCut`

| 字段 | 类型 / 语义 |
|---|---|
| `schemaVersion` | `1` |
| `meaning` | 接力链表达的含义；非空文本 |
| `heroShotId` | 已存在的镜头 ID：回收含义的主镜头，不规定其百分比位置 |
| `music` | `{kind, path, sha256, outputOffsetSeconds}`，见下节；只引用一份节拍真值 |
| `relays` | 非空数组；只列出要匹配的相邻镜头边界，不要求所有切点都在此表 |

每条 relay：

| 字段 | 类型 / 语义 |
|---|---|
| `fromShot`, `toShot` | 时间线上相邻的出镜/入镜 ID |
| `cut` | `"movement"` 或 `"rest"` |
| `beat` | 从 0 起的拍索引；小数拍在相邻实测秒值间插值，不向范围外推 |
| `reason` | 为何此时切、两个镜头如何承接意义/状态 |
| `soundBridge` | 出镜到入镜的声桥，或有理由的不加 SFX；不是每拍强制加音效 |
| `tolerance` | `{anchor, scale, speed}`，显式选择的非负容差；不是通用美学门槛 |

### 参与镜头 `shot.matchCut`

`subject`、`metaphor`、`cause`、`grip`、`startState`、`endState` 均为非空文本。`actionWindow: {from, to}` 记录**完整关键动作**的全片 1 起含端点帧窗，必须在该镜内；不是素材文件的秒数，也不是 Sequence 的本地帧。镜头已有 `purpose` / `action` / `facts` 继续有效。

`entry` 和 `exit` 描述实际入镜首帧、出镜末帧的匹配主体端点：

| 字段 | 单位 |
|---|---|
| `anchor: [x,y]` | 主体指定匹配点，分别除以画宽/画高，各在 0..1；前后选择同一种参考点 |
| `scale` | 主体最长包围盒边相对画面对应边的占比，在 (0,1]；同一对必须同口径 |
| `direction` | `left / right / up / down / in / out / clockwise / counterclockwise / none`；以最终屏幕/镜头空间为准 |
| `speed` | 平移/深度：主体宽度每秒；转动：转每秒。非负有限数，端点附近实际运动的声明值 |

`tolerance.anchor` 比较两端归一化坐标的欧氏距离（容差最大 √2）；`scale` 和 `speed` 比较绝对差，而非百分比比值（scale 容差最大 1）。容差须根据任务、画幅、主体和预演选择，不能照搬上游某一产品片的数字。工具检查声明，不会从像素测出这些量。

- **movement**：出镜 `exit` 与入镜 `entry` 同一非 `none` 方向，且速度均大于 0；匹配锚点、尺寸与速度差落在本对容差内。相机移动/裁切会改变屏幕方向，须重查实际片段。
- **rest**：两边 `direction: "none"`、`speed: 0`，状态/姿态具有清楚的匹配关系，再开始下一完整动作。开→合等反向接力在休止状态切，而不是把向上动作硬接向下动作。代码不能读懂状态文本是否真的对应，导演必须实查。

没有接触、没有握持的纯图形也可用此合同，但不能用 `n/a` 躲过现实产品的握法与受力检查。不匹配的普通硬切可以不列入 relays；不要把显然不成立的匹配写入再放大容差掩盖。

## 4. 一份音乐真值，原生 fps，最后取整

`music.kind` 只能为 `measured` 或 `composed`；`path` 是工程 `script/`、`analysis/` 或 `research/` 中的 JSON，不放在 QC/渲染输出/缓存目录；`sha256` 为其当前完整 64 位哈希。`outputOffsetSeconds` 单列渲染/封装音轨偏移，不写回源分析。源文件变化必须更新合同并重测，哈希绑定不证明听感或网格质量。

支持既有 `script/beat_grid.json` 的 `{bpm, beats_s, reliable?, bpm_confidence?}`，或 `analysis/music_features.json` 的 `{grid: {...}}`。`bpm` 为正有限数；`beats_s` 至少两项，为严格递增、非负的秒值。实测不等距拍点以 `beats_s` 为准，不从 BPM 重造等距网格。显式 `reliable: false` 对两种 kind 都拒绝，若提供该字段须为布尔值。`measured` 还须 `reliable: true` 或原生 `bpm_confidence >= 3`（沿用 `beat_grid.py` 的 `CONF_MIN`；`audio_features` 嵌套网格可能未写 reliable）。提供的 confidence 低于 3、无效，或两项证据都缺失都会拒绝，不因省略 flag 放行。故意无声工程不可声明 `measured` 音乐同步；可以明确为 `composed` 节拍研究。`composed` 必须明确为编曲合同/人工网格或合成节拍研究，不能把随机手填 BPM 改名成实测曲目。

只读取选定的那一份，不同时维护第二份微调副本；既有 `research/beat-sheet.json` 仍记事件意图和对应拍号。稀疏/不可靠拍列不走 `common/music.ts` 的合成回退，不外推不存在的拍。缺少某次切点需要的拍点就修正数据/设计，不悄悄猜。

设拍号 `b = i + f`，`i = floor(b)`、`0 ≤ f < 1`：

```text
seconds = beats_s[i]                         # 整数拍
seconds = beats_s[i] + f * (beats_s[i+1] - beats_s[i])  # 小数拍
cutFrame = round((seconds + outputOffsetSeconds) * project.fps) + 1
Sequence.from = cutFrame - 1
```

检查要求 `toShot.from === cutFrame`；量化误差单独报告，不通过累计“每拍几帧”生成下一拍。工程沿用当前契约支持的正整数 fps；不硬编码 25 fps / 150 BPM，也不借此增加当前管线尚未支持的分数 fps。24 fps / 96 BPM 或 60 fps / 137 BPM 都应从绝对秒值最后换算；相位不是默认 0。改变 fps 后重算所有边界，不把源网格的旧 `beats_frame` 直接抄入新项目。

这只证明计划对格。渲后仍按[音乐回测](music-beat-sync.md)检查实际编码音轨与画面，区分源拍点误差和帧量化误差，完整听取声桥、音乐接缝和结尾。

## 5. 本地校验与既有审片包

不需要联网或生成服务：

```sh
node <skill>/scripts/check-plan.mjs <工程>
node <skill>/scripts/match-cut-plan.mjs <工程>
# 先检查成功，再保存请求。qc 是工程保留产物目录。
mkdir -p <工程>/qc
node <skill>/scripts/match-cut-plan.mjs <工程> --review-request > <工程>/qc/match-cut-request.json
node <skill>/scripts/review-pack.mjs <工程> plan qc/match-cut-request.json
# 已准备工程依赖和渲染能力时，才执行真实片段/静帧渲染：
node <skill>/scripts/review-pack.mjs <工程> render qc/match-cut-request.json
```

`match-cut-plan` 只校验合同/音乐源和生成请求；不产生视频、不判“丝滑”、不自动填 `passed`。请求把明确的完整动作窗、切点和端点交给[批量审片包](action-review.md#batch-review)，仍走同一完整计划/类型/哈希检查与 renderer。重复运行先选新 review id，不能覆盖旧审核证据。计划模式的结果仍未渲染；渲染成功也只是待审。

## 6. 原尺寸＋真实片段的 QA

按既有 visual / motion / audio / teaching 检查记录，不另造替代最终 QC 的绿色标签：

1. **原尺寸静帧**：实际使用的出镜末帧、入镜首帧与邻帧；检查主体位置/尺寸、产品身份/可见面/结构、手指和握法、接触/遮挡/受力、灯光和曝光突变。局部 ROI 放大同时保留全画面上下文。
2. **动作全过程**：预备→接触→转移→释放→稳定，按该动作实际阶段查看；不能只看头尾。检查中途手形变化、漂移、穿帮和终态不足。重要手/产品缺陷是阻塞，不用“已知偏差”带过。
3. **每次接力**：出镜末段＋入镜首段原速连续带声播放。运动切核对方向/速度，休止切核对姿态/稳定；视觉焦点不要重新寻找。动作完成、读数可读、旁白因果优先，合法静止仍合法。
4. **整片回归**：看整体节奏和主镜头回收，听所有声桥、音乐接缝与结尾。最终完整范围与媒体/源码哈希仍按[最终 QC](production-contract.md#final-qc)核对。

contact sheet、1 fps 抽帧、计划测试和几何声明只定位问题，不能证明连续运动、音画卡点或听感；未实际播放/听取就保持 `not_performed`，审片包保持 `needs_review`。不能把参考片的抽样看图写成已验证其流畅度。

## 来源与取舍

方法参考 [Sac-Y/match-cut planning](https://github.com/Sac-Y/match-cut/blob/main/references/planning.md) 和 [review](https://github.com/Sac-Y/match-cut/blob/main/references/review.md)，2026-10-30 核验；保留 [MIT 版权及许可](../LICENSE-THIRDPARTY/MIT-match-cut.txt)。本仓独立实现计划校验与既有审片链衔接，未引入上游脚本、演示视频、品牌图片或付费服务。

吸收的是有含义的接力、动作合同、先预演后细化、原尺寸与全过程审核。不沿用上游固定时长/画幅/fps/BPM、默认英文、模型/provider、统一黑底、全片禁 hold 或特殊预算授权方式。MIT 不等于参考片里的商标、产品图片、音乐或口号已获授权。
