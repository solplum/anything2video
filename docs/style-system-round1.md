# 风格整理第一轮：家族、兼容与雕刻

日期：2026-10-19。基线提交：`45c917cf9ea9f9731e0aa487b99807bbc4f945fd`。本记录说明源码变更与验证范围；未完成的媒体/浏览器检查不因文档存在而视为通过。

## 口径与边界

唯一选型元数据是 [`styles/catalog.json`](../styles/catalog.json)：

- 63 个可寻址风格 ID：保留 62 个旧 ID，新增 `engraving`。
- 59 个选择入口：4 个双成员家族 + 55 个单成员入口。家族是选型展示，不是 renderer 别名。
- 12 个实际 `config.style` 皮肤，与 `template/src/recipes/styles/index.ts` 的 `STYLE_SKINS` 对齐：`deep-space`、`mg-purple`、`epic-paper`、`sand`、`chalk`、`blueprint`、`neon`、`pixel-arcade`、`paper-collage`、`swiss-print`、`crt-terminal`、`engraving`。
- 其余 51 个 ID 通过对应 kit 手动接入，不能把目录名直接当成已注册的 `config.style`。
- 62 个 ID 登记了样片路径：61 个历史样片和新的无声雕刻研究。样片文件存在不代表最新源码验证，也不代表完整生产验收。
- `isometric-anatomy` 的 `preview.status` 明确为 `missing`，路径和 poster 均为 `null`；保留实验图元入口，不用其他卡的图冒充预览。
- 3 个历史 `recipe-*` 视频是配方参考，不额外计入风格 ID 或选择入口。

## 第一轮只合并选择入口

| 家族 | 成员 | 相似处 | 必须保留的差异 |
|---|---|---|---|
| 暗色信息设计 `dark-editorial` | `deep-space` / `mg-purple` | 暗底、信息版式 | 电光青产品宣传与紫色知识讲解的 palette/chrome、配方与覆盖层 |
| 微缩等距场景 `miniature-diorama` | `isometric-city` / `clay-town` | 等距投影、微缩场景 | 硬面建筑位移与黏土软材质弹动，独立组件与参数 |
| 印象派光色 `impressionist` | `light-dabs` / `lily-pond` | 光斑、短笔触 | 固定笔位的外光场景与水面/植物分档沸腾、场景预设 |
| 套色印刷 `print-motion` | `ink-plate` / `riso-print` | 分版、套印 | 四墨几何编舞与双色滚筒工艺、材质和动作 |

旧 ID、import 路径、recipe 关联、随机 seed 与 renderer 继续存在；选中变体仍落到该变体自己的实现。不能按“都展示一座城”“都画一朵花”删除风格。`swirl-oil` 的厚涂漩涡、`scream-warp` 的长流线扭曲及其他材料语言仍独立。`archive-lighttable`、`photo-collage` 是后续候选，没有在本轮引入或虚增计数。

## 真正共用的实现：四份相同 strokes.ts

本轮把 `light-dabs`、`lily-pond`、`swirl-oil`、`scream-warp` 中逐字节相同的笔触库移到 `styles/shared/paint/strokes.ts`。旧文件成为 re-export 入口，未改变各风格的场景层、缓存、方向场、参数或 seed。

共享源 SHA-256 为 `e65318de5cd6f2099096dffb6c3bf67e951207b7f5332a47fa4b0696dd7a0c1d`，与基线保存的原实现一致。选择家族分组与这项代码去重是两件独立的事；例如 `swirl-oil` 与 `scream-warp` 共用库，但没有被并成同一个风格。

**新手动拷贝必须带上共享兄弟目录。** 只拷贝某张卡的新 `strokes.ts` 会缺依赖。完整目录示例见 [`styles/shared/README.md`](../styles/shared/README.md)。已经把旧完整实现复制到包外的项目不受影响。

## 新增 engraving 的实际范围

