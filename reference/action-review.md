# 关键动作连续性复核（可选证据）

全片 `probe_motion_quality.py` 的帧差只能定位疑点，不能判断手掌是否接住道具、接触点是否滑动、遮挡顺序是否正确、跟踪效果是否随镜头移动。对分镜中明确的关键动作，先看真实播放，再用 `scripts/action_review.py` 放大短时间窗；它不改变稿件、镜头、风格或既有 QC 门禁。

启用[匹配剪辑模式](match-cut-beat-relay.md)时，可从明确的动作窗/接力合同生成批量请求。逐切查看实际使用的出镜末帧、入镜首帧及邻帧，并在原尺寸检查手、产品、接触点与终态，再回到原速带声连续播放。缩略图或几何声明相符不能证明动作成立；生成的请求与审片包仍只是 `needs_review`。

<a id="batch-review"></a>
## 可选：一份请求批量生成预览与动作审片包

已有分镜后，可由制作代理从镜头动作和命名 cue 的真实时刻生成请求，**不要求用户手填 JSON，也不新增确认门**。这条可选路线调用同一个统一 renderer，一次完整计划/类型检查、一次 bundle 和一次共享浏览器会话处理多个片段/静帧；保持工程原画幅与 fps，不创建第二套授权或最终 QC。普通单窗命令仍保留。

最小请求只需 `{"schemaVersion":1,"id":"review-v1"}`。默认提出开场、**时间轴中点（不是自动识别“复杂中段”）**、结尾各 3 秒，以及每个镜头切点前后各约 0.5 秒；片长不足时夹到合法范围。每窗首尾另出静帧。自动选择只覆盖结构，不理解任意跳跃、转身、接物或跟踪语义；关键动作须由既有分镜/场景 cue 明确给出。不同重叠窗口有意保留；完全相同范围、静帧只生成一次，所有选择理由合并保留。

例如代理把下列文件写在工程的 `qc/review-request.json`。**示例数字仅对应一个至少 144 帧、具有 S2 的工程**，实际须用当前分镜/cue；`frame` / `from` / `to` 都是全片 **1 起含端点**，不是局部 Sequence 帧。将现有 cue 的 0 起帧转换一次，并先加回局部场景起点：

```json
{
  "schemaVersion": 1,
  "id": "review-v1",
  "automatic": {"windowSeconds": 3, "cutContextSeconds": 0.5},
  "windows": [{"id": "handoff", "from": 97, "to": 144, "shotId": "S2", "label": "交接与稳定", "note": "检查接触与遮挡，保留末尾阅读停留"}],
  "cues": [{"id": "request-arrive", "frame": 120, "beforeFrames": 12, "afterFrames": 18, "shotId": "S2", "label": "请求抵达"}],
  "stills": [{"id": "result", "frame": 144}],
  "actionReview": {"samples": 8, "roi": [0.2, 0.1, 0.6, 0.8]},
  "focus": ["道具身份与接触点连续"],
  "preserve": ["结果页的刻意静止与阅读时间"]
}
```

```sh
# 先列范围、数量和总预览时长；只写计划，不启动浏览器或伪造媒体
node <skill>/scripts/review-pack.mjs <工程> plan qc/review-request.json
# 按既有制作授权执行；不是额外审批按钮。阻塞时停在上面的 plan。
node <skill>/scripts/review-pack.mjs <工程> render qc/review-request.json
```

