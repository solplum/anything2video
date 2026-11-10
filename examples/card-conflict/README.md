# 卡牌对抗：可选、可复盘的规则叙事

直接打开 `preview.html`。它是一个约 27KB、无外部依赖的完整交互预览，可以离线使用。

- 播放在 4 秒前停下，等你选择行动。
- 选择后锁牌，6 秒支付补给，10 秒接触结算。
- 可拖动、逐帧、重播、重新选牌、切换「最后一盏灯 / 种子守夜」。
- 关闭「显示文字」会去掉所有 SVG 文字，用物件变化验证后果。
- 页面转入后台会暂停；不会回来后突然跳过结算。

## 重新生成与测试

从源码包根目录运行：

```
node --test tests/card-conflict*.test.mjs
node examples/card-conflict/build-preview.mjs
node examples/card-conflict/render-study.mjs /absolute/path/to/new-output
```

测试和 HTML 构建只需要 Node.js 22+。离线视频渲染还需要 Python 3、系统 librsvg/cairo、ffmpeg/ffprobe，以及支持中文的系统字体。所有样片均无声；没有调用付费模型或外部素材服务。

`styles/card-conflict/scenarios.mjs` 是两组规则数据；`engine.mjs` 计算状态与事件；`scene.mjs` 绘制原创卡牌与受影响的目标。修改数据后重新构建预览和视频。不要只换标题来声称新题材已经实现。

## 原生 Remotion 接入

`Root.tsx` 提供三个独立 Composition：

- `CardConflictLighthouse`
- `CardConflictCounterfactual`
- `CardConflictGreenhouse`

用 `prepare.mjs` 生成新目录，再按输出提示安装官方依赖。它拒绝覆盖已有目录；不会改动主仓库。适配器和 HTML / 离线样片共用 SVG 核心。离线视频渲染不等于已经执行原生 Remotion 渲染。

## 不包含的承诺

这是一个真实可用的样式原型和生产方法，不是完整对战游戏、最终商业影片，也不是 `config.style` 可直接选用的皮肤。只支持 16:9 横版，无声。数据是原创规则值，不是现实测量或效果承诺。

详见 `styles/card-conflict/SPEC.md` 与 `INTEGRATION.md`。


## 整合与验证范围

本 v5 已注册 `card-conflict` 目录/样片并升级同名候选，关联角色动画，示例进入分发收集；不会作为运行时 `config.style` 皮肤。主样片位于 `../../samples/card-conflict-sample.mp4`，另有 `counterfactual.mp4`、`greenhouse.mp4` 和 `no-captions.mp4`。保留的数据片段不要重复追加。

[verification.json](verification.json) 记录最终独立原型的源指纹、29 项测试和 TypeScript；[render-evidence.json](render-evidence.json) 记录修正接触几何后的 SVG 媒体；3,840 帧逐字节比较确认最终剩余防护修正不改变内置场景。早期 26 项记录仅保留于 evidence-history。实际浏览器、web-renderer 与全源整合范围另见[补充验证](../../docs/style-browsing.md)，不以技术播放代替标准 CLI、连续主观审片或最终声音/成片 QC。
