# 选项冒险：雾谷驿站

原创、18 秒、1280×720、30fps、无声风格样片。邮差面对断桥，选择消耗最后一枚电芯给桥供电，过桥后点亮信标。另附保留电芯的等待分支、对白隐藏版与选择延后 0.5 秒版。

本目录不表示正式成片、上游复刻或已完成原生 Remotion 验收。设计与许可范围见 [SPEC](../../styles/choice-quest/SPEC.md)。机器契约仍沿用主项目。

## 本机可执行

```sh
node --test tests/choice-quest*.test.mjs
node examples/choice-quest/build-preview.mjs
# 在浏览器打开生成的 preview.html，无需联网。预览控件实际浏览器测试仍待补。
node examples/choice-quest/render-study.mjs /absolute/external/output
```

离线实渲需要 Node、Python、系统 librsvg/cairo、ffmpeg 和已安装 Noto Sans CJK SC。没有额外下载或付费服务。`--stills` 仅生成关键帧，不冒充视频。输出目录不能是仓库或其祖先。

## 原生 Remotion 路线（本环境未执行）

```sh
node examples/choice-quest/prepare.mjs /absolute/new/external/project
cd /absolute/new/external/project
npm ci --ignore-scripts
npm run typecheck
npx remotion render examples/choice-quest/Root.tsx ChoiceQuest choice-quest.mp4 --browser-executable=/usr/bin/chromium
```

成功/等待/对白隐藏 Composition 分别为 `ChoiceQuest`、`ChoiceQuestWait`、`ChoiceQuestAction`。依赖沿用仓库锁文件；准备器不替换已有目录、不改默认 Root 或配置、不联网安装。需要能启动 Chromium 的执行环境再验证原生视频。

## 接线与评审

本整合版本已将 `choice-quest` 注册到风格目录与样片清单；`catalog-entry.json`、`sample-entry.json` 保留为可核对片段，不要再次追加。该 ID 仍是手动 kit，不是 `config.style` 皮肤。`storyboard.json` 使用现有故事动作字段；动作窗为 1 起含端点，`scene.mjs` 为 0 起渲染帧。

不要只看对照截图便声称运动通过。实际审片需从头原速播放、看接触窗、解释资源变化与等待分支，并检查两分支在选择前一致。对白隐藏版仍保留游戏选择 UI，并非所有文字均被隐藏。

`verification.json` 与 `render-evidence.json` 保留独立原型制作时的检查记录，不是当前整合版本的全库认证。集成时仍须执行浏览页、路线、打包与完整 checkout 的回归检查。

整合后已通过锁定依赖下的准备工程 TypeScript 与原始控件的浏览器检查，并用相同 scene/kit 经 Remotion web-renderer 4.0.507 输出主/等待分支。它不是标准 CLI 渲染认证；详见 [补充验证](../../docs/style-browsing.md#整合补充验证2026-11-03)。