- `plan` 产 `qc/review-plans/<id>/`：`index.md`、`checklist.md`、`review.json` 和规范化 `request.json`；清楚标 `not_rendered`，没有媒体/抽帧哈希。它核对计划/素材，但不声称类型检查或浏览器渲染已运行。
- `render` 产 `renders/reviews/<id>/`：独立命名片段/静帧及 `.delivery.json`、`batch.json`，并带同样索引与清单。完整目录在成功后发布；不覆盖已有包，同 id 并发互斥。`plan` 和 `render` 目录分开，先计划再渲染不冲突；重新生成时用新 id。
- 开始渲染前打印片段/静帧数量与总预览时长（重叠片段重复计时）。`automatic` 可逐项关闭 `opening` / `middle` / `ending` / `cuts` / `endpointStills`；`automatic:false` 全关，改用明确选择。支持最多 128 个去重片段 / 512 张去重静帧，超预算报错，不偷偷少看。选项、帧范围、未知字段和大小写重复 id 均校验。
- 明确的 `windows` / `cues` 会**自动复用刚渲出的预览**调用现有 `action_review.py`，生成 `actions/<window-id>/` 条带；没有第二次渲染。默认 8 个等距目标点仅用于概览，不等于逐帧通过。`actionReview.interval` 可替代 `samples`（互斥）；可选归一化 `roi:[x,y,w,h]` 固定坐标，不自动跟踪；`enabled:false` 保留用户不生成条带的选择。需要不同 ROI 时分别生成请求/包。
- 自动条带需 Python 3.11+、Pillow、FFmpeg/ffprobe；`A2V_PYTHON` 可指向已有兼容 Python 环境，依赖不齐在启动渲染前明确报错，不静默安装。每次动作调用按**实际 PTS**拆成最多 12 个窗口，每窗 ≤30 秒且 ≤24 个目标；超过预算或单帧动作明确 `not_performed` 并解释原因。其他解码/抽帧错误中止包发布；不能拿空图或失败记录冒充已产证据。
- 普通开中末/切点只出片段与首尾静帧；只有调用者明确选中的动作窗才产动作条带。`reviewer`、`focus`、`preserve` 及每项 `label` / `note` 保留在清单，不因静帧重复或窗口重叠丢失。无检测结果不自动新增运镜或删掉有意义的静止。
- 索引显示完整起止帧/时间、涉及镜头、选择原因和相对媒体链接；清单绑定镜头目的/动作、组件哈希、媒体哈希、整个源码快照摘要及独立请求哈希。CLI 还绑定原始请求文件 SHA256；即使请求放在忽略输出的 `qc/`，运行中改动仍拒绝发布。不能把旧审查结论迁到新源码或新媒体。
- 动作报告保留实际 PTS 和预览 0 起解码索引，另记 `sourceFrame1Based = preview.from + decodedIndex`。`sourceTimeSec=(sourceFrame1Based-1)/fps` 是工程时间，不能混作视频实际 PTS。预览最后一帧局部秒数为 `(to-from)/fps`，**不是**编码时长 `(to-from+1)/fps`。为可搬移审片包，仅将报告输入定位改为相对路径，并明确记录该定位变更；不改测得的时间戳、图像或哈希。

