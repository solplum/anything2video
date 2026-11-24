# 画质、速度与音画同步工具（v5.1.0）

<a id="pace"></a>
## 节奏档位：`A2V_PACE=fast|quality`

1. **门禁不降格**：`fast` 与 `quality` 共用同一套旁白确认门、`check-plan.mjs`、`tsc --noEmit`、`check-qc.mjs` 与三轮审核口径，只缩渲耗时、不省证据。
2. **fast 档（打样/快速迭代）**：渲染加传 `A2V_SCALE=1`（按 `project.json` 原始 1280×720 输出）、配合 `A2V_BUNDLE_CACHE=1` 复用 webpack 缓存、跳过多变体与重量级 `FastMoveBlur` 试验。
3. **quality 档（终渲定稿）**：关闭 `A2V_BUNDLE_CACHE` 保证干净重建，启用 `project.json` 的 `renderScale: 1.5`（1920×1080 成片），仅在高速冲击镜头加 `FastMoveBlur`。
4. **预览与静帧永远 1×**：`render.mjs` 的 `preview`、`stills` 与 `batch` 默认 `scale=1`（显式 `A2V_SCALE` 才覆盖），保证打样与审片速度。

## 分辨率超采样（`renderScale`）

- `scripts/init.mjs` 为新工程写入 `renderScale: 1.5`（逻辑布局保持 1280×720，`video` 实渲 1920×1080）。
- `render.mjs` / `check-qc.mjs` 会校验 `width * scale` 与 `height * scale` 均为偶数整数，并在 `.delivery.json` 记录 `scale` 与 `outputDimensions`。
- **2D `<canvas>` 风格锁定 `renderScale: 1`**：以下 16 个带固定像素尺寸、`setTransform` 或 `getImageData` 的 `styles/*/Scene.tsx` 风格若用于全片，请将该工程 `project.json` 显式改回 `"renderScale": 1`，避免画布与矢量图层采样不一致：
  `blue-period`、`cave-wall`、`chrome-ball`、`cumulus-light`、`dance-line`、`facets`、`grain-flat`、`hard-light`、`ink-boil`、`ink-tea`、`math-lab`、`mosaic`、`rubberhose`、`shadow-play`、`soft-clock`、`watercolor-cel`。

## 并发与浏览器加速变量

- `A2V_CONCURRENCY`：缺省取 `max(1, min(6, floor(os.cpus().length / 2)))`（8 核默认 4），范围 `1..32`。
- `A2V_GL`：透传 Remotion Chrome `chromiumOptions.gl`（可选 `angle` / `egl` / `swiftshader` / `swangle` / `vulkan` / `angle-egl`）。
- `A2V_BUNDLE_CACHE`：默认 `0`（`enableCaching: false`，确保正式/QC 干净）；设为 `1` 时开启 Remotion webpack 增量缓存以加速重复预渲，**正式交付前必须取消或设回 `0`**。

## 高速运动模糊：`FastMoveBlur`

`template/src/common/kit/FastMoveBlur.tsx` 封装 `@remotion/motion-blur` 的 `CameraMotionBlur`（默认 `samples=6`、`shutterAngle=180`）：只包高速推拉或飞掠冲击层，勿包字幕与可读正文（耗时近似乘以 `samples`）。

## 音画语义对照抽帧：`semantic-sync-pack.mjs`

```sh
node <skill>/scripts/semantic-sync-pack.mjs <工程> [--id <批次id>]
```

读取 `script/timeline.json` 句中点与 `src/common/anchors.ts` 中的 `{#id}` 锚点，一次性调用 `renderBatch` 抽出 1× 关键静帧并生成 `qc/semantic-sync/index.md`（状态固定为 `needs_review`，供人眼逐条核查声画同步）。
