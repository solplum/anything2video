# 生产流程

这里只安排顺序、产物与命令；共享规则唯一来源是 [production-contract.md](production-contract.md)。稿件授权只走其 [文案确认门](production-contract.md#script-approval)，不得把主控内部审定写成用户确认。专题文档在用到时再读。

## 0. 能力与工程

首次制作按契约 [能力与授权](production-contract.md#capabilities) 确定包外根目录、选型与持久决定，实测文件/命令、看图、视频播放、音频听取、TTS、生图和子代理能力。未知根目录先问；续作直接以磁盘工程为准：

```sh
node <skill>/scripts/doctor.mjs
node <skill>/scripts/check_state.mjs <已有工程>
# 仅新工程：根目录已明确后初始化，不覆盖已有工程
node <skill>/scripts/init.mjs <工程绝对路径> <slug>
```

工程内 `npm ci`、`uv sync`、`npx remotion browser ensure`（或设 `BROWSER_EXECUTABLE`）；保留源码/锁文件，不提交缓存。check_state 七态不含稿件批准，主控另核授权；缺证据会回拨。`--write` 仅在无渲染/静帧证据时同步 `project.json.state`，同值不改；渲染后用只读报告保留源码哈希。无旁白/静音工程另核计划、渲染与 QC，不能据此宣称 delivered。

<a id="research"></a>
## 1. 调研

写 `research/creative-brief.md`：受众、目标/结论、平台与画幅、语言、时长、事实/品牌/预算约束、贯穿示例和首尾关系。事实表记来源、访问日期与待核项；选 3–5 个有证据的参考案例，缺案例库就注明。

文化/历史/文学/科普等题材按 [corpus-sources.md](corpus-sources.md) 候选前清单摸底、定稿前全文提取与引文核对；现代产品/软件教程走官方资料。有对标片时按 [reference-breakdown.md](reference-breakdown.md) 量结构/转场/运动，记实际观看窗与证据等级。抽象技术先按 [directing-playbook.md](directing-playbook.md) 比较机械隐喻、数据流、真实 UI 与简洁图解；采用隐喻则写映射与边界。

<a id="script-and-audio"></a>
## 2. 稿件、声音与真实时间轴

按契约 [文案确认门](production-contract.md#script-approval) 完成方向与全文；获确认或已有明确稿件级豁免后才写正本/批准证据。教学稿交代前提、步骤、结果和失败修复，不能只念标题。

分镜前定音色；有音乐则定曲，按 [音频契约](production-contract.md#audio) 走对应试听。工程内生成/导入清洁配音，再用真实音频建立时间轴：`uv run python scripts/tts_build.py`；自带成品配音用 `scripts/align_narration.py`，无旁白用 `scripts/chapter_timeline.py`。详细入口见 [工具索引](tools-and-components.md#audio-tools)。

随后 `uv run python scripts/mix_audio.py`；选了钉帧 SFX 才第三步跑 `scripts/mix_sfx.py`，重混后也要重跑这一步。核对头尾/中段对位与完整听感。旁白或音色变更先走原授权边界，再重建时间轴并重锚所有下游，不用旧槽位硬塞。

## 3. 结构化分镜

按契约 [工程合同](production-contract.md#project-contract) 写 `project.json`、`script/storyboard.json` 与 `research/beat-sheet.json`（先核实生成通道再排 AI 镜头）。按镜头到 [gallery](../gallery/README.md) 选卡并读参数。依据导演手册记录动作语法、焦点、词/拍锚点（用 `narration.txt` 的 `{#id}` 接 `at()`/`local()`，禁从 `timeline.md` 抄数字）与停留/切换理由；事实镜头绑定 claims。选了[匹配剪辑模式](match-cut-beat-relay.md)时，先定意义与音乐网格再写接力合同。

<a id="proofing"></a>
## 4. 图纸与多点打样

沿既有套餐和稿件决定，按 [visual-direction.md](visual-direction.md) 比较实渲方向，或沿用已验证 SKU 并做回归；不重开风格问卷。开场、复杂中段、结尾都看，含真实配音、字幕与运动片段。

未建完全片时用包外独立 draft 样片工程，不删主工程未完成镜头伪装完成。中后段预览：`node <skill>/scripts/render.mjs <工程> preview <秒数> <1起开始帧>`。单窗同名 preview 不随 VER 改名；多窗可用 [批量审片包](action-review.md#batch-review)，共享 bundle、独立命名、待审。重用原名先成对归档媒体/sidecar，再 `--overwrite`。

## 5. 建镜头与集成

先固定共享图元/API，再按 [workflow-orchestration.md](workflow-orchestration.md) 分配独立文件；无子代理就同合同顺序做。镜头区段与内部动作统一用 `span()`/`at()`/`local()` 引用 `anchors.ts`，禁手抄帧号。主控检查注册、字幕/音轨、组界和覆盖层。占位通过类型检查不等于成立。

## 6. 渲染

工程内先 `npm run typecheck`，再用统一入口：

```sh
node <skill>/scripts/check-plan.mjs <工程>
node <skill>/scripts/render.mjs <工程> stills 1,90
node <skill>/scripts/render.mjs <工程> preview 12
# 正式全片先设 status=production；此变更也要求重渲
node <skill>/scripts/render.mjs <工程> video
```

所有模式检完整计划；同输出互斥，`--overwrite` 才覆盖。fast 迭代可用 `A2V_SCALE=1 A2V_BUNDLE_CACHE=1`，**正式/QC 前须关 `A2V_BUNDLE_CACHE` 保干净重建**（[画质与速度](speed-and-quality.md#pace)）。生产仅用 `init.mjs` / `render.mjs`；`bloom_grade.py` 须在审片前定稿。

## 7. 审核与修复

按契约 [三轮证据](production-contract.md#review) 做 A/B/C 审查（含 `semantic-sync-pack.mjs` 抽帧对位）与 [jury-review.md](jury-review.md) D 评分。`qc/round-N.md` 记现象、原因、改动、重渲哈希、范围与保留项，修后回归边界。

需要时读取 [可读性](readability.md)、[动作复核](action-review.md)、运动/线头等探针说明；工具产物不取代看片和试听。无播放/听取能力时保留 `not_performed`，可交待审稿与工程，不标最终通过。

## 8. 终检、交付与回写

实际播放整片、听取完整音轨，按契约 [终检](production-contract.md#delivery) 运行 `finalize_delivery.mjs`，按 [最终 QC 数据合同](production-contract.md#final-qc) 写 `qc/final.json` 并跑 `check-qc.mjs`。核对当前媒体/源码/审查/终检报告一致，改动使旧证据失效，不自动沿用 passed。

交付物、评分、弱点与未测能力按契约列齐；遵守 [画幅与发布](production-contract.md#publication)。实验性剪映草稿见[导出说明](../recipes/documentary.md#editor-draft)，经验回写见[上下文索引](context-index.md)。
