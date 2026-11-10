# 青花显影：莲塘双鱼

14 秒、30 fps、无声原型。风格意图是钴料从局部渗开、积色并固定在瓷面上，而非蓝白调色。

- 交互预览：直接打开 `preview.html`，支持播放/暂停、拖动逐帧、重来、横竖切换、去文字。
- 主样片：`../../samples/porcelain-reveal-sample.mp4`。
- 竖屏样片：`portrait.mp4`。
- 完整设计与素材边界：`../../styles/porcelain-reveal/SPEC.md`。
- 自动测试：仓库根目录执行 `node --test tests/porcelain-reveal*.test.mjs`。
- 重新生成预览：`node examples/porcelain-reveal/build-preview.mjs`。
- 重新渲染：`node examples/porcelain-reveal/render-study.mjs <包外目录>`。需要系统 Python、librsvg/cairo、ffmpeg；同一 SVG 核心经该路径输出，不等于 Remotion 验收。
- Remotion：`node examples/porcelain-reveal/prepare.mjs <包外新目录>`，在新目录按既有锁文件安装依赖后执行 `npm run typecheck` / `npx remotion render src/index.ts PorcelainReveal output.mp4`。项目类型检查已通过，当前云环境标准 CLI 启动 Chromium 失败，详见验证记录。

原图无需下载资产。替换成自有图案时同时调整 `bloomSources`、字体和留白。`artworkSvg` 只接可信作者代码，不是文件上传端点。


## 整合与验证范围

本版已在目录与样片清单注册 `porcelain-reveal`，复用 `cobalt-reveal` 子路线并关联绘画动画，示例随分发收集。保留的三个 JSON 片段不要重复追加。它仍是手动 kit，不是 `config.style` 皮肤。

[verification.json](verification.json) 保留独立原型及滤镜修正阶段的 17 项测试、TypeScript、SVG 媒体与受阻 CLI 记录；更早记录在 evidence-history 中；全源整合和后续真实浏览器/web-renderer 范围见[补充验证](../../docs/style-browsing.md)。原 SVG 样片未被后续证明视频替换，技术检查不代替最终创意、声音和成片验收。


## 早期显影修正

小落色点的矩形模糊裁边已经修正，构图与时间不变。见 [BLUR-FIX.md](BLUR-FIX.md)，可运行 `node examples/porcelain-reveal/verify-blur.mjs` 重现像素级边界检查。
