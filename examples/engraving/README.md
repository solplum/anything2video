# 铜版雕刻：可复现横屏与原生竖屏示例

一枚原创梨的 12 秒无声材质研究：轮廓 → 随形排线 → 背光交叉排线 → 透明设色。原生 Remotion/React + Canvas 2D；不依赖上游播放器、远程服务或第二套导出器。技术与视觉边界见 [SPEC](../../styles/engraving/SPEC.md)，代码来源与许可见 [UPSTREAM](../../styles/engraving/UPSTREAM.md)。

## 规格与来源

| Composition | 尺寸 | 时长 | 音频 |
|---|---|---|---|
| `Engraving` | 1280×720 | 360 帧 / 30fps = 12 秒 | 无声；分发文件带静音 AAC |
| `EngravingPortrait` | 720×1280 | 360 帧 / 30fps = 12 秒 | 无声；分发文件带静音 AAC |

竖屏重新安排标题、图形、上下标注和引线，不是横屏裁切。`Root.tsx` 注册两种 composition；`--portrait` 决定生成工程 `project.json` 的默认规格，导出时仍需显式选正确的 composition。

主体几何、纸纹、设色和构图为本仓原创；没有导入上游蜜蜂或其他样片图像。字体复用仓库中的 Noto Serif SC 和 Fraunces，准备工程时随字体复制 OFL。借用的排线引擎保留 LemoLab MIT，仓库原创代码保留 anything2video MIT。

## 准备包外工程

在仓库根目录运行，目标必须是尚不存在的仓库外目录。不要改写已有项目，也不要把 `node_modules` 或浏览器缓存当作源码分发。

```bash
node examples/engraving/prepare.mjs ../engraving-landscape
node examples/engraving/prepare.mjs ../engraving-portrait --portrait
```

每个工程包含固定版本 `package.json`/`package-lock.json`、入口和场景、完整 `src/style/engine/`、字体及许可、`UPSTREAM-engraving.md`、`project.json` 和 `script/storyboard.json`。它是有意精简的材质研究工程，未生成旁白、混音或完整生产交付材料。

进入各工程安装依赖并检查；已有可用 Chromium 时，可把渲染命令的 `--browser-executable` 指向其绝对路径。首次依赖安装与浏览器准备需要网络。

```bash
cd ../engraving-landscape
npm ci
npm run typecheck
npx remotion browser ensure
npx remotion render src/index.ts Engraving out/engraving.mp4 --codec=h264 --crf=18 --concurrency=2
npx remotion still src/index.ts Engraving out/frame-300.png --frame=300
```

竖屏在另一个工程运行同样的安装/检查，然后显式选择 `EngravingPortrait`：

```bash
cd ../engraving-portrait
npm ci
npm run typecheck
npx remotion browser ensure
npx remotion render src/index.ts EngravingPortrait out/engraving-portrait.mp4 --codec=h264 --crf=18 --concurrency=2
npx remotion still src/index.ts EngravingPortrait out/frame-300.png --frame=300
```

上面 Remotion CLI 的 `--frame=300` 是 0 起帧。需要本仓标准源码指纹、媒体哈希和 ffprobe sidecar 时，在仓库根目录使用统一渲染入口（依据工程 `project.json` 选择横/竖 composition）：

```bash
A2V_CONCURRENCY=2 node scripts/render.mjs ../engraving-landscape video
A2V_CONCURRENCY=2 node scripts/render.mjs ../engraving-portrait video
node scripts/render.mjs ../engraving-landscape stills 30,120,210,300,360
```

该入口的 `stills` 帧号是 **1 起、含端点**，会写入工程 `stills/`；视频写入 `renders/<slug>_v1.mp4` 并附 `.delivery.json`。可用 `BROWSER_EXECUTABLE` 指定浏览器。它默认拒绝覆盖已有输出；确需替换时才显式加 `--overwrite`。sidecar 初始视觉/音频审查字段是未执行，实际审查结果仍须另行记录。

