# 铜版雕刻 · engraving

凹版墨线塑造明暗：受光处留纸白，随形排线逐渐加粗，背光处增加交叉线；最后让透明色从触点扩散，墨线始终压在颜色上。区别于 line-art / whiteboard 的均匀描边与 riso-print 的平面网点套色。

- 图元：`kit.tsx` 的 `EngravedPear`、`PlatePaper`；底层 `engine/index.js` 的 `engraveShape(SVG path, {light, spacing, style, seed})` 可用于其他原创闭合形状。
- 路径限制：`engraveShape` / `B.shape` 的 SVG 解析只支持 `M/L/H/V/C/S/Q/T/Z` 及其小写相对命令；**不支持 `A/a` 椭圆弧**，可能静默丢弃弧段。接入前必须把弧转成三次 Bézier `C/c` 并检查闭合轮廓；梨形示例只用 `M/C/Z`，不受此限制影响。
- 接线：`EngravedPear frame={useCurrentFrame()} fps={fps} width={w} height={h}`。frame 为 Remotion 的 0 起帧；绝对秒 `frame/fps` 决定全部状态。无 RAF、外部服务或第二套导出器。
- `config.style = 'engraving'` 只给模板调色板和字幕/进度条换皮；镜头必须接入图元才能得到排线，不把皮肤开关当作主体自动改画。
- 默认 seed=41；纸纹 seed=53，设色颗粒 seed=719，重播不变。轮廓 0–1.2s；随形排线 1.2–4s；交叉排线 4–6.2s；设色 6.4–8.2s。示例最后留约 3.8s 阅读。
- 色板：纸 `#F1E8D2`、墨 `#1C1510`、强调 `#6B492B`、透明矿物黄 `#B29A48`。墨层无灰色实体填充，浓淡来自线宽/密度。禁止用棕色滤镜替代排线。
- 线距按主体尺寸保持，不用全屏等距斜线 pattern 伪造体积；最暗处才叠第二、三组线。纸纹固定在纸张坐标，禁止逐帧随机噪声。
- 示例中文标注 34px@1280 宽，在 480px 宽约 12.75px；原生竖屏为 720×1280，标注独立排在主体上下。改长文字需重新审片。
- 素材和许可：[UPSTREAM.md](UPSTREAM.md)、[MIT](../../LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt)。主体路径与构图原创，字体复用仓库 Noto Serif SC / Fraunces（OFL）。

复现：[examples/engraving](../../examples/engraving/README.md)。横屏样片在 `samples/engraving-sample.mp4`，竖屏在 `examples/engraving/portrait.mp4`，`sample.jpg` 是实际终态帧。

当前范围是无声材质研究，不是完整旁白成片。暂未移植铜板微距刀具/卷屑、纸张揭印、放大圆窗、完整手工水彩潮边；需要这些动作时另行实现与打样。距离场把形状近似为鼓起的表面，不能自动恢复真实物体的三维结构。复杂凹形、孔洞、超小主体须另测；不声称达到参考项目整片水准。
