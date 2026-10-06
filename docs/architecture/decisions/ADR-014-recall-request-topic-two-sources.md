---
created: 2026-10-06
updated: 2026-10-06
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: ADR-001（Side Panel 主壳）, ADR-003（邻域非神谕）, ADR-005（禁止灰名单）, ADR-010（理解流水线）, ADR-011（时间置信度）
downstream: docs/product/Yiveno-产品文档-v4.0.md §7.05, docs/product/Recall-Request-模型与Discovery边界-草案.md（Normative 正文）, frontend/src/core/recall/recall-topic.ts, frontend/src/core/recall/parse-recall-clue-types.ts, frontend/src/core/recall/orchestrate-keyword-recall.ts, frontend/src/core/recall/enrich-empty-recall-result.ts, frontend/src/application/recall/backends/hybrid-recall-backend.ts, frontend/src/core/recall/eval/recall-eval-cases.ts
---

# ADR-014: Recall Request · Topic 两种来源（退化弱 Topic 模型化 · D1 裁决）

- **状态：** 已接受
- **日期：** 2026-10-06
- **决策者：** 维护者（2026-10-06 D1 裁决：在 D1-B 退化弱 Topic 与 D1-C 拒收之间选择 D1-B）
- **前置：** ADR-001 / ADR-003 / ADR-005 / ADR-010 / ADR-011 · 产品文档 §7.05 · 草案 §0–§6

## 背景

自然语言不像传统输入可以做 `正则 → Schema → Validation`：用户可用任意句式表达任意意图。

在 H-topic「主题必填」落地后暴露更底层问题——**Recall 输入是无限自然语言域，而 Filter 内核面对的是有限 Memory 域**。如果不给 Recall 划一条问题边界：

1. `understand → filter → rank` 每次「再多理解一点」都只是把边界往后推，问题定义始终不收敛。
2. 无主题锚时继续检索，要么返回「最像的几个」（神谕化，违反 ADR-003），要么返回硬空（用户以为没存过，体验塌方）。

实际用户场景里，有一类**合规但无内容词**的请求：用户忘了标题，但记得**「我刚存的 / 昨天那个视频 / 上周收藏的文章」**——只有时间 / 刚存 / 类型约束，**没有任何具体内容词**。若按"无主题 = 退出 Recall"一刀切，这部分日常高频请求会被错杀；若放任按约束扫库，又会违反 H-topic 必填的边界声明。

需要给 Recall Request 模型补一个**有约束的退化形态**。

## 决定

### 1. Topic 是 Recall 的**必要条件**（边界判定器），不是产品功能

- **主语** = Recall 的**问题边界**（什么算 Recall / 什么不算 Recall），不是新增一个产品功能。
- Topic = **必要条件判定器**：当且仅当用户请求能落成一个**可识别的 Topic representation**，该请求才进入 Recall 问题域。
- 产品核心仍是 **Recall 找东西** 本身；Topic 解决的是"什么算 Recall、什么问题不算"的前置判定。

### 2. Topic 两种来源（D1-B · 退化弱 Topic）

Recall Request 的 Topic 允许两种来源，二者**择一成立**即可让请求进入 Recall 域：

| 路径                             | 触发条件                                                                                       | Topic strength | 落地                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| **Topic-driven（强）**           | 解析结果含 ≥1 个非泛词内容词（`source=content`）或附注指向（`source=goal`）                    | strong         | `deriveRecallTopic` 派生；`hasRecallTopicAnchor=true`                                     |
| **Preference-driven 退化（弱）** | 无内容词，但存在强约束（`objectTypes` + `timeRange` high 置信 / `recently_saved` 行为 / 类型） | weak           | `shouldRecallByConstraintNeighborhood` 判定；Hybrid 编排层走 `finalizeKeywordResult` 分支 |

**关键：** 退化弱 Topic **不是** "无主题也能进"，而是 **"由约束邻域代理一个弱 Topic"**——区别于无任何锚点的零条目场景。

### 3. 边界判定（什么不属于 Recall）

```text
请求 X 是否有可识别 Topic？
├── 否（完全无 C/G，也无强约束）→ 不属于 Recall → emptyKind='missing_topic'，UI 仅一问缺主题
│                                  （产品面简化文案：'Tell me what topic it is about, and I will look.'）
├── 是（强 Topic：内容词 / 附注指向）→ Recall 域，filterKeyword 路径
└── 是（弱 Topic：仅强约束）        → Recall 域，Hybrid 编排 → finalizeKeywordResult 约束邻域路径
```

