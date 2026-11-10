---
name: token-probability-bars
一句话: 明确标注示意或实测的下一 token 候选分布，先呈现分布再高亮本次选择；真实 token 不必与字或词一一对应
适用: 讲 LLM/生成式 AI 原理的教学片；prompt 演示；任何"模型在预测"的镜头
时长: 一句 prompt 3–6s
能量: 中
标签: typography
---

## 意图
讲"大模型逐 token 生成"最难的点是把抽象采样变成可见事件。本卡把打字
升级成**可视化采样**：先呈现本次条件分布，再高亮被选中的 token 并追加文本。贪心策略总选最高概率项（argmax）；采样可能选中最高项，也允许选中其他项。原参考是作者编排的讽刺 MV，不是模型遥测。用于教学时必须区分示意数据与实测数据，不把剧情梗当成模型概率证据。

## 动效核心
- 主文本：真实模型演示按对应 tokenizer 的 token 边界逐步追加；字/词/短语切分只能标作排版示意，字级时间戳不等于 token 边界。字体不决定分词
- 分布条：追加 token 前显示候选，选择时高亮实际被选项；候选可按概率排序，但不把被选项强制移到第一。全分布概率总和为 1；只画 top-k 时补“其他”余量，或明确标注经筛选后重新归一化的分布。条长使用相同 0–1 比例尺
- 阅读时间：0.3–0.5s 只适合提示性闪现；需要读懂数字的教学镜头应停留或重复，具体由观看验证决定
- 行尾：光标停 2f → ⏎ 符号弹入 → 下一镜触发（flash/zoom/整屏推进落
  downbeat——"回车即引爆"是本卡的章节缝合用法）
- 变体三拍（同一版式换参数，pdoom 三连 prompt 语法）：压迫版（背景同心
  环收紧）/ 困住版（前景竖条逐拍合拢）/ 哀求版（打完后字符间距缓慢漂散）

## 参数表
| 参数 | 典型值 | 调节手感 |
|------|--------|----------|
| 候选数 | 4–5 条仅为版式建议 | 二元分布同样成立；显示多少项按真实数据与阅读需求决定 |
| 停留时长 | 提示可短闪，讲解需可读停留 | 优先观众能读懂，不强制全卡只闪现 |
| 被选 token | 来自声明的采样/贪心策略 | 采样允许非最大项；完整分布或 top-k＋其他的概率和为 1 |
| 条形字号 | ≥ 帧高 3%（aesthetic-rules Q11 辅助线） | 概率数字比候选词再小一档 |
| token 节奏 | 实测用真实事件，示意可自定 | 6–9f/token 只能标示意播放速度，不当作推理性能 |
| 回车引爆 | ⏎ 后 2f 内触发转场 | ⏎ 与转场间隔 >0.3s 读作两个动作 |

## 声音
每 token 打字声（轻，ui-tone 级）；落选条闪现不配音；⏎ 一声 enter 重击
+ 下一镜的引爆音对齐同一帧。

## 已知坑
- 示意候选与数值明确标“示意，非模型实测”；实测需记录模型/版本、tokenizer、上下文、温度及截断/归一化策略。未获概率数据时不要补造实测百分比
- 分布条位置逐 token 跟随其头顶，但避免超出安全区——末 token 的条向下翻
- mono 是视觉选择，不是 token 的定义；一个 token 可以是字、子词、符号或其他字节组合
- 与 ai-stream-response（流式回复 UI）分工：那张卡演"AI 在回复我"，
  本卡演"AI 在猜词"——同片不同镜，不要混用

## 参考实现
mexicat/pdoom-video `app/src/scenes/prompt.ts` 与 `prompt-data.ts`，固定修订 `fa164b74fd0b26a99375715b619c55b4a0fb3d05`。MIT 代码许可不覆盖原曲和歌词；本卡只独立说明呈现与教学边界，不复制其歌词或剧情数据。本仓无 demo，以下仅为测试用数据算例。

<!-- audit-example:probabilities -->
```js
const exampleDistribution = {
  evidence: "illustrative", tokenization: "placeholder_ids", strategy: "sampling",
  candidates: [{token: "t_A", p: 0.5}, {token: "t_B", p: 0.3}, {token: "t_C", p: 0.2}],
  selected: "t_B",
};
const exampleTopK = {
  evidence: "illustrative", basis: "full_distribution",
  candidates: [{token: "t_A", p: 0.5}, {token: "t_B", p: 0.3}], other: 0.2,
};
```

这些 ID 是明确的测试占位符，不代表任何真实 tokenizer 输出；被选 t_B 不是最大项。
