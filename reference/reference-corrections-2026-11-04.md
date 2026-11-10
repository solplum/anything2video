# 历史参考适配更正 · 2026-11-04

本记录更正本地配方/来源表，不增加风格或宣称新完整组件。原有源码与许可副本保留；Anatomy 仅补接口注释，没有改变行为。配方里的 JavaScript 是可执行的文档算例，Node 测试可检查其数学与状态，不等于 Remotion 接入、动态审看或成片认证。未复制上游曲词、视频、角色、字体或其他媒体。

## 更正与证据

| 位置 | 原问题 | 更正 | 固定来源 |
|---|---|---|---|
| cinetic 15 张卡头部及来源表 | 草稿卡写成“实现重写” | 改为独立整理的草稿配方，全部仍无本仓实现/演示；本地相似能力不归零 | [SKILL](https://github.com/Leonxlnx/cinetic/blob/ecfa6605de1adb9345ce937724810dc32267d068/skills/cinetic/SKILL.md)、[配方库](https://github.com/Leonxlnx/cinetic/blob/ecfa6605de1adb9345ce937724810dc32267d068/skills/cinetic/assets/library/techniques.json) |
| exploded-layer-stack | 12f@60 的总错峰抄成 6f@30 每层 | 总 span=6f；n 层按 i/(n−1) 分配，单层为零 | 同配方库 `d3-exploded-layer-stack` |
| fit-bounds-follow | alpha 的跟随/滞后解释相反 | 大 alpha 更快、小 alpha 更滞后；固定目标的跨 fps 等效 alpha=1−(1−alpha0)^(fps0/fps)，0.07@60→0.1351@30 | 同配方库 `cam-fit-bounds-follow` |
| scale-through-cut | 时长减半但每帧缩放率不换；余量收敛期限错 | 使用秒制对数速度，固定局部速度时 ratio30=ratio60²；衰减作用于 k−1；S0=8–9 要 19–20f@30 才到 0.01 阈值 | 同配方库 `tr-scale-through-cut`、[camera.ts](https://github.com/Leonxlnx/cinetic/blob/ecfa6605de1adb9345ce937724810dc32267d068/skills/cinetic/assets/remotion-starter/src/lib/camera.ts) |
| token-probability-bars | 把剧情分布当教学规则，要求最高项入选且总和不限 | 区分示意/实测、token/排版分块、采样/贪心；全分布或 top-k＋其他归一，使用统一比例尺 | [prompt-data.ts](https://github.com/mexicat/pdoom-video/blob/fa164b74fd0b26a99375715b619c55b4a0fb3d05/app/src/scenes/prompt-data.ts)、[prompt.ts](https://github.com/mexicat/pdoom-video/blob/fa164b74fd0b26a99375715b619c55b4a0fb3d05/app/src/scenes/prompt.ts) |
| fuse-burn-reveal | 将恒速写成硬限制并归于源项目 | 上游 burnKnots 是声乐事件到达映射；恒速仅本地可选适配，文档算例验证时间到弧长比例的单调映射 | [fuse.ts](https://github.com/mexicat/pdoom-video/blob/fa164b74fd0b26a99375715b619c55b4a0fb3d05/app/src/scenes/fuse.ts) |
| AnatomyDial / SPEC | “同源同频”容易被误读为组件自动提供 | 明确 angleDeg/valueText 为独立展示参数；提供同一位移推导角度/文字的文档算例。不声称发现了真实调用错配 | [本地接口](../styles/isometric-anatomy/anatomy.tsx)、[上游模型示例](https://github.com/wheresryan22/anatomy/blob/1482e8469b0a9e0d8cc18ea2740a01423d29ae80/examples/ripple-tank/model.mjs) |

## 遗漏来源与许可边界

- **cinetic**：本地 `gallery/cards/ATTRIBUTION.md` 和 MIT 副本已记录，不是新发现的新能力。当前复核版本 `ecfa6605de1adb9345ce937724810dc32267d068`，MIT、Leonxlnx；没有整体复制其60fps默认、随机选卡或审美禁令。
- **xilo-opus-video**：本地 `reference/directing-playbook.md` 已明确标注历史方法借鉴。当前 [SKILL](https://github.com/Kianzzz/xilo-opus-video/blob/f2cd828e2692e7186186408ee01a936707c2c38d/skills/xilo-opus-video/SKILL.md) 与 [LICENSE](https://github.com/Kianzzz/xilo-opus-video/blob/f2cd828e2692e7186186408ee01a936707c2c38d/LICENSE) 为 MIT、周行（Kianzzz）。不是新增画风或新导入引擎。
- **video-talkcraft**：本次记录所审计的历史版本 `template/src/common/DotFieldBg.tsx` 明确写“移植”，其点阵公式与当前 [backdrop.tsx](https://github.com/Vincentwei1021/video-talkcraft/blob/a7c29edfb2404612dde6a5a1c8aa94232e85625b/template/motion-systems/backdrop.tsx) 匹配。当前 [LICENSE](https://github.com/Vincentwei1021/video-talkcraft/blob/a7c29edfb2404612dde6a5a1c8aa94232e85625b/LICENSE) 为 PolyForm Noncommercial 1.0.0，不是姊妹库 shotcraft 的 Apache-2.0。现有 explainer 特别许可说明未明确包含 talkcraft；本轮未取得进一步授权证据，不因此倒推历史版本违法，也不宣称商业使用已获许可。2026-11-04 审计补丁未新增复制或修改该移植源码。后续 2026-11-10 的工程重写、兼容保留及未解决许可事项见 [来源记录](workflows/sources.md#点阵与共享纹理重写2026-11-10)，不以重写追溯改变历史许可。
- **anything2explainer**：当前 [LICENSE](https://github.com/Vincentwei1021/anything2explainer/blob/735c79c8724e897e8971cd59dde7e5aa11e4d6ce/LICENSE) 为 PolyForm Noncommercial 1.0.0；保留本地特别许可说明，不把它扩展到任意新上游内容。
- **mexicat/pdoom-video**：代码 MIT，Giacomo Magnanini；歌曲/歌词明确排除。与 JohnHeibel/PDoomVideo 分开记载，后者本轮未确立复用许可。

这些是版本与证据边界说明，不是法律结论。发布前按具体使用与授权复核；现有许可文本没有替换或删除。

## 可重跑验证与限制

    node --test tests/reference-corrections.test.mjs

测试直接提取卡片中的标记 JavaScript 算例，覆盖 fps 等价、层数边界、低通响应、宏观阈值、归一化数据、非 argmax 采样示例、事件引信的正序/乱序访问及单一读数状态，并检查来源/草稿/许可措辞。没有运行新 Remotion demo，没有上游视频播放或听音；这些静态/数值测试不能证明画面可读、动作顺畅或媒体权利已全部落实。
