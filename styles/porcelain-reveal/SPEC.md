<a id="cobalt-reveal"></a>

# 青花显影 · porcelain-reveal

**原创、无声、独立材质原型。手动接入 kit，不是 config.style 皮肤。** 将钴蓝画意固定在温白瓷面上，以不规则、多落点的渗化显影组织一张画的出现。这里的“显影”是视觉隐喻，不是陶瓷工艺或真实流体仿真。

## 不能退化成换色

- 画面从空白瓷面开始。多个落色点有各自的起始时间、半径和椭圆比例，轮廓细节由固定种子决定。
- 扩散前沿缓慢增长，不从屏幕左边简单擦入；遮罩轮廓在时间中只扩张，不随机抖动。
- 同一原创图组有主色层、湿边模糊层及局部积色。固定噪声改变钴料浓淡和画线边缘，湿润阶段退去后定色。
- 瓷面保持稳定的高光、微孔与边缘层次。画面、材质噪声和湿边始终使用同一坐标系。
- 文字在主图可辨之后出现，最后保留约 3 秒静观。没有镜头旋转、纸纹换色或金色卷轴。

## 交付接口

`scene.mjs` 的 `renderPorcelain({frame, fps, width, height, seed, speed, showText, title, subtitle, idPrefix, artworkSvg, bloomSources})` 返回 SVG。`kit.tsx` 的 `PorcelainReveal` 是 React/Remotion 包装，每个组件实例使用独立 SVG ID。所有帧由 frame/fps 算出；无时钟、Math.random、网络和帧间状态。

- 默认：1280×720、30 fps、420 帧/14 秒，原创莲塘双鱼。竖版 720×1280 单独排标题、画心与边框。
- `bloomSources`：`[x, y, startSeconds, maxRadius, verticalAspect]` 元组列表，使用当前 SVG viewBox 坐标；必须随画心重排。
- `artworkSvg`：替换默认原创画心。仅接本项目作者生成或审查过的可信 SVG 片段；**不是任意 SVG 上传接口或消毒器**。禁止把不可信外部 SVG 直接传给 dangerouslySetInnerHTML。外部素材应在接入端清洗，并核对使用许可。
- `seed` 固定噪声与轮廓，`speed` 改变整个显影节拍。若改变速度，应同步延长/缩短 composition，并重验文字停留时间。
- 标题按四字中文排版；长标题、英文或长副标题需要重新排版。只验证了 16:9 和 9:16，方形/极端比例不能被当成已适配。

例子通过 `node examples/porcelain-reveal/prepare.mjs <包外新目录>` 生成 Remotion 项目。`Root.tsx` 注册横版、竖版、去文字版。使用仓库既有的 React、Remotion 版本；没有追加运行依赖。

## 生产检查

1. 确认画作原创或已授权；不是将参考海报/样片变色后重用。
2. 先设计最终画心与阅读留白，再选择落色点。检查所有重要轮廓在收尾前完整揭示。
3. 只扩张的遮罩不保证任意自定义画作都会覆盖完整。换画、换落点后逐帧与终帧检查。
4. 用真实工程字体渲染，检查小字与长文。代码不分发字体，本次使用系统 Noto Serif CJK SC / Noto Sans CJK SC。
5. 检查色料渗化、积色和定色，而不只看最终蓝白静帧。按真实用途补音乐/声效；本研究无音轨。

## 来源与边界

方法参考 [vibe-knowledge qinghua STYLE](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/qinghua/STYLE.md) 的钴蓝白瓷、全画幅画作与扩散显影原则。以参考映射 `reference-map-2026-11-03` 为研究依据。未复制它的源码、提示词、图片、影片、字体或音乐；莲叶、莲花、双鱼、构图、材质代码和节奏全部新写。上游演示作品并未据此获得可再分发授权。

本例是程序绘制的平面瓷板，不是写实青花釉面、3D 花瓶或生成式艺术的等效替代。它证明可复用材质路径，不代表完整达到参考影片的画作丰富度；更复杂画作可经授权或原创生成后接同一显影层。付费生成或采购素材需另行批准。

实际初始验证见 [verification.json](../../examples/porcelain-reveal/verification.json)，后续整合检查与补充证据见[浏览说明](../../docs/style-browsing.md)。本版已注册目录/样片，纳入示例分发，并通过既有 `cobalt-reveal` 子路线关联绘画动画；没有加入运行时 style registry。标准 CLI 启动受阻，完整分发及最终成片 QC 不因此通过；未推送。


早期小落色点的模糊必须使用固定画幅坐标边界，而非按小对象包围盒的百分比裁剪。本实现给 feather / wet filter 四边各 32 个 SVG 单位，防止湿边被裁成方块；见 [BLUR-FIX.md](../../examples/porcelain-reveal/BLUR-FIX.md)。