所有清单初始 `needs_review`，视听始终 `not_performed`；成功退出只表示计划/证据生成成功。真正看过的范围、缺陷/刻意停顿、审片者与方法由实际观察记录。批量包仍是待审预览，不能当最终成片发布；最终完整看听与 [统一三轮/最终 QC 契约](production-contract.md#review) 不变。没有安全可用浏览器时只交 plan，不能绕过沙箱限制或用测试夹具冒充 Remotion 实渲。

## 用法

在已渲染的真实成片上运行（Python 3.11+、FFmpeg/ffprobe、Pillow；`uv run` 使用脚本内依赖）：

```sh
uv run <skill>/scripts/action_review.py <工程>/renders/film.mp4 \
  --window 4.2,6.2 --window 12,13.8 \
  --roi 0.25,0.2,0.5,0.6 --out <工程>/qc/action-v1
```

- `--window START,END`：必填，可重复 1–12 次；单位为相对**第一解码视频帧**的秒数，闭区间，每窗最长 30 秒。END 不得超过最后一帧时间戳（不是容器总时长）。无窗口就不扫描，不自动寻找“关键动作”。
- 默认 `--interval 0.2`：每 0.2 秒一个目标点，另加末端目标点（如未重合）。每窗最多 24 个目标；超过预算明确报错，缩短窗口或显式增大间隔，不静默降采样。
- `--samples 8`：可选的等距目标点总数（2–24，包含首尾），与 `--interval` 互斥。适合概览；不能用稀疏概览声称逐帧动作已过。
- 碰撞/接力附近要逐帧：缩到短窗，显式使用实际帧间隔。例如 30fps 的 0.3 秒窗用 `--interval 0.03333333333333333`；VFR 使用实际 PTS 检查，不能把平均 fps 当逐帧间隔。
- `--roi X,Y,W,H`：可选的归一化源画面矩形，正宽高，完整处于 `[0,1]` 内。每个采样同时保留全画面红框和局部放大；ROI 是固定源坐标，**不会自动跟踪主体**。主体移动出框时扩大 ROI 或分窗口分别运行。
- `--out` 必须是不存在的新目录；拒绝覆盖已有目录/文件/链接。失败不发布半套产物。媒体发生变化须新目录重跑。

每个目标点取**不早于目标点**的首个真实解码帧（允许 ffprobe 秒数小数的 1 微秒舍入误差）；不使用 fps 滤镜制造补帧。同一帧只列一次，若帧时间超过 END 则不纳入，所以不与帧对齐的 END 可能没有对应采样。至少须有两个不同采样帧。标签显示实际 PTS 偏移，不把请求目标秒数当作事实。24/30/60fps 和具有严格递增 PTS 的 VFR 均可；缺失、重复、非有限或倒退 PTS 明确拒绝。带旋转元数据的媒体请先规范化方向并重新渲染/编码，当前工具拒绝它，避免源尺寸与裁剪方向混淆。

## 产物与人工判断

- `window-01.png` 等：有序全画面/ROI 拼图，标注相对秒数及 **0 起解码帧索引**。它不是项目中 1 起分镜帧号；preview 视频的 0 秒对应 preview 自己的首帧。
- `review.json`：原视频路径与 SHA256、原始首帧 PTS、真实帧索引/绝对及相对 PTS、视频流实际帧率元数据、窗口/ROI/采样设置、PNG SHA256。`frameSha256` 是临时解码 PNG 的哈希（非编码包哈希）；临时帧不保留，复核可按同一源文件与索引重新抽取。源视频前后哈希须一致。
- `status` 永远是 `needs_review`，没有自动 `pass` 或审美分。退出 0 只代表证据生成成功，2 代表输入/解码/输出失败。

人工对照分镜检查：
1. 预备→接触→转移→释放→稳定，是否存在瞬移/穿帮/接触点漂移？道具身份、遮挡与肩臂连接是否连续？
2. 镜头运动后 iris/zoom/跟随效果是否仍贴住正确主体？全画面与局部同时看，防止裁剪遮掉上下文。
3. 回到原速带声音播放，检查节奏与因果。必要时加密更短窗口，0.2 秒也会漏一帧闪烁。
4. 在 `qc/round-N.md` 写动作名、窗口、缺陷/刻意停顿、改动与重渲哈希。联系既有 motion check 的真实播放证据，不能把图片生成记录冒充 `method=playback`。

阅读镜头、呼吸段、定帧、刻意跳切均可成立；工具不要求“必须动”、额外转场或固定运镜配额，也不修改旁白确认规则。它只覆盖选择的窗口，不证明全片、声音、事实或最终交付合格。

## 旧帧目录接触表

```sh
python <工程>/scripts/sheet.py <工程>/fin_frames <工程>/qc/sheet.html 60 6 --fps 24
```

原 positional 用法保留；未给 `--fps` 时在页面和 stdout 明示 **30fps assumed legacy default**。按实际 `f_<编号>.jpg` 数字编号计算 `(编号-1)/fps`，不因缺帧把时间压缩；`f_0001.jpg` 为 0 秒。帧目录没有视频 PTS 证据，只适用于已知 CFR；VFR 或来源不确定时用上面的成片工具。

## 来源与边界

动作放大和 0.2 秒关键动作复核的方法参考 lemo-opuscar 的 [DIRECTOR §9/§11](https://github.com/lemomo-ai/lemo-opuscar/blob/b5e8ef93930b6d828f352055a689320f138237b1/DIRECTOR.md) 与 [TECHNIQUE §2/§8/§10](https://github.com/lemomo-ai/lemo-opuscar/blob/b5e8ef93930b6d828f352055a689320f138237b1/TECHNIQUE.md)（2026-10-19 核验）。本工具为独立实现，沿用已有 [MIT 许可记录](../LICENSE-THIRDPARTY/MIT-lemo-opuscar.txt)；未复制上游 demo 视频、角色或素材。只吸收局部动作复核方法，不引入上游固定运镜数量、配乐或剪辑禁令。
