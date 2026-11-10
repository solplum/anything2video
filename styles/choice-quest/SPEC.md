# 选项冒险 · choice-quest

**状态：原创视觉原型，手动接入 kit。** 不替换 `pixel-arcade`、不增加 `config.style` runtime skin，不改配方、已有 ID、共享 Root、稿件授权或最终 QC。

## 风格真正改变什么

把“谁在什么局面下做了哪种选择，付出什么，造成什么”变成可见的游戏场景。固定场景、可辨角色、道具库存、逐字对白、选项光标、接触动作、世界状态变化共同成立。不是把字幕框放进一张像素背景，也不是只换街机霓虹色。

- **场景层**：低分辨率感的山谷、实体断桥、原创建模的邮差与驿站；深松绿、谷地灰蓝、纸色 UI、少量赭金提示。像素感来自阶梯地形和量化位移，不宣称严格全像素栅格。
- **选择层**：选择必须改变至少一个明确状态。资源计数是真实剧情变量，不是虚构的“效果数据”或信用分。无成本/失败分支都可保留。
- **动作层**：先接触电芯与终端，后扣库存、亮指示灯、展开桥面；桥完成才允许跨越。对白隐藏时仍保留场景因果。等待分支不消耗资源，也不出现成功信标。
- **版式层**：16:9 场景上、对白下、选项右。此样片只实现横屏；竖屏需重新布局，不拉伸冒充适配。

## 可复用入口

- `evaluateChoiceEvents({frame, initial, events})`：通用纯函数状态账本。事件以 **0 起帧** 排序，逐项设置已声明的标量字段；可倒序取帧。门钥匙、卡牌消耗、任务分支均可复用。它不是交互游戏引擎或物理引擎。
- `questState` / `questTiming`：本原创样片的确定性时钟和两条分支，`selectSec` 支持 5.5–7.5 秒内局部改时，后续接触/桥/过桥/信标一起顺延。
- `renderQuest`：同一份 SVG 场景，原生接入与离线实渲共用；含 `branch`、`selectSec`、`showCaptions`，对非法画幅直接报错。
- `ChoiceQuestFrame`：React/Remotion 手动接入组件。`examples/choice-quest/Root.tsx` 提供成功、等待、隐藏对白三种 Composition，全部 1280×720、30fps、18秒。

新故事先定义角色与道具身份、初始状态、可选行动、资源变化和可见后果，再重画主体。不要只改本例对白而保留不相干的断桥情节；本例的画面和时钟是参考实现，不是万能镜头生成器。

## 接回原合同

故事文件使用原有 `story.schemaVersion=1`、`kind=fiction` 和 `shot.story.actions[].phases`，不发明第二套事实/稿件审批。故事合同是 1 起含端点；渲染器是 0 起，只在登记动作窗时转换。见本例 `storyboard.json`。若改成真实事件，仍需原合同中的事实边界与用户稿件批准。

## 来源与权利

借鉴 [vibe-knowledge RPG STYLE](https://github.com/andyhuo520/vibe-knowledge/blob/main/skills/vibe-knowledge/styles/rpg/STYLE.md) 的“场景＋逐字对白＋两难选择＋后果”语法。2026-11-03 实际读过 STYLE 和 NOTICE，并看过其 RPG still；未看过本轮上游 MP4，不能声称动态等效。

新剧情、角色、山谷、桥、驿站、UI、时序与源码均独立实现，按本仓库 MIT 许可。没有复制上游影片、still、角色、美术、代码、BGM 或配音。上游 [NOTICE](https://github.com/andyhuo520/vibe-knowledge/blob/main/NOTICE.md) 将演示媒体排除在代码/文档 MIT 许可之外，不能混进本包。

使用宿主已安装 Noto Sans CJK SC 字体，未分发字体文件。渲染环境需确认字体存在；跨平台字体像素一致性尚未验证。

## 已测与未测

状态/因果/反分支/改时/非法参数单测，真实 SVG 栅格视频、ffprobe、全片解码和抽帧目视检查分别留证。它们不能代替主观故事质量、连续原速运动观看、完整音频审听或生产终检。此样片有意无声；现有响度终检不支持无音轨交付，不伪称 final delivered。

初始原型环境的本地 Chromium 因 `socket() Operation not permitted` 无法启动，当时尚未执行原生 Remotion、浏览器像素一致性和 TypeScript 验证。离线视频由完全相同的 SVG 场景经系统 librsvg/cairo 与 ffmpeg 生成，不是独立重写的 Python 近似动画。

整合后已补充准备工程 TypeScript、原始预览控件的真实浏览器检查，以及同核心/包装的 Remotion web-renderer 主/等待分支输出；标准 CLI、全部分支原速运动审片和最终成片 QC 仍不据此通过。见 [补充验证](../../docs/style-browsing.md#整合补充验证2026-11-03)。
