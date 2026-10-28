# Architecture Decision Records（ADR）

> **用途：** 记录**不可逆或易忘**的架构/产品决策，防止新 Agent 会话重议已拍板事项。  
> **格式：** 一页一决策；状态 `已接受` / `已废弃`（废弃须写替代 ADR）。  
> **冲突时：** ADR 解释「为什么」；行为契约仍以 [`Yiveno-产品文档-v4.0.md`](../../product/Yiveno-产品文档-v4.0.md) Normative 为准。

| ID                                                        | 标题                                                             | 状态     |
| --------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| [ADR-001](./ADR-001-side-panel-recall-shell.md)           | Recall 主壳 = Chrome Side Panel；Action Popup 退役               | 已接受   |
| [ADR-002](./ADR-002-clue-terminology.md)                  | 用户 Recall 输入称 clue（线索），非 query/search                 | 已接受   |
| [ADR-003](./ADR-003-neighborhood-not-oracle.md)           | 交付邻域集合；Top1=建议，非神谕唯一答案                          | 已接受   |
| [ADR-004](./ADR-004-llm-data-plane-boundary.md)           | LLM 不直接执行数据平面读写                                       | 已接受   |
| [ADR-005](./ADR-005-no-graylist-universal-recall.md)      | 禁止内容别名灰名单冒充全用户通解                                 | 已接受   |
| [ADR-006](./ADR-006-brand-assets-git-lfs.md)              | 品牌母本走 Git LFS（主仓内，非卫星仓）                           | 部分撤销 |
| [ADR-007](./ADR-007-omnibox-offline-lookup.md)            | Omnibox = 离线字段快跳；Side Panel = 完整 Recall                 | 已接受   |
| [ADR-008](./ADR-008-detail-export-naming.md)              | Detail export（详情导出）定位与命名                              | 已接受   |
| [ADR-009](./ADR-009-yiveno-probe-package.md)              | 召回探针 / 测试数据工作台独立为 `@yiveno/probe`                  | 已接受   |
| [ADR-010](./ADR-010-clue-understanding-pipeline.md)       | Clue 理解流水线（LLM NLU → 可执行约束）                          | 已接受   |
| [ADR-011](./ADR-011-recall-time-confidence.md)            | 相对时间置信度分层（hard 筛 vs soft 排）                         | 已接受   |
| [ADR-012](./ADR-012-find-things-dual-meaning.md)          | find things 双关为后手；终局壁垒=私有增量与习惯                  | 已接受   |
| [ADR-013](./ADR-013-ai-collaboration-scaffolding.md)      | AI 协作脚手架收敛（单一权威 + 跨 IDE 薄指针）                    | 已接受   |
| [ADR-014](./ADR-014-recall-request-topic-two-sources.md)  | Recall Request · Topic 两种来源（退化弱 Topic 模型化 · D1 裁决） | 已接受   |
| [ADR-015](./ADR-015-topic-semantic-representation-d3c.md) | Topic 语义表示（D3-C）                                           | 已接受   |
| [ADR-016](./ADR-016-environment-feedback-evolution.md)    | 双线程：明线用户价值 · 暗线记忆探索 · 反馈非真理                 | 已接受   |
| [ADR-017](./ADR-017-cloud-sync-excerpt-only.md)           | 云同步范围 = 摘录；书签 Memory 本机化（不跨设备并书签林）        | 已接受   |
| [ADR-018](./ADR-018-account-profile-data-isolation.md)    | Account vs Profile 隔离 · 门闸仅无主摘录 · 退出清账号桶          | 已接受   |
| [ADR-019](./ADR-019-website-extension-ui-bridge.md)       | 同浏览器官网 ↔ 扩展 UI 状态桥（Port；可见才刷）                  | 已接受   |
| [ADR-020](./ADR-020-chromium-dual-store-edge.md)          | Chromium 双店同包（Chrome + Edge）；大陆主路径 Edge              | 已接受   |

**新增 ADR：** 先写本文目录 + 文件，再在产品文档 / `CURRENT.md` 引用。

**相关原则（非 ADR）：** [`Yiveno-双线程发展原则.md`](../../product/Yiveno-双线程发展原则.md)（权威）· [`Yiveno-环境反馈驱动进化-原则.md`](../../product/Yiveno-环境反馈驱动进化-原则.md)（工程子集）。
