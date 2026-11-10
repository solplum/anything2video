# 档案灯台 · lighttable

**试验风格 / 手动接入 kit / 无声视觉研究。** 用固定俯视台面核对证据：纸质原件先成立，放大镜到关键位置后停稳，红笔只标记实际可见的差异。与 `paper-collage` 的手作拼贴和 `blueprint` 的工程线稿不同，核心是冷光透照、稳定空间和原件校读。

- 色板：暗房 `#101b25`，金属框 `#293f4c`，灯台 `#edf7f8`，网格 `#b9d2d8`，纸 `#f0ebdb`，墨 `#253f47`，红笔 `#c54036`，复核条 `#f1d769`。
- 实现：`scene.mjs` 导出 `renderLighttable({frame,fps,width,height,idPrefix})` 与 `stateAt`；`kit.tsx` 导出 Remotion 可用的 `LighttableStudy`。`frame` 为 0 起帧，所有状态由 `frame/fps` 决定，没有时钟或随机源。React 包装为每个实例生成独立 SVG ID。
- 光学不变量：镜内 `<use>` 引用同一个 `evidence` 图组（原件与红笔标注），不重新排一份文字。变换严格为 `translate(cx,cy) scale(1.8) translate(-cx,-cy)`；修改原件坐标时同步更新 `lensA/lensB`，不能在镜内编造更清晰但不一致的内容。
- 节奏：0–1.2s 纸张落定；1.35s 镜子入场；3.25–3.9s 标记原件；4.9–5.9s 移镜；7–7.65s 标记索引；9.05s 复核结论出现，镜子离开。最后留约 2.3s 看两处差异。此节奏是示例，不是生产片的固定时长。
- 横屏 1280×720 为左右对照；竖屏 720×1280 将索引放到原件下方，标题分两行。其他极端画幅须重新排版，不把等比缩放当原生适配。
- 红圈在原件上绘制；镜头停稳后才下结论。结论可以表示差异、待核查或对应关系，不必意味着指控。真实材料须按生产契约核对来源，不得把本例虚构编号当事实。
- 字体：本次栅格验证使用系统 Noto Serif CJK SC / Noto Sans CJK SC；代码不打包字体。生产工程可接仓库已许可的字体并等待字体加载，之后重验排版。

## 用法与边界

示例：`<LighttableStudy frame={useCurrentFrame()} fps={fps} width={width} height={height}/>`。这不是 `config.style` 皮肤，不能仅设 `config.style='lighttable'`。通过 [prepare.mjs](../../examples/lighttable/prepare.mjs) 创建包外 Remotion 工程，再按内容改 `archive()` 的原件图组和对应停留点。

当前可复用的是台面、文档合成、同源放大与标注结构，示例主题是原创叶片档案；不是任意 PDF 自动排版或 OCR 工具。没有导入参考影片、配图、配音、BGM，未实现真实玻璃折射或相机景深。

目录中的初始样片由 Inkscape 栅格化同一 SVG 核心后用 ffmpeg 编码；不是 Remotion 渲染证明。静帧与程序测试不能代替连续播放、声音或生产验收。具体通过项和未执行项见 [验证记录](../../examples/lighttable/verification.json)。

## 参考与原创范围

视觉方法参考 [vibe-knowledge 的档案灯台说明](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/lighttable/STYLE.md)，读取的 Git blob 为 `1f6c86bdc1f7f8e13beb578eef56c83082bb50f9`。仅借鉴冷光台面、原件放大、红笔注记的方法；叶片几何、档案内容、构图、代码和动画均新写，未复制其代码、图片、片段、字体或音乐。

整合后已补充准备工程 TypeScript 与真实 Remotion web-renderer 横竖屏输出；未替换上述样片或历史记录，标准 CLI 与最终成片验收仍待完成。见 [补充验证](../../docs/style-browsing.md#整合补充验证2026-11-03)。
