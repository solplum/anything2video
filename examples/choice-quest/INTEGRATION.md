# 已接入的可选原型

本目录属于以远端 main `8626d3bd91d779e56ea63a48e55ce827c7df13f8` 为基线的本地整合版。`choice-quest`（选项冒险）已加入全局风格目录与样片清单，`choice-adventure` 子路线已指向它；不是等待首次注册的孤立 overlay。旧风格 ID、recipe、导入路径和默认场景保持不变。

## 注册与制作路线

- 图元：`styles/choice-quest/`，`runtimeSkin: false`，须手动接入，不写入 `config.style`。
- 来源与样片片段：`catalog-entry.json`、`sample-entry.json` 保留为可核对的增量记录，不要再次追加以免重复 ID。
- 路线：角色动画 → 选项冒险 → `choice-quest`。目录中的实现等级为 **prototype**，媒体证据为 **offline shared-SVG render + sampled-frame inspection**。
- `scripts/production-routes.mjs` 能识别本整合版的原型；若换回不包含 choice-quest/lighttable 的基础风格目录，仍保留可选兼容性，不自动安装图元、不改旧工程或运行时 recipe。
- 共享画风分组、样片页面和打包清单由整合层管理。本说明不固定画风计数，新增其他独立图元后按当前 catalog 重新生成页面和核对打包结果。

## 保留的验证边界

原始 `verification.json`、`render-evidence.json` 和 `sample-entry.json` 记录原型阶段的检查与编码文件哈希，不因注册完成自动改为通过。原生 Remotion、原生类型检查、完整原速运动播放、音频审核及最终成片 QC 仍未完成。全片解码或 VM/DOM-stub 测试不是浏览器播放；这些视频有意无声。

实际改编制作仍在包外独立工程完成，按既有文案、动作、渲染和 QC 契约执行。注册原型不代表已制作任意用户主题的全片，也不证明与上游演示动态等价。此处没有执行 push、PR、merge 或发布。
