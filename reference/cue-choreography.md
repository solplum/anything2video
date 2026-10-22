# 命名事件与到达点编排

用于产品操作、机制演示、旁白揭示和实录音乐卡点。先写事件，再安排运动；不要求每个镜头卡拍，也不替代现有分镜、动作窗审查和音乐试听。

方法参考：[huashu-motion](https://github.com/alchaincyf/huashu-motion/tree/5f2608c2e12abcf518f74dde86093b19f7f88603) 的具名场景、纯时间函数与 reveal-point 编排。此处工具和示例独立实现，未引入它的引擎、GSAP、配乐器、字体或角色资产。与此前参考的 huashu-art-motion 是不同仓库。

## 1. 一处改时间，下游跟随

工程模板提供 `common/motion/cues.ts`，也从 `common` 导出。根时间来自**实际旁白/录音或已确认的操作时刻**，不是凭空推算音乐。项目内部统一用秒保存依赖，最后一次量化到 0 起帧；相同事件共用同一个 cue。

```ts
import {createCueSheet, alignMotion, motionProgress, toStoryboardFrame} from '../../common';

const cues = createCueSheet(fps, [
  {id: 'request.arrive', atSec: 1.4},
  {id: 'request.confirm', after: 'request.arrive', offsetSec: 0.25},
  {id: 'request.depart', after: 'request.confirm', offsetSec: 1.2},
]);
const arrival = alignMotion(cues.get('request.arrive').frame, 0.8 * fps);
const p = motionProgress(frame, arrival); // 纯函数 0..1；再应用 easing
const x = 190 + 570 * p * p * (3 - 2 * p);
const storyboardArrival = toStoryboardFrame(cues.get('request.arrive').frame);
```

`offsetSec: 1.2` 是结果的阅读停留，改成 2 后离场顺延，抵达和确认不动。不重复改多处常数。可用负 offset 表达预备，但结果不得早于 0；工具拒绝负起点而非偷偷截断。循环、重复/缺失 id、非有限时间会直接报错。返回的 cue 与列表不可变；修改定义后重新建立 sheet。

局部 `<Sequence>` 中的 `useCurrentFrame()` 是局部帧，cue 也必须用同一局部原点。全片 cue 需先减该 Sequence 的全片起帧再使用，不能把全片事件直接喂给局部 frame。

## 2. 对准到达/揭示，不只对准开始

`alignMotion(cueFrame, durationFrames, revealProgress=1)` 返回 start/end/reveal/duration。默认让动作**结束到达**落在事件帧：30fps、cue=60、动作24帧 → 起帧36，到达帧60。`revealProgress=0.5` 则让过渡中点对准事件；`0` 表示从事件启动。

revealProgress 是**原始时间进度**，不是 easing 后位移。若实际揭示发生在某个非线性位置，先测出对应的时间进度，不把“位移50%”直接填成0.5。内部保留分数帧边界，支持子帧采样；禁止把每一段长度单独取整再累加。

使用已有音乐分析时，先试听验证网格。`M.nearestBeatFrame(frame)` / `nearestDownbeatFrame(frame)` 返回测得拍点的 **0 起帧**，不是拍序号；网格为空时保留输入的最近整数帧（不凭 BPM 虚构拍点），单点网格吸附到该点，区间外夹到首尾实测点，等距离选后者。调用前仍需确认 `grid.reliable` 及实际听感，API 不宣称拍点可靠。

录音仍是音乐正本。时间调整后检查录音剪辑偏移、旁白、SFX onset/peak 和混音，不自动生成替代配乐。需要音效提前量时，以事件秒数减实测 onset/peak；不能静默裁掉负起点。

## 3. 可运行例子与检查

新工程 Studio 中选择 **CueDemo**（或在模板目录 `npm run studio`）。这是静音的技术时间研究：同一请求对象接近、抵达、确认、阅读停留、再交接。默认 Video 未改变。实现位于 `src/shots/cue-demo/`；`timing.ts` 是纯逻辑，Demo.tsx 消费同一份逻辑。改 holdSec 可验证仅下游事件移动。用于成片时换真实对象/信息，不能把这个示例当默认视觉模板。

仓库检查：

```bash
npm ci --prefix template --ignore-scripts
node --test tests/cues.test.mjs tests/music.test.mjs
node template/node_modules/typescript/bin/tsc --project template/tsconfig.json --noEmit
```

- 测试覆盖24/30/60fps与分数帧率、一次量化、时间修改传播、非法依赖、倒序/跳转一致性。
- 实际看事件前一帧、事件帧和后一帧，以及正常速度连续播放；关键结果的阅读停留可静止。
- 反馈记稳定对象 id（示例 `request`）、全片/局部时间基准、帧号和问题；只改该对象与必要下游，保留未受影响的镜头。
- 渲染后继续使用 [action-review.md](action-review.md) 的实际 PTS/ROI 证据，重生成已过期的图片与视频哈希。数学测试证明时间逻辑，不证明整片观感、卡拍听感或接触物理成立。