**禁止** 无主题反复追问死循环；`missing_topic` 只问一次，后续补一句即放行（多轮 `merge.merged` 自然承接）。

### 4. 落地位置（管线分轨）

- **Topic 表示层**：`core/recall/recall-topic.ts`（`deriveRecallTopic` / `hasRecallTopicAnchor`）
- **判定层**：`core/recall/orchestrate-keyword-recall.ts`（`shouldRecallByConstraintNeighborhood`，D1-B 路径入口）
- **编排层**：`application/recall/backends/hybrid-recall-backend.ts`（约束邻域分支 → `finalizeKeywordResult`）
- **空结果细分**：`core/recall/enrich-empty-recall-result.ts`（`emptyKind: 'missing_topic' | 'constrained_none' | 'unconstrained'`）
- **Schema**：`core/recall/parse-recall-clue-types.ts`（`RecallTopicSchema` 含 `source` / `strength` 字段）

### 5. 不可降级条款

- 退化弱 Topic **不**放宽 ADR-005（禁止内容别名灰名单）——约束邻域仍以 `objectTypes` / `timeRange` 闭集字段为入口，**不**借机引入"先存 → 召回"等扩词机制。
- 退化弱 Topic **不**放宽 ADR-011（时间置信度分层）——`timeRange` 仍须 high 置信才参与硬筛；low 置信仅软排加分。
- `missing_topic` **不**挂 `relatedGuess`（`enrich-empty-recall-result` 强制 `relatedGuess: null`），避免「无主题瞎猜」破坏边界声明。
- **不**新增 "Discovery 出口"（详见草案 §4）——保持现状"暂不处理"，避免在没有产品形态前给用户画饼。

## 拒绝的替代方案

- **D1-A（严格 Topic）**——拒绝：无内容词的强约束请求是高频刚需（"我刚存的 / 昨天那个视频"），一刀切会显著拉高放弃率（与 §5.9 TTE 方向冲突）。
- **D1-C（不建模）**——拒绝：会导致 `understand → filter → rank` 的问题定义始终不收敛，未来扩展「笔记创作 / 浏览器助手」等场景时回退到原点；且产品文档 §7.05 已落地 Topic 命名，缺模型会形成"有名字没定义"的认知裂缝。

## 后果

### 当前（2026-10-06）已落地

- ✅ Topic 门（`hasRecallTopicAnchor`）；`emptyKind: 'missing_topic'`
- ✅ `deriveRecallTopic` 从内容词 / 附注指向派生；UI 不问 Topic 字段
- ✅ Preferences（`objectTypes` / `timeRange`）已分层（ADR-010/011）
- ✅ 约束邻域路径已接线（Hybrid 编排层）

### 已知差距（对应 P1–P3）

- ❌ **P1**：Topic 作为先验空间缩减器**未出现在管线中**（仅在 `filterKeyword` 词面、并入而非先验筛库）
- ⚠️ **P2**：Clues 扁平（无人物/地点/情境结构化槽）
- ⚠️ **P3**：无 Discovery 概念出口（无主题 = Discovery，暂不接）

### 同步义务

| 改动面                                          | 必须同步                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Topic 路径（添加/拒绝某类来源）                 | 本 ADR + 草案 §6 D1 + 产品文档 §7.05 + `recall-topic.ts` + `parse-recall-clue-types.ts` |
| `shouldRecallByConstraintNeighborhood` 触发条件 | 本 ADR + `orchestrate-keyword-recall.ts` 注释 + Hybrid 后端注释                         |
| `emptyKind` 取值集合                            | 本 ADR + `enrich-empty-recall-result.ts` + 产品文档 §7.0                                |
| `recall-eval` must 增补/校准                    | 本 ADR + `recall-eval-cases.ts` + §5 手动步骤                                           |

## 参考

- [`docs/product/Recall-Request-模型与Discovery边界-草案.md`](../../product/Recall-Request-模型与Discovery边界-草案.md)（Normative 正文）
- [`docs/product/Yiveno-产品文档-v4.0.md` §7.05](../../product/Yiveno-产品文档-v4.0.md)
- [`docs/archive/research/tte-beta-2026-09/`](../../archive/research/tte-beta-2026-09/README.md)（已归档的种子研究，含 Topic 触发失败 case）
