# anything2video

**把一个想法、一篇文章或一份产品资料，做成有画面、有配音的视频。**

想讲清一个知识点，介绍自己的产品，或把一个故事讲得更有画面感？anything2video 是一套给 AI 助手使用的视频制作工具包，把调研、写稿、配音、动画、审片和交付串成完整流程。

你提供材料、选择喜欢的画风、确认内容，助手负责继续制作。最后拿到视频，也保留后续能改稿、换镜头、重新导出的工程文件。

[能做什么](#能做什么) · [怎么使用](#怎么使用) · [全部风格](#全部风格) · [开始安装](#开始安装) · [常见问题](#常见问题)

## 能做什么

| 你的想法 | 可以做成 |
|---|---|
| “这篇文章很有意思，想让更多人看懂” | 有旁白、有图解的知识短片，把重点和来龙去脉讲清楚 |
| “想介绍我的产品，但不想只是翻几张图” | 围绕使用场景、功能和卖点展开的产品视频 |
| “想讲一个历史、文化或品牌故事” | 有统一画风和叙事节奏的故事片，也可结合有来源的图片与档案影像 |
| “课程里的这个概念，总是解释不明白” | 用动作、对比和流程展示原理的教学动画 |

支持中文、英文旁白和中英双语字幕。可以做横屏或竖屏；不同画幅会分别安排画面。它更适合图解、动画与素材合成，以实拍采访或真人口播剪辑为主的任务需要其他工具配合。

## 怎么使用

使用前，需要在一个能读写文件、运行制作工具的 **AI 编程助手** 中安装并配置环境，例如 Codex、Claude Code 等。准备好后，你可以直接用自然语言提需求；具体安装步骤放在[上手指南](docs/getting-started.md)。

1. **给材料**：一个主题、一篇文章、一份产品介绍都可以。补充“讲给谁听、想让观众记住什么、大概多长、发在哪里”。
2. **选画风**：往下看全部风格，告诉助手喜欢哪一种，也可以请它按你的主题推荐。
3. **定内容、看小样**：先讨论文案方向，再确认全文；选好声音和音乐后，先看开头、复杂中段和结尾的小样，再继续制作。
4. **拿到视频和可修改文件**：交付目标包括视频、字幕、封面、工程与素材来源。以后想改一句话或一个镜头，可以接着修改和重新制作。

比如，你可以这样开口：

> 请用 anything2video，把“自来水怎样到我家”做成一条约一分钟的中文科普视频，给小学生看。想要黏土小镇的感觉，横屏。先和我确认文案，再给我看几个关键片段，最后交付视频、字幕和封面。

下面的样片可以帮你判断画风。选中某个风格后，内容、构图和节奏会围绕你的主题重新设计。

<!-- style-catalog:start -->
## 全部风格

**63 种风格全部列在下面，其中 62 种有实际视频预览。** 点击图片或播放链接看动态效果；GitHub 未内嵌播放时，可以下载查看。同一家族的变体并排展示，你可以直接用中文名告诉助手想选哪一种。

[图文讲解](#图文讲解) · [夜色与未来](#夜色与未来) · [纸艺与手绘](#纸艺与手绘) · [立体与微缩](#立体与微缩) · [古典与东方](#古典与东方) · [光影与绘画](#光影与绘画) · [图形与幻想](#图形与幻想) · [印刷与装饰](#印刷与装饰)

缩略图均来自随仓库分发的真实样片，没有自动播放。多数是短片段，完整音频与来源见 [样片说明](samples/README.md)；铜版雕刻是 12 秒无声材质研究，等距剖解暂缺样片并明确标出。

### 图文讲解

从白板板书到大字排版，让文字、图形和重点信息走到画面前。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/swiss-print-sample.jpg" width="320" alt="版式风格实际样片预览">](samples/swiss-print-sample.mp4)<br>**版式**<br>黑白红大字配整齐留白，像会动的海报<br>[播放版式样片](samples/swiss-print-sample.mp4) | [<img src="samples/posters/chalk-sample.jpg" width="320" alt="黑板风格实际样片预览">](samples/chalk-sample.mp4)<br>**黑板**<br>深绿黑板配粉笔字，擦写之间带出课堂感<br>[播放黑板样片](samples/chalk-sample.mp4) |
| [<img src="samples/posters/blueprint-sample.jpg" width="320" alt="蓝图风格实际样片预览">](samples/blueprint-sample.mp4)<br>**蓝图**<br>深蓝底上铺开白色线稿，像在读工程图纸<br>[播放蓝图样片](samples/blueprint-sample.mp4) | [<img src="samples/posters/paperclip-sticker-sample.jpg" width="320" alt="贴纸人风格实际样片预览">](samples/paperclip-sticker-sample.mp4)<br>**贴纸人**<br>白边贴纸串起信息，跟着镜头边走边看<br>[播放贴纸人样片](samples/paperclip-sticker-sample.mp4) |
| [<img src="samples/posters/hanazi-916-sample.jpg" width="101" alt="花字风格实际样片预览">](samples/hanazi-916-sample.mp4)<br>**花字**<br>彩色大字蹦进竖屏，带着综艺式热闹节奏<br>[播放花字样片](samples/hanazi-916-sample.mp4) | [<img src="samples/posters/line-art-sample.jpg" width="320" alt="线条风格实际样片预览">](samples/line-art-sample.mp4)<br>**线条**<br>细线一笔笔画出轮廓，黑金配色干净舒展<br>[播放线条样片](samples/line-art-sample.mp4) |
| [<img src="samples/posters/grain-flat-sample.jpg" width="320" alt="颗粒扁平风格实际样片预览">](samples/grain-flat-sample.mp4)<br>**颗粒扁平**<br>平涂色块配细碎颗粒，人物动作富有弹性<br>[播放颗粒扁平样片](samples/grain-flat-sample.mp4) | [<img src="samples/posters/whiteboard-sample.jpg" width="320" alt="白板风格实际样片预览">](samples/whiteboard-sample.mp4)<br>**白板**<br>彩色笔尖边讲边画，像面对面在白板说明<br>[播放白板样片](samples/whiteboard-sample.mp4) |
| [<img src="samples/posters/kinetic-type-sample.jpg" width="320" alt="字动风格实际样片预览">](samples/kinetic-type-sample.mp4)<br>**字动**<br>重点词跟着节奏跳出来，让文字成为主角<br>[播放字动样片](samples/kinetic-type-sample.mp4) | [<img src="samples/posters/math-lab-sample.jpg" width="320" alt="数学屋风格实际样片预览">](samples/math-lab-sample.mp4)<br>**数学屋**<br>让几何图形动起来，把抽象规律画给你看<br>[播放数学屋样片](samples/math-lab-sample.mp4) |

### 夜色与未来

暗色背景、发光线条和复古电子屏，呈现不同的科技氛围。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/deep-space-sample.jpg" width="320" alt="深空风格实际样片预览">](samples/deep-space-sample.mp4)<br>**深空**<br><sub>暗色信息设计家族</sub><br>深黑底配冷青亮色，让产品画面更醒目<br>[播放深空样片](samples/deep-space-sample.mp4) | [<img src="samples/posters/mg-purple-sample.jpg" width="320" alt="夜航风格实际样片预览">](samples/mg-purple-sample.mp4)<br>**夜航**<br><sub>暗色信息设计家族</sub><br>黑底紫色章节卡，沿着清晰步骤展开讲解<br>[播放夜航样片](samples/mg-purple-sample.mp4) |
| [<img src="samples/posters/neon-sample.jpg" width="320" alt="霓虹风格实际样片预览">](samples/neon-sample.mp4)<br>**霓虹**<br>霓虹亮边映着雨夜反光，像走进发光街景<br>[播放霓虹样片](samples/neon-sample.mp4) | [<img src="samples/posters/crt-terminal-sample.jpg" width="320" alt="终端风格实际样片预览">](samples/crt-terminal-sample.mp4)<br>**终端**<br>黑底绿字逐字敲出，重现老式电脑屏幕<br>[播放终端样片](samples/crt-terminal-sample.mp4) |
| [<img src="samples/posters/pixel-arcade-sample.jpg" width="320" alt="街机风格实际样片预览">](samples/pixel-arcade-sample.mp4)<br>**街机**<br>彩色方块拼出画面，找回老街机的趣味<br>[播放街机样片](samples/pixel-arcade-sample.mp4) | [<img src="samples/posters/aurora-glass-sample.jpg" width="320" alt="玻璃风格实际样片预览">](samples/aurora-glass-sample.mp4)<br>**玻璃**<br>柔光在暗处慢慢漂移，磨砂玻璃卡片透亮<br>[播放玻璃样片](samples/aurora-glass-sample.mp4) |
| [<img src="samples/posters/vhs-outrun-sample.jpg" width="320" alt="公路夜风格实际样片预览">](samples/vhs-outrun-sample.mp4)<br>**公路夜**<br>网格公路通向落日，带着旧录像带的色差<br>[播放公路夜样片](samples/vhs-outrun-sample.mp4) | [<img src="samples/posters/target-lock-sample.jpg" width="320" alt="锁定风格实际样片预览">](samples/target-lock-sample.mp4)<br>**锁定**<br>雷达圆环扫描锁定，像电影中的未来仪表<br>[播放锁定样片](samples/target-lock-sample.mp4) |

### 纸艺与手绘

撕纸、折页、涂鸦和弹跳小人，保留手工制作的趣味。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/paper-collage-sample.jpg" width="320" alt="拼贴风格实际样片预览">](samples/paper-collage-sample.mp4)<br>**拼贴**<br>撕纸边、胶带和叠放纸片，拼出手作感<br>[播放拼贴样片](samples/paper-collage-sample.mp4) | [<img src="samples/posters/pop-comic-sample.jpg" width="320" alt="波普风格实际样片预览">](samples/pop-comic-sample.mp4)<br>**波普**<br>粗黑线配鲜艳网点，爆炸框带出漫画冲劲<br>[播放波普样片](samples/pop-comic-sample.mp4) |
| [<img src="samples/posters/popup-book-sample.jpg" width="320" alt="立体书风格实际样片预览">](samples/popup-book-sample.mp4)<br>**立体书**<br>牛皮纸场景随书页翻起，像打开立体绘本<br>[播放立体书样片](samples/popup-book-sample.mp4) | [<img src="samples/posters/ink-boil-sample.jpg" width="320" alt="线沸风格实际样片预览">](samples/ink-boil-sample.mp4)<br>**线沸**<br>线条轻轻抖动、色块略微错位，像手绘草稿<br>[播放线沸样片](samples/ink-boil-sample.mp4) |
| [<img src="samples/posters/dance-line-sample.jpg" width="320" alt="舞线风格实际样片预览">](samples/dance-line-sample.mp4)<br>**舞线**<br>涂鸦小人跟着节拍蹦跳，画面充满活力<br>[播放舞线样片](samples/dance-line-sample.mp4) | [<img src="samples/posters/rubberhose-sample.jpg" width="320" alt="橡皮管风格实际样片预览">](samples/rubberhose-sample.mp4)<br>**橡皮管**<br>软软的手脚摇摆伸展，像早期卡通动画<br>[播放橡皮管样片](samples/rubberhose-sample.mp4) |

### 立体与微缩

从玩具般的小镇到影棚物件，用空间、材质和镜头讲故事。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/clay-town-sample.jpg" width="320" alt="黏土风格实际样片预览">](samples/clay-town-sample.mp4)<br>**黏土**<br><sub>微缩等距场景家族</sub><br>像手捏出来的黏土小镇，柔软圆润又亲切<br>[播放黏土样片](samples/clay-town-sample.mp4) | [<img src="samples/posters/isometric-city-sample.jpg" width="320" alt="等轴风格实际样片预览">](samples/isometric-city-sample.mp4)<br>**等轴**<br><sub>微缩等距场景家族</sub><br>斜看微缩城市，楼房一座座长出并移过<br>[播放等轴样片](samples/isometric-city-sample.mp4) |
| [<img src="samples/posters/studio-oneshot-sample.jpg" width="320" alt="一镜风格实际样片预览">](samples/studio-oneshot-sample.mp4)<br>**一镜**<br>镜头穿行暗色影棚，瓷质物件泛起双色光<br>[播放一镜样片](samples/studio-oneshot-sample.mp4) | [<img src="samples/posters/soft-jelly-sample.jpg" width="320" alt="软糖风格实际样片预览">](samples/soft-jelly-sample.mp4)<br>**软糖**<br>软糖般的立体物件，成排起伏像柔软波浪<br>[播放软糖样片](samples/soft-jelly-sample.mp4) |
| [<img src="samples/posters/chrome-ball-sample.jpg" width="320" alt="铬球风格实际样片预览">](samples/chrome-ball-sample.mp4)<br>**铬球**<br>金属球映着棋盘房间，像早期电脑动画<br>[播放铬球样片](samples/chrome-ball-sample.mp4) | **等距剖解**<br>**预览待补**<br>机器分层拆解的实验素材，暂无随包预览<br>[查看现有素材说明](styles/isometric-anatomy/SPEC.md) |

### 古典与东方

岩壁、陶器、金箔、皮影与水墨，把传统材料带进画面。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/epic-paper-sample.jpg" width="320" alt="神话风格实际样片预览">](samples/epic-paper-sample.mp4)<br>**神话**<br>暖纸、朱红印章与金线，铺开古风叙事<br>[播放神话样片](samples/epic-paper-sample.mp4) | [<img src="samples/posters/sand-sample.jpg" width="320" alt="沙画风格实际样片预览">](samples/sand-sample.mp4)<br>**沙画**<br>手影铺开细沙，擦出海上晨光与窗边光影<br>[播放沙画样片](samples/sand-sample.mp4) |
| [<img src="samples/posters/guofeng-scroll-sample.jpg" width="320" alt="月窗风格实际样片预览">](samples/guofeng-scroll-sample.mp4)<br>**月窗**<br>金线月窗配竖排题字，像缓缓展开的长卷<br>[播放月窗样片](samples/guofeng-scroll-sample.mp4) | [<img src="samples/posters/cave-wall-sample.jpg" width="320" alt="岩壁风格实际样片预览">](samples/cave-wall-sample.mp4)<br>**岩壁**<br>赭红手印落在粗粝岩壁，火光摇出远古感<br>[播放岩壁样片](samples/cave-wall-sample.mp4) |
| [<img src="samples/posters/tomb-wall-sample.jpg" width="320" alt="墓室风格实际样片预览">](samples/tomb-wall-sample.mp4)<br>**墓室**<br>古埃及人物与象形符号，沿着壁画讲故事<br>[播放墓室样片](samples/tomb-wall-sample.mp4) | [<img src="samples/posters/amphora-sample.jpg" width="320" alt="陶瓶风格实际样片预览">](samples/amphora-sample.mp4)<br>**陶瓶**<br>黑色剪影衬橙红陶底，故事环绕古希腊陶瓶<br>[播放陶瓶样片](samples/amphora-sample.mp4) |
| [<img src="samples/posters/mosaic-sample.jpg" width="320" alt="马赛克风格实际样片预览">](samples/mosaic-sample.mp4)<br>**马赛克**<br>细小石块拼出图案，带着古老镶嵌画质感<br>[播放马赛克样片](samples/mosaic-sample.mp4) | [<img src="samples/posters/gold-leaf-sample.jpg" width="320" alt="金箔风格实际样片预览">](samples/gold-leaf-sample.mp4)<br>**金箔**<br>金箔纹样与华丽字母，映着抄写员的夜灯<br>[播放金箔样片](samples/gold-leaf-sample.mp4) |
| [<img src="samples/posters/shadow-play-sample.jpg" width="320" alt="皮影风格实际样片预览">](samples/shadow-play-sample.mp4)<br>**皮影**<br>镂空人物在灯前活动，白布上映出皮影戏<br>[播放皮影样片](samples/shadow-play-sample.mp4) | [<img src="samples/posters/ink-tea-sample.jpg" width="320" alt="水墨风格实际样片预览">](samples/ink-tea-sample.mp4)<br>**水墨**<br>淡墨在纸上缓缓洇开，浓淡与留白相映<br>[播放水墨样片](samples/ink-tea-sample.mp4) |

### 光影与绘画

用笔触、水色、天光和阴影，营造安静、明亮或浓烈的情绪。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/light-dabs-sample.jpg" width="320" alt="光斑风格实际样片预览">](samples/light-dabs-sample.mp4)<br>**光斑**<br><sub>印象派光色家族</sub><br>碎短笔触汇成光斑，色彩缓缓变换<br>[播放光斑样片](samples/light-dabs-sample.mp4) | [<img src="samples/posters/lily-pond-sample.jpg" width="320" alt="睡莲风格实际样片预览">](samples/lily-pond-sample.mp4)<br>**睡莲**<br><sub>印象派光色家族</sub><br>莲叶漂在粼粼水面，柳影与光色轻轻摇晃<br>[播放睡莲样片](samples/lily-pond-sample.mp4) |
| [<img src="samples/posters/swirl-oil-sample.jpg" width="320" alt="星涡风格实际样片预览">](samples/swirl-oil-sample.mp4)<br>**星涡**<br>长笔触卷成星空漩涡，浓烈色彩随之流动<br>[播放星涡样片](samples/swirl-oil-sample.mp4) | [<img src="samples/posters/hard-light-sample.jpg" width="320" alt="硬光风格实际样片预览">](samples/hard-light-sample.mp4)<br>**硬光**<br>斜光切入安静房间，长长阴影带出孤独感<br>[播放硬光样片](samples/hard-light-sample.mp4) |
| [<img src="samples/posters/sfumato-sample.jpg" width="320" alt="晕涂风格实际样片预览">](samples/sfumato-sample.mp4)<br>**晕涂**<br>轮廓融入柔和光雾，颜色层层晕开<br>[播放晕涂样片](samples/sfumato-sample.mp4) | [<img src="samples/posters/watercolor-cel-sample.jpg" width="320" alt="水彩赛璐璐风格实际样片预览">](samples/watercolor-cel-sample.mp4)<br>**水彩赛璐璐**<br>水彩背景衬着动画人物，风吹出层层动感<br>[播放水彩赛璐璐样片](samples/watercolor-cel-sample.mp4) |
| [<img src="samples/posters/optical-dots-sample.jpg" width="320" alt="点彩风格实际样片预览">](samples/optical-dots-sample.mp4)<br>**点彩**<br>细小彩点并排铺开，远看汇成柔和色彩<br>[播放点彩样片](samples/optical-dots-sample.mp4) | [<img src="samples/posters/candle-light-sample.jpg" width="320" alt="烛光风格实际样片预览">](samples/candle-light-sample.mp4)<br>**烛光**<br>一束烛光照亮暗处，让明暗成为画面主角<br>[播放烛光样片](samples/candle-light-sample.mp4) |
| [<img src="samples/posters/cumulus-light-sample.jpg" width="320" alt="积雨云风格实际样片预览">](samples/cumulus-light-sample.mp4)<br>**积雨云**<br>高耸云团间透出光柱，天空色彩明亮浓郁<br>[播放积雨云样片](samples/cumulus-light-sample.mp4) | [<img src="samples/posters/blue-period-sample.jpg" width="320" alt="蓝时期风格实际样片预览">](samples/blue-period-sample.mp4)<br>**蓝时期**<br>蓝色铺满画面，缓慢节奏带出低沉情绪<br>[播放蓝时期样片](samples/blue-period-sample.mp4) |

### 图形与幻想

液滴相融、图形变身、空间扭曲，适合浏览大胆的视觉变化。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/liquid-flow-sample.jpg" width="320" alt="液态风格实际样片预览">](samples/liquid-flow-sample.mp4)<br>**液态**<br>圆润液滴相融又拉开，像流动的彩色软胶<br>[播放液态样片](samples/liquid-flow-sample.mp4) | [<img src="samples/posters/morph-sample.jpg" width="320" alt="形变风格实际样片预览">](samples/morph-sample.mp4)<br>**形变**<br>图形不断伸缩变身，一个形状接着另一个<br>[播放形变样片](samples/morph-sample.mp4) |
| [<img src="samples/posters/pop-dot-sample.jpg" width="320" alt="弹点风格实际样片预览">](samples/pop-dot-sample.mp4)<br>**弹点**<br>明快色块弹跳入场，轻轻挤压后再回弹<br>[播放弹点样片](samples/pop-dot-sample.mp4) | [<img src="samples/posters/dot-infinity-sample.jpg" width="320" alt="波点风格实际样片预览">](samples/dot-infinity-sample.mp4)<br>**波点**<br>波点铺满南瓜与画面，点阵一呼一吸<br>[播放波点样片](samples/dot-infinity-sample.mp4) |
| [<img src="samples/posters/facets-sample.jpg" width="320" alt="切面风格实际样片预览">](samples/facets-sample.mp4)<br>**切面**<br>物体拆成几何切面，不同角度同时展开<br>[播放切面样片](samples/facets-sample.mp4) | [<img src="samples/posters/scream-warp-sample.jpg" width="320" alt="呐喊风格实际样片预览">](samples/scream-warp-sample.mp4)<br>**呐喊**<br>血红天空扭曲翻涌，桥上身影透出不安<br>[播放呐喊样片](samples/scream-warp-sample.mp4) |
| [<img src="samples/posters/soft-clock-sample.jpg" width="320" alt="软钟风格实际样片预览">](samples/soft-clock-sample.mp4)<br>**软钟**<br>柔软时钟垂挂在荒漠，长影拉出梦境感<br>[播放软钟样片](samples/soft-clock-sample.mp4) | [<img src="samples/posters/hypnotic-sample.jpg" width="320" alt="催眠风格实际样片预览">](samples/hypnotic-sample.mp4)<br>**催眠**<br>同心圆卷成旋转漩涡，循环节奏带来迷幻感<br>[播放催眠样片](samples/hypnotic-sample.mp4) |

### 印刷与装饰

错位套色、细密刻线、藤蔓花框与金色纹样，突出图案和纸面质感。

| 风格预览 | 风格预览 |
|:---:|:---:|
| [<img src="samples/posters/ink-plate-sample.jpg" width="320" alt="墨版风格实际样片预览">](samples/ink-plate-sample.mp4)<br>**墨版**<br><sub>套色印刷家族</sub><br>几何色块交错移动，像纸上错位叠印的油墨<br>[播放墨版样片](samples/ink-plate-sample.mp4) | [<img src="samples/posters/riso-print-sample.jpg" width="320" alt="孔版风格实际样片预览">](samples/riso-print-sample.mp4)<br>**孔版**<br><sub>套色印刷家族</sub><br>双色油墨错位叠在一起，留下细密印刷网点<br>[播放孔版样片](samples/riso-print-sample.mp4) |
| [<img src="samples/posters/whiplash-line-sample.jpg" width="320" alt="鞭线风格实际样片预览">](samples/whiplash-line-sample.mp4)<br>**鞭线**<br>藤蔓般的弧线伸展，围成优雅海报花框<br>[播放鞭线样片](samples/whiplash-line-sample.mp4) | [<img src="samples/posters/gold-robe-sample.jpg" width="320" alt="金袍风格实际样片预览">](samples/gold-robe-sample.mp4)<br>**金袍**<br>金色纹样裹住人物，脸孔与华丽图案相映<br>[播放金袍样片](samples/gold-robe-sample.mp4) |
| [<img src="samples/posters/engraving-sample.jpg" width="320" alt="铜版雕刻风格实际样片预览">](samples/engraving-sample.mp4)<br>**铜版雕刻**<br>细密刻线描出梨形，十二秒无声材质研究<br>[播放铜版雕刻样片](samples/engraving-sample.mp4) · [竖屏](examples/engraving/portrait.mp4) |  |

想按名称、类型或气质筛选？下载完整项目后，用本地浏览器打开 [风格选择页](samples/index.html)，或看 [全部变体页](samples/all.html)。GitHub 中的 HTML 链接显示源码，需要在本地打开。

<sub>本展示由 [风格目录](styles/catalog.json) 自动生成。风格选项是制作方向；其中 12 个支持模板的配色/覆盖层切换，其余按对应图元接入，主体镜头都需要围绕内容制作。[开发接入说明](styles/README.md)</sub>
<!-- style-catalog:end -->

## 开始安装

需要一个能执行制作任务的 AI 助手，以及视频制作环境。你可以把[上手指南](docs/getting-started.md)交给助手，请它先检查条件，再按你的授权配置；也可以照着文档自己操作。

- [第一次使用：下载、安装、创建视频工程](docs/getting-started.md)
- [轻量 core / 完整 full 安装配置](docs/package-profiles.md)：core 保留全部风格与缩略图，仅省略样片 MP4；旧命令默认仍为 full
- [不同助手的安装位置与使用说明](docs/adapters.md)
- [先试跑一段不需要 API key 的铜版雕刻样片](examples/engraving/README.md)

底层使用 Remotion 制作动画，完整流程需要 Node.js/npm、ffmpeg、浏览器，以及配音工具使用的 Python/uv。安装成功后，还要确认助手确实能运行工具和检查输出；普通的纯聊天窗口无法直接生成这里所说的成片。

## 常见问题

### 不会写代码，可以用吗？

你可以用自然语言说明需求、选画风和改内容。代码制作交给有相应能力的 AI 助手；首次环境配置仍需要完成，遇到权限或运行错误时也需要处理。它不能保证所有助手都一次做成功。

### 是一键生成吗？

制作会经过稿件确认、小样和审片。默认先与你确认文案方向与全文，再继续配音和画面；模型能力、资料质量和修改轮次都会影响结果。样片展示的是已有的具体效果，不承诺任意主题都能一次做到相同水准。

### 需要付费或填 API key 吗？

仓库代码与文档开源。AI 助手的模型费用、部分配音或素材服务，以及渲染算力可能产生费用，取决于你选择的工具。默认配音可使用无需单独填写 key 的在线服务；AI 生图是可选项，程序绘制画面不需要生图 key。配置、联网要求与费用边界见[上手指南](docs/getting-started.md#网络密钥与费用)。

### 我能拿到什么？还能修改吗？

目标交付包括 MP4、可编辑工程、字幕、封面、旁白和来源/检查记录，由助手按任务整理。工程保留了文案、镜头和素材，方便后续修改；改动后需要重新制作并检查，不是改一个文件就自动更新所有成品。

### 能直接商用或发布吗？

项目代码和文档采用 [MIT](LICENSE)。字体、音乐、音效、图片和生成素材各有许可，发布前需要确认实际使用权限和适用的 AI 内容标识。尤其曲库 `wx-*` 外部音乐仍需确权，见[音频来源与许可](assets/audio/ATTRIBUTION.md)。仓库开源不代表所有素材都可任意商用。

## 进一步了解

| 你想了解 | 文档 |
|---|---|
| 开始制作、解决环境问题 | [上手指南](docs/getting-started.md) · [宿主适配](docs/adapters.md) |
| 样片来源与可复现案例 | [样片说明](samples/README.md) · [线条讲解 A/B](examples/line-art-teaching/README.md) · [铜版雕刻](examples/engraving/README.md) |
| 如何写稿、设计镜头与检查成片 | [制作入口](SKILL.md) · [导演手册](reference/directing-playbook.md) · [生产合同](reference/production-contract.md) |
| 按题材选择制作方法 | [知识讲解](recipes/explainer.md) · [产品宣传](recipes/promo.md) · [自由风格](recipes/custom.md) · [品牌史诗](recipes/epic.md) · [档案纪录片](recipes/documentary.md) |
| 开发与贡献 | [风格资产与接入](styles/README.md) · [动效配方卡](gallery/README.md) · [回归验证](docs/getting-started.md#回归验证) |

讲解规范与模板源于 [anything2explainer](https://github.com/Vincentwei1021/anything2explainer)。第三方代码归属见 [LICENSE-THIRDPARTY](LICENSE-THIRDPARTY)，程序编曲来源见 [audio-engine/VENDOR.md](audio-engine/VENDOR.md)。本项目与所列模型、助手或发布平台无官方合作关系。

### 命名事件与到达点编排

[事件编排指南](reference/cue-choreography.md) 将接触、确认、停留与交接写成同一条依赖链。改一处停留，下游自动顺延；动作到达/揭示对准真实旁白或已验证的录音拍点。新工程 Studio 的 CueDemo 可直接查看，默认 Video 与实录音乐选择不变。
