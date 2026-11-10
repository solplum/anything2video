# 档案灯台 · 12 秒无声风格试验

一张原创叶片档案与索引卡出现不同编号。镜子先读原件、再对照索引，最后留下红笔标记。内容是用于测试视觉语言的虚构示意，不是事实短片或已获用户认可的成片。

- 横屏：[实际样片](../../samples/lighttable-sample.mp4)，1280×720，30 fps，360 帧。
- 原生竖屏：[实际样片](portrait.mp4)，720×1280，30 fps，360 帧。
- [风格规范](../../styles/lighttable/SPEC.md) · [验证记录](verification.json)。

## 接入现有 Remotion 工作流

```sh
node examples/lighttable/prepare.mjs /absolute/path/outside-repository/lighttable-project
cd /absolute/path/outside-repository/lighttable-project
npm ci
npm run typecheck
npx remotion render src/index.ts Lighttable landscape.mp4
npx remotion render src/index.ts LighttablePortrait portrait.mp4
```

prepare 复制模板锁文件，不引入第二套 JS 依赖或改变原模板。示例用同一 `scene.mjs` 和薄 React 包装，Remotion 仍是正式工程的目标渲染路径。初始试验环境未成功安装完整依赖且本地 Chromium 被 socket 权限阻止。整合补充检查已通过准备工程的 TypeScript，并用相同核心和 React 包装经 Remotion web-renderer 4.0.507 输出横竖屏视频；标准 CLI 路线仍未执行。范围见 [补充验证](../../docs/style-browsing.md#整合补充验证2026-11-03)。

## 独立 SVG 核心验证

在仓库根执行：

```sh
node --test tests/lighttable.test.mjs
node scripts/style-catalog.mjs --check
node examples/lighttable/render-svg-study.mjs /absolute/path/outside-repository/lighttable-proof
```

浏览静态选帧可在仓库根运行 `python -m http.server 8000`，打开 `http://127.0.0.1:8000/examples/lighttable/preview.html?frame=240`；加 `&portrait=1` 切换竖屏。它是调试页面，不会自动播放视频。

SVG 验证路线要求本机已有 Inkscape 与 ffmpeg。它将 360 个确定性帧栅格化并编码，无声，不调用远程生成服务。`render-study.py` 是另一个 Chromium 截图验证工具（Python Playwright、Pillow、Chromium），本次启动失败，不能将它标为通过。

所有文件来自 pinned `solplum/anything2video` main `8626d3bd91d779e56ea63a48e55ce827c7df13f8` 的必要源码快照与本次新增文件；这是局部工作副本，不是完整仓库。没有推送或改动远端。本地的 focused tests 与目录生成检查不代表全库回归通过。

## 许可与适用

新增代码与原仓库相同按 MIT 分发。纸张、叶片、联系条与编号均为原创 SVG。系统 Noto CJK 字体用于本次画面，不在此示例新增分发字体二进制。参考项目只贡献视觉方法，未取其音乐或默认音色。改成真实档案时，仍需记录该档案的来源、许可与内容核对。
