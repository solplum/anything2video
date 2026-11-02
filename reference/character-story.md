# 角色动作故事：可选合同与实渲验证

保留 Remotion 和既有风格、稿件授权、三轮 QC、jury 与审片包；本专题不新增审批门，不把 63 个风格再复制一份。适用于有明确主体行动的短故事。史实叙述、纯讲解或刻意静止不必强行改造成角色旅行。

## 先判断故事是否成立

在 creative-brief 中记录：谁想得到什么 → 什么阻碍他 → 他尝试了什么 → 行动造成什么可见变化。主角、道具保留稳定识别特征，不靠字幕给任意几何块贴身份。结尾可以失败或保持克制，不强制成功学反转。

真实故事先做事实卡：来源、可证事件、争议/未知、允许的演绎边界。不得补写未经证实的对白、遗言、内心或具体救人动作。镜头沿用 `claims` / `shot.facts` 的唯一事实绑定，不另建一套事实时间线。来源存在只证明登记，不证明可信、许可或画面忠实。

先以现有风格制作 2–4 张身份/构图帧和最难动作的短实渲，再按片长需要制作短 animatic/样片。30 秒是长片试样的可选上限起点，不把 8 秒练习凑成 30 秒。用户批准的文案、音乐和画幅不因这条流程被重写。

## 可选 storyboard 扩展

不声明 `story` 的旧工程保持原验证行为。声明后，`check-plan` 校验注册表、引用、因果字段、时间范围与事实绑定；**不判定故事好看、不自动识别画面接触**。完整可运行合成例见 [character-action-contract](../examples/character-action-contract/README.md)。它不是《谷底》或《够得到》V3 的续作。

```json
{
  "story": {
    "schemaVersion": 1,
    "kind": "fiction",
    "characters": [{"id":"hero","identity":"圆帽、蓝衣，始终保留同一轮廓"}],
    "props": [{"id":"pot","identity":"一盆有轮子的陶盆花"}]
  }
}
```

在既有镜头上按需声明 `shot.story`：

```json
{
  "actor":"hero",
  "goal":"让花得到阳光",
  "obstacle":"花盆在阴影里",
  "attempt":"走近并推花盆",
  "outcome":"花盆进入阳光，花瓣展开",
  "before":"花盆在阴影里，花瓣闭合",
  "after":"花盆在阳光里，花瓣展开",
  "actions":[{
    "id":"push", "actor":"hero", "prop":"pot",
    "ownerBefore":"world", "ownerAfter":"world",
    "phases":{
      "anticipation":[76,90], "contact":[91,96], "support":[97,150],
      "release":[151,165], "settle":[166,210]
    }
  }]
}
```

这组数字只适用于覆盖这些帧的镜头。五阶段用于**选定的接触动作**，不是所有运动的通用物理模型：预备、接触、持续承重/推动、释放、落定。每阶段是全片 1 起含端点整数范围，必须在其镜头内，按序不重叠，可留有说明的间隔；Remotion 0 起帧只在渲染入口转换一次。没有接触动作的标题/过渡镜头可不声明 `shot.story`，不虚构接触阶段。`ownerBefore/After` 取角色 ID 或 `world`，用于审查道具转移；不表示代码已模拟了所有权或物理世界。

改编作品 `story.kind="adaptation"` 还需 `story.factualBoundary`。每个已声明的故事镜头加 `evidence:{kind:"documented"|"dramatized",note:"具体说明"}`；documented 必须有非空合法 `shot.facts`，dramatized 必须明确注明象征/压缩/演绎，不把它当史实。身份 ID 与动作 ID 只能用安全 ASCII 字符；旁白与可见名称仍可中文。

## 动作窗接回现有审片包

`review-pack` 的默认 `automatic.storyActions=true` 读取已声明的五阶段，各加 `cutContextSeconds` 上下文（夹到所属镜头），保留精确阶段起止静帧，并复用已有动作条带生成。它不猜测动作时刻。`automatic.storyActions=false` 可关闭；`automatic:false` 关闭全部自动选择，改用明确 windows/cues/stills。旧镜头没有 `story`，不会凭空增加媒体。仍受 128 片段/512 静帧预算，超限明确报错，不能默默少看。

审查顺序：
1. 隐藏字幕，让未读脚本的人说明“谁想做什么、障碍是什么、行动改变了什么”。记录真实回答；看不懂就改镜头，而非补一屏解释。
2. 原速看动作，再检查接触邻帧：脚底承重、手与道具、遮挡、道具归属、释放和落定。画面不应在手接触前自行滑走。
3. 用当前成片/源码哈希记录观察；纯结构测试、姿态数值、接触表都不能代替真实运动和独立审美评价。

## 局部修改，不重写整片

`checkStoryActionEdit(before, after, {shotId, actionId})` 仅允许目标动作 `phases` 改动，其他 storyboard 字段变更会拒绝。它是测试/复核 API，**不是自动修复工具，也不检测源码、音轨或风格文件**。另比较源文件、音乐/旁白、风格 token 哈希，并看变更动作前后相邻片段；改错的叙事即使哈希检查通过仍不合格。

示例同时生成 contact 提后 0.5 秒的版本。本环境的 Chromium 因 socket 权限受阻；交付证据是同一 `CharacterActionFrame` 组件经 ReactDOMServer → 系统 SVG 栅格器 → FFmpeg 的 component-frame proof，不宣称原生 Remotion 渲染或跨渲染器像素一致。仅时序数据改变；背景、相机、静态构图与无声声明保持不变。原速播放、抽帧和像素差异只覆盖该合成用例，不证明万能角色引擎。

## 参考与许可边界

独立实现本合同与示例。方法参考：
- [animate](https://github.com/cth9191/animate)：角色身份与因果节拍（MIT 自有代码/文档）。
- [vibe-knowledge-film](https://github.com/HeyChengC/vibe-knowledge-film)：最难镜头先试、遮字幕检查真实动作；不搬其未授权参考片/示例画面。
- [story-studio](https://github.com/konlu/story-studio)：事实、争议、演绎分开；不复制第三方语料。
- [pixelfx](https://github.com/patch-gg/pixelfx)：预备/接触/反应；不引入保留权利的字体或状态式粒子引擎。
- [huashu-motion](https://github.com/alchaincyf/huashu-motion)：时间、元素与源码定位的局部修订思想；不搬作者形象或独立许可依赖。

没有引入新的渲染器、字体、音乐、参考片或 CC BY-NC 的 video-editor-skills 内容。其他素材仍逐项登记许可。
