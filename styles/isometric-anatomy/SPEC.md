# SPEC：仪器解剖（isometric-anatomy）

**风格定义**：硬核等轴测机械解剖与精密仪器装配（借鉴 Anatomy，MIT，wheresryan22）。
**核心灵魂**：**"The object is the explanation"（物体即解释）**——彻底告别抽象卡片与空洞箭头，将任何技术系统、协议、算法或业务模型具象化为一台具备真实厚度、物理零件、管路回路与实时表盘的精密工业仪器。

## 锁死项

1. **色 token**：
   - **暗色工坊（Dark Lab，默认）**：
     - `bg` `#0c0d0e`｜`base` `#16181a`｜`structure` `#222529`｜`subject` `#32373e`｜`lit` `#ffffff`（高亮唯一焦点）
     - `stroke` `#525964` (0.8px)｜`strokeFaint` `#2d3239` (0.5px)｜`accent` `#60a5fa`（冷蓝指示）｜`gold` `#f59e0b`（铜件/阀门）
   - **纸面图纸（Light Drafting，可选）**：
     - `bg` `#f8fafc`｜`base` `#f1f5f9`｜`structure` `#e2e8f0`｜`subject` `#cbd5e1`｜`lit` `#0f172a`（深黑吸墨）
     - `stroke` `#475569`｜`strokeFaint` `#cbd5e1`｜`accent` `#2563eb`

2. **几何与等轴测相机（Isometric Camera）**：
   - 方位角 `Azimuth: 45°`（可调 35°~60° 展示长边），仰角 `Elevation: 30°`。
   - 空间坐标：x/y 贴地，z 垂直向上。
   - 零件四阶光影（Four Tone Shades）：侧壁严格根据表面法向与主光照（俯角 1.2、左上方）点积离散或渐变分层，绝无纯黑面或纯白面死区。

3. **物理装配铁律（Physical Assembly Disciplines）**：
   - **实体厚度**：所有底座、滑轨、法兰、面板均具备真实 z 轴厚度与 0.4~1.2px 倒角（Bevel），严禁 0 维纯线框（Wireframe）。
   - **管线不穿模**：管道（Tubes）间、管道与实体间保持至少 1.5 倍管径间隙；管道端头必须落在法兰、气阀或基座端子上，严禁悬空。
   - **线头必闭合**：所有刻度线、焊缝、加强筋必须精确落在零件边缘或轮廓线上，严禁孤立浮空线（通过 `probe_svg_craft` 自动拦截）。
   - **零件层级**：从底座（Base Plate on feet）$\rightarrow$ 结构骨架（Rails & Posts）$\rightarrow$ 驱动滑块（Carriage & Bushings）$\rightarrow$ 被测目标（Lit Subject），层层依托。

4. **动态与节拍契约**：
   - 动作遵循机械阻尼弹簧（`dampedSettle`）或真实刚体冲程（`stroke` 限制），禁止突兀无缓冲匀速移动。
   - 读数表盘（Dial Gauge）与数字滚轮（DigitRoll）实时反映物理位移数值，表盘指针晃动与弹簧阻尼完全同源同频。
   - 爆炸装配动画（Exploded View）必须使用层级错相（Staggered Spring），按装配反序由外向内或由内向外展开，深度动态重排序，杜绝穿模。

## 适用场景与配方映射

- **技术科普（explainer）**：数据库连接池、分布式锁、并发队列、Token Bucket、GC 垃圾回收、内存寻址、零拷贝网络协议。
- **产品工业宣传（promo）**：硬件设备、发动机、精密机床、高科技消费电子剖视。

## 样张基准

- 样片帧标准：重型底座带脚垫螺栓、双轨滑台、弹簧减震活塞、进出气管路带管套、带数字刻度与活动指针的千分表，1x 整体宏大，4x 放大每一个螺丝和接头依然精美无可挑剔。
