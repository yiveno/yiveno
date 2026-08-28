# Architecture Decision Records（ADR）

> **用途：** 记录**不可逆或易忘**的架构/产品决策，防止新 Agent 会话重议已拍板事项。  
> **格式：** 一页一决策；状态 `已接受` / `已废弃`（废弃须写替代 ADR）。  
> **冲突时：** ADR 解释「为什么」；行为契约仍以 [`Yiveno-产品文档-v4.0.md`](../../product/Yiveno-产品文档-v4.0.md) Normative 为准。

| ID                                                   | 标题                                               | 状态   |
| ---------------------------------------------------- | -------------------------------------------------- | ------ |
| [ADR-001](./ADR-001-side-panel-recall-shell.md)      | Recall 主壳 = Chrome Side Panel；Action Popup 退役 | 已接受 |
| [ADR-002](./ADR-002-clue-terminology.md)             | 用户 Recall 输入称 clue（线索），非 query/search   | 已接受 |
| [ADR-003](./ADR-003-neighborhood-not-oracle.md)      | 交付邻域集合；Top1=建议，非神谕唯一答案            | 已接受 |
| [ADR-004](./ADR-004-llm-data-plane-boundary.md)      | LLM 不直接执行数据平面读写                         | 已接受 |
| [ADR-005](./ADR-005-no-graylist-universal-recall.md) | 禁止内容别名灰名单冒充全用户通解                   | 已接受 |

**新增 ADR：** 先写本文目录 + 文件，再在产品文档 / `CURRENT.md` 引用。
