# 线路叙事 · 18 秒原创无声原型

观众先到，场务还在路上。换乘站保留一个未完成的环，道岔关闭；第二条线到站后，环补齐、道岔打开，才进入“开场”。

打开 `preview.html` 可播放、暂停、拖动时间线，切换延迟/阻塞/隐藏叙事文字和横竖屏。它是完整自包含 HTML，不加载远程库。独立原型阶段以 DOM stub 检查控制逻辑；整合后已补充真实浏览器操作与正常/竖屏技术播放检查，范围见下文。

## 独立运行

```sh
node --test tests/transit-story*.test.mjs
node examples/transit-story/build-preview.mjs
node examples/transit-story/render-study.mjs /absolute/path/outside-this-project/transit-proof
```

离线渲染需要 Node、Python、系统 librsvg/cairo、ffmpeg 和支持中文的系统字体。会输出五个实际 MP4、选帧和来源哈希。它们都调用 `styles/transit-story/scene.mjs`，不是用另一套动画去近似 React 场景。

## Remotion 手动接入

```sh
node examples/transit-story/prepare.mjs /absolute/path/new-external-project
cd /absolute/path/new-external-project
npm ci
npm run typecheck
npx remotion render src/index.tsx TransitStory transit-story.mp4
npx remotion render src/index.tsx TransitStoryPortrait transit-story-portrait.mp4
```

另有 `TransitStoryDelayed`、`TransitStoryBlocked`、`TransitStoryAction`。以上标准 Remotion CLI 命令是可复现入口，**尚未执行通过**。整合后准备工程 TypeScript 已通过，但不能由此标成标准 CLI 或最终验收通过。prepare 只复制现有模板依赖锁，不改写集成仓库。

自己的故事可用 `renderTransit({graph,layout,frame})`，或 `<TransitStoryFrame graph={graph} layout={layout} frame={frame} fps={fps}/>`。参考 `story.json`、`layout.landscape.json`、`layout.portrait.json` 与 [SPEC](../../styles/transit-story/SPEC.md)。先改图和布局，再改故事；不要仅替换站名而保留不成立的依赖。

本整合版本已注册 `transit-story` 到风格/样片目录及图解讲解路线；仍为手动原型，不是 runtime skin。`verification.json` 保留独立原型时的检查记录；集成后的检查另见审阅包。不要再次追加注册片段。没有推送、发布或改动远端。


## 整合后的补充检查

相同 scene/kit 已用真实 Remotion web-renderer 4.0.507 development mode 输出五版18秒视频，全部完整解码；正常和竖屏技术播放到结束。原始预览的操作和390px响应式视口也已检查。原有SVG栅格样片和原型历史验证未被替换，补充媒体、哈希、日志与边界见审阅包，以及[浏览说明](../../docs/style-browsing.md#v3-线路叙事补充验证2026-11-03)。标准CLI、真实手机、完整辅助技术和连续主观/音频审片仍不据此通过。
