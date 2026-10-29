# 上下文资料索引（按需，不是生产规则）

当前共同授权、工程与验收规则只在 [production-contract.md](production-contract.md) 维护，执行顺序在 [production-workflow.md](production-workflow.md)。下面资料为历史背景、返工线索或上游参考：保留原路径和内容供复验，不默认整本加载，不以旧日期的处方、固定参数或宿主经验覆盖当前规则。

## 何时查哪里

| 需要 | 资料与证据边界 |
|---|---|
| 某个错误的返工原因 / 正面做法 | [lessons.md](lessons.md)：先按错误、组件或关键词定位对应行/节。条目是当时观察；标题中的“当前”、旧命令和“未实现”建议都须对照当前脚本/契约复验，不能自动当成新增门禁或已完成修复 |
| 黑底 MG 的公式 / 上游组件 / 对照帧 | [explainer/README.md](explainer/README.md)：先读 wrapper 的路径映射与边界，再只读所需快照文件。其 SKILL、确认点、固定画幅/配额/微动和宿主指令不具当前权威；原文保持可 diff |
| 外部案例、模型自述与视觉推测 | [opus55-cases.md](opus55-cases.md)：区分 author_claim、verified_project、visual_inference；历史链接使用时重新核验，不凭帖子数或标题推导已验证作品数 |
| 上游动效实现 | [gallery](../gallery/README.md)：当前卡片给动作参数，demos-ref/lib-ref 是参考源码，按本片移植并复验；授权与验收仍归统一契约 |
| 旧版迭代 / 兼容边界 | [docs](../docs) 中的 optimization 报告，以及 [style-system-round1](../docs/style-system-round1.md)；描述各自版本，不是当期运行说明 |
| 许可与溯源 | [LICENSE-THIRDPARTY](../LICENSE-THIRDPARTY)、[audio-engine/VENDOR](../audio-engine/VENDOR.md)、各风格 UPSTREAM/ATTRIBUTION；逐项读取实际采用的来源 |

风格选型仍按当前 [style-ledger.md](style-ledger.md)、catalog 和 SPEC，不把真实用户的持久选择仅因有历史日期而忽略。可复用方法已提炼到导演手册/专题；查历史不是另走一次开工门。

## 回写去向

验证过的新经验维持双轨：坑当天写 lessons 历史表（现象→根因→判据/修法）；做对的事写其“正面经验”（做法＋证据＋为什么＋何时用，跨栈借用需记复验）。同一事件可互链，但不把一条案例的偶然参数扩成全局规则。

- 风格或卡特有问题 → 对应 SPEC / gallery 卡。
- 跨风格导演方法 → directing-playbook。
- 可量化判据 → 对应探针/门禁及测试。
- 流程缺口 → 契约或流程的唯一相关位置；派单细节 → workflow-orchestration。
- 事实与文档不符 → 记录实测并修正相关文档，不用旧文本证明新事实。

运行产物留工程内；Skill 只收长期资产与已验证知识。完整历史与参考实现仍可按需取用，路径不因本次整理更名或删除。