- 许可清楚的最小引擎吸收：LemoLab MIT `burin.js` 原样 vendor，`engraveShape` 入口适配；固定上游 revision 与哈希见 [`UPSTREAM.md`](../styles/engraving/UPSTREAM.md)。2026-10-19 已核验 pinned revision 的原始字节和 MIT 文本均与本地一致。
- 原创梨/叶/茎路径、纸张与透明设色，文字与横竖屏构图由本仓编写；不导入上游蜜蜂图像或样片。
- React Canvas 使用绝对 `frame / fps`，Remotion 负责统一时钟与导出。`config.style='engraving'` 只提供 palette/chrome，排线仍须在镜头中使用 kit。
- 两个可复现 composition：1280×720 与原生 720×1280，均为 360 帧、30fps、12 秒、无声。操作见 [`examples/engraving/README.md`](../examples/engraving/README.md)。
- SVG 输入只支持 `M/L/H/V/C/S/Q/T/Z` 及小写相对命令。`A/a` 椭圆弧不受支持，可能静默丢弃；使用 `engraveShape` / `B.shape` 前须将弧转为三次 Bézier `C/c`。示例梨形的 `M/C/Z` 路径不受影响。
- 这是材料与线条方法研究，不是包含旁白和混音的完整影片，也未移植全部刀具、卷屑、揭印、圆窗或水彩动作。

## 生成关系与日常修改

[`scripts/style-catalog.mjs`](../scripts/style-catalog.mjs) 从 catalog 生成：

- `samples/index.html`：按家族选型，家族内切换变体，类型/气质双筛选。
- `samples/all.html`：全部旧 ID 与独立配方参考。
- README 中 `style-catalog:start/end` 之间的区块。
- `samples/manifest.json` 中 catalog 总数和已有样片的 `styleId` / `familyId` / `runtimeSkin` 元数据。

修改选型信息时编辑 catalog 后运行 `node scripts/style-catalog.mjs`；用 `node scripts/style-catalog.mjs --check` 检查漂移。不要手改生成区块。媒体 SHA-256、输入指纹、ffprobe 规格与音频披露仍需从最终文件取得；catalog 生成器不会渲视频或替你验证媒体哈希。

## 回归证据与未覆盖项

源码测试入口（先在 `template/` 安装 lockfile 对应依赖，兼容测试会调用其中的 TypeScript）：

```bash
npm --prefix template ci
node --test tests/style-system.test.mjs tests/engraving.test.mjs tests/engraving-assets.test.mjs
node scripts/style-catalog.mjs --check
npm --prefix template run typecheck
```

`style-system.test.mjs` 的前 4 项回归覆盖：

1. 全部 62 个旧 ID 的顺序、recipe/source 关联与四个家族的固定成员；source 目录清单与 catalog 一致。
2. runtimeSkin 标签和实际 `STYLE_SKINS` 注册一致；anatomy 的无预览状态；已登记样片元数据、文件存在与生成一致性。
3. 基线的 36 个旧 recipe/style 组合运行值不变；另检查雕刻在 explainer/promo/epic 下的 palette/chrome。此集合不是所有组合的穷举，也未覆盖 documentary 的全部运行行为。
4. 四个旧 strokes 入口的完整导出与固定 seed 的 Canvas 命令轨迹，并校验共享源哈希。命令轨迹在同一宿主上与固定原实现逐项比较，避免不同 JS 引擎/CPU 的三角函数末位差异被误报为行为回归。

另有 4 项测试执行生成页面的真实 inline 脚本，使用最小 DOM 替身验证搜索、四组变体切换、双筛选、空结果恢复、深链/历史导航、无效片段和隐藏视频暂停。这些是行为回归，不测实际浏览器布局或播放器。

`engraving.test.mjs` 的 2 项测试覆盖几何、受光、轮廓内排线、线宽渐细、多轮阴影、绝对时间和乱序调用的线仓稳定性。使用的是 Path2D/Canvas 命令探针，不是浏览器栅格像素认证。

`engraving-assets.test.mjs` 另有 2 项测试：核对两种媒体与最终源码/字体/sidecar 哈希，并从零准备横竖示例、检查布局及代码/字体许可记录。

本轮云端验证结果：

