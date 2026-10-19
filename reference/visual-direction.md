# 视觉方向：实渲染后再定盘

用于 SKILL 第 4 步图纸与打样。沿用套餐、文案确认与三轮审片，不新增一套用户审批或状态机。已授权主控决定时直接记录选择理由；用户指定的品牌、画幅、文案与风格仍是约束。

## 比什么

方向未定时，使用同一段已确认文案、同一目标画幅和内容顺序，渲染两个方向。把差异落实到四项，而不是两张不同色的同版式：

- composition：主体比例、焦点位置、留白、层级与信息出现顺序
- typography：字族/字重、字号层级、断行、文字和图形的空间关系
- palette：明暗基调、对比与强调色的职责；有固定品牌色时可改变中性色、面积与对比关系，不另造品牌色
- motion：continuous / montage / hybrid 的使用、主动作、阅读停留和切点

例如同一句“缓存命中时，直接复用上次结果”：A 用纸白版式、左对齐标题、上下两次请求对照、干净硬切；B 用深色单场景、嵌入对象的标签、同一请求沿两条路径连续演示。两者都需要解释“同一请求、复用结果”，不能把一个故意做差当陪衬。

每个方向实渲染：开场、复杂中段、结尾各一帧，以及至少一个能检验核心动作/切点的短运动片段。关键帧使用最终字体、目标画幅、代表性的文字量和字幕位置。风格库海报、生成图或设计草图不能代替当前文案的渲染证据。用既有 render.mjs 的 stills / preview，保留其 .delivery.json sidecar；样片工程仍须通过完整分镜与 TypeScript 门禁。

先在目标画幅查看，再以 480px 宽度查看：第一眼看哪里？不听声音能看到什么变化？文字能否读完？背景或转场是否抢走重点？看过帧才能判断静态构图；看过真实片段才能判断节奏。缺播放/听取能力时明确 not_performed，不能用接触表代替。

方向选定后，保留理由和放弃另一方向的具体原因，再固定图元与运动规则。修复时同文案、同片段对照，并复看相邻边界。已有验证过的 SKU / 同系列明确沿用可用 reuse 模式，仍渲三处回归和核心运动，不强迫重新两选一。

## 接入既有 check-plan

在新制作的 project.json 增加：

```json
{"visualDirection":"research/visual-direction.json"}
```

manifest 示例（以下只展开一条证据；实际每候选必须有 opening / middle / ending 三张关键帧和至少一段 motion）：

```json
{
  "schemaVersion": 1,
  "mode": "compare",
  "selectedCandidate": "paper-comparison",
  "rationale": "上下两次请求的对照更适合本段；读者不必记住已经消失的第一次结果。",
  "candidates": [
    {
      "id": "paper-comparison",
      "treatment": {
        "composition": "上下两次请求对照，结果列右对齐",
        "typography": "左对齐黑体大标题，等宽请求标签",
        "palette": "纸白底、炭黑文字、橙色只标记缓存结果",
        "motion": "hybrid；路径连续演示，章节硬切；结果稳定停留"
      },
      "evidence": [
        {"path":"research/directions/a/opening.png","sha256":"替换为实际文件的64位SHA256","kind":"keyframe","position":"opening"}
      ]
    }
  ]
}
```

- compare：至少两个候选，每对候选的四项 treatment 声明均不同；每个都有完整媒体证据。不是只为选中方向补图。整套证据完全相同（即使改名/重排）也会拒收；个别静止关键帧相同可以成立。
- reuse：恰好一个候选，增加非空 reuseReason，记录沿用哪个已验证版本与适用边界；证据要求相同。
- selectedCandidate 必须引用候选 id；rationale 不能留空。媒体为工程内非空 PNG/JPEG 或 MP4/WebM，path 相对工程根，sha256 必须实测匹配；三处关键帧不能引用同一个文件冒充。
- 如用独立 draft 工程打样，将采用的证据及 sidecar 成对复制到主工程 research/directions/ 下，再记录相对路径。不要改主工程分镜来绕过未完成镜头。
- draft 仅检查引用路径及已有 JSON 能否解析，允许尚未生成 manifest；因此仍能先渲候选。进入 production 后，既有 check-plan 才检查选择、四项声明、完整位置、文件签名与哈希。无需新增 check_state 状态。
- 老工程未声明 visualDirection 时保持兼容，报告 not_performed；这不表示其视觉方向已验收。新制作需主动声明上述字段。

机器只能证明“记录和文件一致”，不能证明候选真的不同、帧来自正确镜头或审查者看过。须把 manifest 与真实看片记录作为既有 qc/final.json 的 visual / motion 证据；不把 check-plan 的 passed 当作审美评分。更改内容、字体、画幅或关键运动后重渲相关候选，更新哈希，再复查片段和边界；旧的选择理由若不再成立要重定方向。
