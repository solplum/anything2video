---
name: fuse-burn-reveal
一句话: 一条引信线烧过画面，烧点过后炭化碎裂，新内容从烧点后方展开
适用: 倒计时/导火索类叙事（「接下来会发生什么」）；章节缝合；时间线推进
时长: 2–4s
能量: 递增（烧到终点最高）
标签: transition
---

## 意图
"接下来"的演法多是擦除或推进——物理感弱。引信是文化里现成的倒计时
装置：一条线烧过去，烧点后是炭、烧点前是未知的引线，观众的自然预期是
「烧到头就炸」。本卡把这个预期变成章节缝合器：上一章的内容挂在引信上，
烧过即炭化告别，新内容从烧点后方长出来。

## 动效核心
- 引信路径：折线或贝塞尔横贯 0.6–0.8 屏宽（可绕过画面主体元素走位）
- 烧点：亮点 + 火花（3–6 颗 ktHash 撒点、半衰期 ~10f）；路径距离由时间函数决定；可恒速，也可按词/事件到达点变速，不把恒速当源实现事实
- 炭化：烧过段颜色降为炭色（主色 ×0.25 亮度）并轻微抖动（line-boil 同族，
  低幅）；每 ~0.3s 从烧点后方脱落 1–2 个碎屑粒子下坠消散
- 揭示：新内容在烧点后方 0.2s 内逐段淡入（跟烧走，不整块出现）
- 终点：烧点到达引信末端的那一帧对齐 downbeat，末段 8f 火花增强 + 微
  shake（R4 配额内的一次）

## 参数表
| 参数 | 典型值 | 调节手感 |
|------|--------|----------|
| 烧速 | 弧长随时间单调前进，全程可先试 2–4s | 有词/事件锚点时按到达时间变速；无锚点时恒速是可选适配 |
| 火花数 | 3–6 颗持续撒点 | >10 颗读作仙女棒，撒点节奏随烧速 |
| 碎屑 | ≤20 个总量，0.3s 1–2 个 | 碎屑云=廉价粒子判例（aesthetic-rules 同族） |
| 揭示延迟 | 烧点后 0.2s | 新内容先于烧点出现=时间观崩坏 |
| 终点对齐 | 末端帧=downbeat | 烧到一半停=引信熄灭叙事，需剧本级理由 |
| 末段增强 | 8f 火花↑+shake 8–12px | 无终点增强，"炸"的预期不兑现 |

## 声音
持续 burning crackle（按本片动作与混音设计控制音量，不要求随烧速恒定）；终点帧重击 + 火花爆点；碎屑脱落
不配音（枪灰感判例）。

## 已知坑
- 炭化是**颜色变化不是消失**——线在烧点后消失=引信断链，倒计时叙事崩塌
- 引信路径要服务构图（绕开主体/指向下一章主体），直线横穿是偷懒
- 与 glow-flyline-moves 的分工：flyline 是光流经线（线是载体），本卡是线
  在烧点后被毁（线是倒计时本体）；同片不同镜可用
- 多段引信接力（章节链）时，每段终点都钉 downbeat、段间炭线保留——
  前段炭线是"已发生"的视觉账本，擦掉=白烧

## 参考实现
mexicat/pdoom-video `app/src/scenes/fuse.ts`，固定修订 `fa164b74fd0b26a99375715b619c55b4a0fb3d05`。上游 `burnKnots` 让烧点在声乐到词时间抵达对应位置，并在延长词上逐字燃烧，属于事件锚定的非匀速运动。恒速只是一种本地艺术适配。MIT 代码许可不包含歌曲/歌词；下例使用独立虚构时间点，不复制原曲数据。

## 时间算例（未接入渲染）

`distance` 是路径弧长比例，不是贝塞尔参数。折线例的段间速度可以不同；需要平滑时使用不越过事件锚点的单调插值，再核验到达帧。

<!-- audit-example:fuse -->
```js
const exampleBurnKnots = [{time: 0, distance: 0}, {time: 0.8, distance: 0.2}, {time: 2.2, distance: 0.7}, {time: 3, distance: 1}];
const burnDistanceAt = (time, knots) => {
  if (!Number.isFinite(time) || !Array.isArray(knots) || knots.length < 2) throw new RangeError("invalid burn timeline");
  knots.forEach((k, i) => {
    if (!Number.isFinite(k.time) || !Number.isFinite(k.distance) || k.distance < 0 || k.distance > 1 || (i > 0 && (k.time <= knots[i - 1].time || k.distance < knots[i - 1].distance))) throw new RangeError("invalid burn knot");
  });
  if (time <= knots[0].time) return knots[0].distance;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i];
    if (time <= b.time) return a.distance + (b.distance - a.distance) * (time - a.time) / (b.time - a.time);
  }
  return knots.at(-1).distance;
};
```

本仓仍无引信渲染 demo；此算例只验证单调时间映射、边界与事件到达，不证明火花、炭化、音画同步或动态观感。