在受限容器中降低 concurrency；浏览器/CPU 差异会改变耗时。源码目录不随渲染结果自动同步，修改仓库后应重新准备一个新目录，或明确更新工程内相应源码并重新记录哈希。

## 接入自己的片子

- 复制 `styles/engraving/kit.tsx` 和完整 `engine/`，保留相对路径与 MIT 归属。
- 使用 `EngravedPear` 时传入 Remotion 的 `useCurrentFrame()`、工程 fps 及图形宽高。状态由绝对 `frame / fps` 重建；不另起 RAF，也不把上一帧像素作为下一帧输入。
- `PlatePaper` 是可选纸层。换主体时可用 `engraveShape` 处理自有闭合 SVG 路径。`engraveShape` / `B.shape` 只支持 `M/L/H/V/C/S/Q/T/Z` 及其小写相对命令；**不支持 `A/a` 椭圆弧**，弧段可能被静默丢弃，必须预先转成三次 Bézier `C/c`。示例梨形只用 `M/C/Z`。复杂凹形、孔洞与极小尺寸仍须另测；距离场近似不等于真实三维模型。
- `config.style = 'engraving'` 只覆写模板 palette/chrome。要看到排线，镜头仍须接入图元。
- 旧风格的选择家族、渲染器、种子与 recipe 没有因此变化。排线本身不可被统一棕色滤镜代替。

## 样片与验证记录

本轮分发文件为横屏 [`samples/engraving-sample.mp4`](../../samples/engraving-sample.mp4)、竖屏 [`portrait.mp4`](portrait.mp4)、各自 `*.delivery.json`、`styles/engraving/sample.jpg` 及样片 poster。应以最终 MP4 的 ffprobe、SHA-256 和同轮源码指纹为准，不能只凭文件存在判断与当前源码一致。

2026-10-19 已用最后引线修正后的源码重新渲染并替换两种完整 MP4、静帧、poster 和媒体 sidecar。两片视频轨均为 360 帧 / 30fps / 12.000000 秒，整段解码通过；静音 AAC 尾部使容器时长为 12.053333 秒。静音不等于没有音轨，且没有旁白、SFX 或音乐。媒体哈希与规格见 [verification.json](verification.json)，逐源文件指纹见 [landscape.delivery.json](landscape.delivery.json) 和 [portrait.delivery.json](portrait.delivery.json)。

实际最终 PNG 与解码视频的抽帧检查覆盖轮廓、排线、设色、终态，以及横竖屏文字和引线布局。对同一个已挂载 React Canvas 依次 seek `300 → 30 → 300 → 120 → 300 → 210 → 300`，横屏图形 640×490 和竖屏图形 650×650 的重复 frame 300 PNG 哈希均完全一致。该结果证明本次浏览器、这两种图形尺寸下的乱序帧重建；不代表整个 composition 的所有帧或跨平台逐像素一致。

本轮视觉审查是抽帧，未进行完整人工连续播放；距离场排线中心仍有风格化尖点，不能声称还原真实梨的三维表面或参考项目整片质量。

再次修改素材或场景后的验收至少包括：

1. 实际浏览器分别渲染两种尺寸的完整 360 帧，确认视频帧数、尺寸、30fps、12 秒视频轨，以及实际音轨是否静音。
2. 看开场、排线推进、交叉线、设色与最终持留，确认引线指向、文字可读及设色仍在墨层下方。
3. 固定输入重复渲同一帧，并乱序 seek 后回到同帧，做真实栅格像素比较。Node 几何/命令测试不替代这一步。
4. 以最终源文件和字体字节记录源码指纹，以最终 MP4 记录媒体哈希；从同一版本提取 poster 并更新 manifest。

`tests/engraving.test.mjs` 检查排线弯曲/渐细、轮廓内裁剪、受光方向、多轮阴影及乱序绘制时线仓不变；它没有提供浏览器像素或整片审美认证。本研究不包含旁白、SFX、BGM、铜板刀具/卷屑特写、揭印或完整手工水彩潮边，不能当作完整旁白影片交付。