- 全仓 Node 聚合测试 116/116 通过，包含上述风格、雕刻和资产测试。
- 模板、横屏示例、竖屏示例的 TypeScript typecheck 均通过。
- `node scripts/style-catalog.mjs --check` 和 `git diff --check` 通过。
- 真实 Chromium chooser 检查 23 项通过：1440/768/390/320px 宽度、键盘/可访问性、8 个家族变体播放、切换与筛选后暂停旧视频、历史导航及 `file://` 离线入口；未发现 JS 错误。这是一次 Chromium 检查，不代表跨浏览器认证。
- 完整导出包已构建，`verifyPackage()` 通过；从该导出包新建雕刻工程并执行 typecheck 通过。
- Python unittest 全套 32/32 通过（音频边界、音频流水线、辉光与节拍/音乐特征 selftest）；与 Node 结果分别运行和记录。

媒体与真实像素证据见 [`examples/engraving/verification.json`](../examples/engraving/verification.json)：

- 最后引线修正后的横竖完整视频已替换，均为 360 帧、30fps、12 秒视频轨，整段解码通过；带静音 AAC 的容器均为 12.053333 秒。
- 真实 PNG 和解码视频抽帧检查了轮廓、排线、设色、终态、文字与引线布局。它是抽帧检查，不是完整人工连续播放。
- 同一已挂载 React Canvas 乱序 seek `300→30→300→120→300→210→300`，640×490 与 650×650 两种图形尺寸的重复帧 PNG 哈希一致。未据此宣称整个 composition 的所有帧或跨平台像素一致。
- poster、样张、媒体 sidecar 和 manifest 已按新片更新。静态图片与代码/媒体哈希各有用途，不互相替代。

尚未进行完整人工连续播放或跨浏览器/跨平台栅格认证。材料研究没有旁白、SFX、BGM 的生产验收，anatomy 预览也仍缺失。

历史 `node template/scripts/styles_check.mjs` 仅检查 8 个旧 SKU 的资产和可访问正本的 path 串，正本不可访问时允许 SKIP。它没有覆盖整个 63-ID 风格库、雕刻、chooser 或全片运动，不能作为本轮全库验收结论。

## 发行包清单检查

本轮首次检查 `collectCoreFiles()` 时发现：旧规则会收录 `styles/shared/paint/strokes.ts`、catalog、雕刻引擎与 samples，但漏掉整个 `LICENSE-THIRDPARTY/`、新文档和 `examples/engraving/`。因此旧 `buildPackage()`/`verifyPackage()` 的通过不足以证明新功能可分发；缺少 MIT 通知尤其是发布阻断项。

随后已修正为必须收录 `LICENSE-THIRDPARTY/` 和本记录，只允许 `examples/engraving`、`examples/line-art-teaching` 两个经过选择的示例目录进入分发。2026-10-19 重查实际 `collectCoreFiles()`，下列雕刻源码、文档、许可、portrait 与 verification 文件均已纳入；共享 strokes 和 catalog 也在清单中。其他 examples、tests、secrets 和缓存仍排除。

发行包必须持续覆盖下列依赖，并运行导出后复现检查：

- `styles/catalog.json`、`styles/shared/`、四个兼容入口、完整 `styles/engraving/`（含 SPEC/UPSTREAM）。
- `LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt` 及既有借鉴许可，字体与其 OFL。
- `docs/style-system-round1.md` 和 `examples/engraving/` 的准备脚本、场景、入口及最终媒体证据。
- `samples/index.html` / `all.html`、manifest 与 catalog 所引用的实际样片/poster。

`tests/editions.test.mjs` 的 8 项打包/安装测试通过；`tests/source-consistency.test.mjs` 已显式断言新 MIT 许可、UPSTREAM、共享 strokes、prepare、示例 README 与本记录在 core inventory 中。测试目录继续不随发行包分发，secrets、缓存、私有 examples 等排除规则保留。导出包包含依赖只能证明结构完整；宿主支持、依赖安装、真实渲染与视觉验证仍分别记录。
