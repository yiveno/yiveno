---
created: 2026-10-06
updated: 2026-11-10T10:14:35+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: ADR-001（Side Panel 主壳）, ADR-003（邻域非神谕）, ADR-005（禁止灰名单）, ADR-010（理解流水线）, ADR-011（时间置信度）, ADR-014（Topic 两种来源 · D1-B 退化弱 Topic）
downstream: docs/product/Yiveno-产品文档-v4.0.md §7.05, docs/product/Recall-Request-模型与Discovery边界.md §6 D3-C, docs/audits/Recall-主线与文档对齐-2026-10.md, extension/src/core/recall/topic-embedding.ts, extension/src/core/recall/topic-embedding.test.ts, extension/src/core/recall/recall-topic.ts, extension/src/core/recall/topic-lookup.ts, extension/src/core/recall/topic-lookup.test.ts, extension/src/core/recall/parse-recall-clue-types.ts, extension/src/core/recall/orchestrate-keyword-recall.ts, extension/src/application/recall/backends/hybrid-recall-backend.ts, recall-eval must, ADR-022（dreaming 派生表）
---

# ADR-015: Topic 终态 = 语义表示（D3-C 裁决 + Gap 4/5 落地）

- **状态：** 已接受
- **日期：** 2026-10-06
- **决策者：** 维护者（2026-10-06 D3-C 裁决：Topic 终态 = 语义表示（embedding / entity）；直接语义化）
- **前置：** ADR-001 / ADR-003 / ADR-005 / ADR-010 / ADR-011 / ADR-014 · 产品文档 §7.05 · 草案 §6 D3-C

## 背景

ADR-014 落地后，Topic 已是 Recall 的**必要条件判定器**，并允许两种来源（强 Topic · 词面主题 / 弱 Topic · 约束邻域代理）。但 §0「Topic 是 Recall 必填」与「Topic 是**先验空间缩减器**」之间存在**实现落差**：

1. **架构缺口**：草案 §2 主张的 `Topic → Memory Neighborhood → Candidate Items → Re-ranking` 中，Topic 实际只出现在 Gate 层（`hasRecallTopicAnchor`）和 `contentTerms` 的并入处（`buildFilterClueFromParsed`）。**没有**作为独立语义角色贯穿到最终结果，也没有参与候选加载的先验缩减。
2. **语义角色丢失**：Topic 被当作普通内容词并入 `filterClue`，丢失了"Topic = 根节点 / 空间缩减器"的角色——这是 ADR-014「Topic 是边界判定器」与草案 §1「Topic 是根节点」的**实现层塌方**。
3. **表示层不达终态**：当前 `RecallTopic.terms: string[]` 是**词法**表示，草案 §3 与 §6 D3-C 明确 Topic 终态 = **语义表示**（embedding / entity）。词法 Topic 只能做"词面命中"——无法支撑"近义不同词" / "概念聚合"的邻域召回。

草案 §5「代码层已知的自认局限」明确写明：Topic 当前是**词法**的，不是**语义**的。

实际影响：

- **Gap 4**（中 · 工作量大 · 依赖 D3）：Topic 作为 `contentTerms` 并入，语义角色丢失——`buildFilterClueFromParsed` 把 Topic 降级为普通内容词。
- **Gap 5**（中-低 · 工作量大 · 依赖 D3）：D3 Topic 语义化缺失——`RecallTopic.terms` 是词法，终态是语义表示。
- 两者共同阻塞 §7.05「Topic 必填不只是过门」产品形态落地。

需要把 Topic 从"词法过门 + 词面并入"升级为"独立语义角色 + 真实语义化"，且**直接落地终态**（不走"词法逐步升级"的中间形态）——这正是 D3-C 的裁决精神。

## 决定

### 1. D3-C 裁决：Topic 终态 = 语义表示（embedding / entity）；直接语义化

- **Topic 表示的演进方向** = 词法（当前）→ 语义（终态）。**不**采用"词法逐步升级"的演进路径。
- **终态形态** = embedding 向量（短期）+ entity index（中期）。两者并存，互不替代。
- **落地策略** = 直接语义化：一步到位接入 embedding 产出 Topic 嵌入；保留词法作为**降级 fallback**（不删、仅 fallback）。
- **登录门**：embedding 通道仅登录态注入 embed 句柄（Cloudflare hosted 已存在）；未登录态 / embedding 不可用 / 报错 → 透明降级词法路径。
- **不**借机引入内容别名 / 开放同义表（ADR-005 不放宽）；embedding 文本 = Topic tokens 原样拼接（空格分隔），不加别名 / 不去停用词之外的处理。

### 2. Gap 4 落地：Topic 语义角色重建（架构层）

**核心改动：** Topic 走**独立检索路径**（`topicLookup`），与 `contentTerms` 关键词检索（`buildFilterClueFromParsed`）**分轨**；两路结果**并集 + 去重**。

| 路径               | 入口                                                    | 角色                  | 产物       |
| ------------------ | ------------------------------------------------------- | --------------------- | ---------- |
| **关键词路径**     | `buildFilterClueFromParsed`（已有）                     | contentTerms 字面匹配 | 邻域候选 A |
| **Topic 独立路径** | `topicLookup(pool, descriptor, topicEmbedding)`（新增） | Topic 语义/词法近邻   | 邻域候选 B |

- `TopicDescriptor` 含 `displayName` / `tokens` / `embedding?` 三个字段（RecallResult 透传）。
- `topicLookup` 行为：
- `topicEmbedding !== undefined` → 调用 `cosineSimilarity` 算近邻（**真实语义路径**）。
- embedding 全跳（`undefined`） → 降级词法路径（保留**占位实现**，**不删除**）。
- `parsed.topic.embedding` 由 `withRecallTopicAsync` 异步幂等回填（仅登录态）。
- `orchestrate-keyword-recall.ts` 透传 `topic.embedding` 到 `topicLookup`；`hybrid-recall-backend.ts` 用 `withRecallTopicAsync` 替换 `withRecallTopic`。

**Topic 现在的角色 = 独立语义角色**，不再是 `contentTerms` 的子集。

### 3. Gap 5 落地：D3 Topic 语义化（表示层）

**核心改动：** RecallTopic 加 `embedding?: Float32Array` 字段；`deriveTopicEmbedding` 产出真实 embedding。

- **新增**：`core/recall/topic-embedding.ts`
- `deriveTopicEmbedding(topic, embedClueText)`：异步；多 token 取平均；`embedClueText` null / 报错 / 返回空 → 透明降级词法 + `fallbackReason` 标记（`no_tokens` / `embed_fn_null` / `embedding_failed` / `embedding_empty`）。
- `deriveTopicEmbeddingSync(...)`：同步版（未来扩展，本轮保留接口不调）。
- `DeriveTopicEmbeddingResult` / `TopicEmbeddingFallbackReason` 类型导出。
- **修改 Schema**：`RecallTopicSchema` / `TopicDescriptorSchema` 各加 `embedding?: Float32Array`。
- **修改 `recall-topic.ts`**：
- 新增 `withRecallTopicAsync(parsed, embedClueText)`：异步幂等回填（含 embedding 产出）。
- 新增 `buildTopicDescriptorFromRecallTopic(topic, embedding?)`：构造 TopicDescriptor 供 `topicLookup`。
- **修改 `topic-lookup.ts`**：从纯词法占位改写为「embedding 真实路径 + 词法降级」双路径。
- **修改 `hybrid-recall-backend.ts`**：
- `withRecallTopicAsync` 替换 `withRecallTopic`（仅登录态注入 embed 句柄）。
- 全文件 `merge.merged` → `merged`（与 `merge.input` 对齐的字段名统一）。

### 4. 降级语义（不变条款）

- **embedding 不可用 = 透明降级词法**（不报错、不告警用户、不影响 Recall 体验）。
- 降级触发需 `FlowLog.trace` 记录（`fallbackReason`），便于排查但不进用户面。
- 词法路径与原 Topic 词面逻辑**完全等价**（行为不退步）。
- `merge.merged` 字段名规范贯穿 Hybrid 管线（避免「外部 merge 字段」与「内部累积字段」混淆）。

### 5. 不做的事（边界声明）

- **不**借机引入内容别名 / 开放同义表（ADR-005 铁律）。
- **不**扩 `TopicDescriptor` 字段（仅 `displayName` / `tokens` / `embedding?`）。
- **不**强制登录才用 Recall——未登录态照常工作（仅 embedding 路径走不到，词法 fallback）。
- **不**改 `buildFilterClueFromParsed` 的关键词路径——两路并存，**不**互替。
- **不**在 UI 层暴露 `embedding` 字段（`RecallResult.topic.embedding` 透传但 UI 不消费——留作未来"Topic 用 semantic"标识或类似 UI 形态）。
- **不**改 Hybrid 后端 `fuseHybridMatches` 自身——仅改 Recall 编排层入口（`withRecallTopicAsync` 替换）。
- **不**新增 entity index——本轮仅 embedding 真实路径 + 词法 fallback；entity 是中期目标。
- **不**改 `memory_items` 行形状以持久化 Topic embedding（Topic 向量仍在内存层；条目 Capture 向量走既有 `clues.embedding` 写回）。**允许**独立派生 store（见 [ADR-022](./ADR-022-dreaming-derived-stores.md)：`memory_notes` / meta；命题向量不写进源条目）。

## 拒绝的替代方案

- **D3-A（维持词法）**——拒绝：与草案 §3「Topic 是语义层」终态冲突；Gap 4/5 不能闭合；未来接入 entity 还要回炉。
- **D3-B（词法逐步升级）**——拒绝：「逐步」= 多次小型重构，**总工作量更大** + 多次影响产品文档 §7.05 表述；「直接语义化」= 一次到位，**降级路径保底**，总工作量更小且更稳。
- **Topic 永久用词法 + 拒绝 entity 方向**——拒绝：草案 §3 明确「语义表示」是终态，词法 Topic 永远只是中间占位；硬钉死词法 = 钉死 Gap 4/5 不能修复。

## 后果

### 当前（2026-10-06）已落地

- ✅ Gap 4 · Topic 独立检索路径 `topicLookup` 接入；embedding 参数预留
- ✅ Gap 5 · `deriveTopicEmbedding` + `withRecallTopicAsync` + `topicLookup` embedding 真实路径 + 词法 fallback
- ✅ `RecallTopic.embedding` / `TopicDescriptor.embedding` 字段已加（z.instanceof(Float32Array).optional()）
- ✅ `topic-embedding.test.ts` 新增 31 测试覆盖异步 / 同步 / 降级场景
- ✅ `topic-lookup.test.ts` 新增 6 embedding 路径测试（修复 3 旧断言）
- ✅ `hybrid-recall-backend.ts` 全文件 `merge.merged` → `merged` 字段名规范
- ✅ 产品文档 §7.05 Gap 5 段（完整 15 条）已同步
- ✅ 草案 §6 D3-C「现状」+「演进路径」+ §7 P1 + §3 gap 5 + P1 序列 全部同步为"已修复"
- ✅ `bun run typecheck:force` · `cd extension && bun run test:run`（207 files / 1060 tests）· `bun run doc:check` · `bun run i18n:check` 全过
- ✅ MCP 真机抽测（Side Panel）：Step 1 duckdb no_match + Heard as 槽位；Step 2 caching from last week 命中 2 items + 时间过滤 + 邻域交付 UI；未登录态降级词法路径生效；SW 无活跃错误

### 同步义务

| 改动面                                                     | 必须同步                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| D3-C 裁决理由                                              | 本 ADR + 草案 §6 D3-C 段 + 产品文档 §7.05 Gap 5 段                   |
| `topicLookup` 行为（embedding 路径 vs 词法 fallback）      | 本 ADR + `topic-lookup.ts` 注释 + `topic-lookup.test.ts`             |
| `withRecallTopicAsync` 替换 `withRecallTopic`              | 本 ADR + `hybrid-recall-backend.ts` 注释 + recall-eval must          |
| `RecallTopic.embedding` / `TopicDescriptor.embedding` 字段 | 本 ADR + `parse-recall-clue-types.ts` schema 注释 + recall-eval must |
| `merge.merged` → `merged` 字段名规范                       | 本 ADR + `hybrid-recall-backend.ts` 全文件 + recall-eval must        |
| Gap 5 落地段（产品面）                                     | 本 ADR + 产品文档 §7.05（Normative）                                 |
| 草案 §6 D3-C「现状」+「演进路径」+ §7 P1                   | 本 ADR + 草案（Normative 正文）                                      |

### 已知盲点 / 留给未来

- ⚠️ **UI 不消费 `RecallResult.topic.embedding`**：本轮 RecallResult 已透传，UI 层未消费（不做本轮 Out 范围）。未来 UI 可用此字段展示「Topic 用 semantic」或类似信息。
- ⚠️ **entity index 未接入**：中期目标（草案 §3 + §6 D3-C 演进路径），本轮仅 embedding 真实路径 + 词法 fallback。
- ⚠️ **Topic embedding 未持久化到 IndexedDB**：本轮 Topic 向量在内存层，Recall 退出即丢。**禁止**为此改 `memory_items` 行形状；条目 Capture 向量仍走既有 `clues.embedding`；dreaming 命题派生见 [ADR-022](./ADR-022-dreaming-derived-stores.md)。
- ⚠️ **`deriveTopicEmbeddingSync` 接口保留未调**：未来扩展点（如每 token 单独 embedding 再平均），本轮直接用单次 embedding 拼接文本。

## 引用

- [`docs/product/Recall-Request-模型与Discovery边界.md` §6 D3-C](../../product/Recall-Request-模型与Discovery边界.md)（Normative 正文）
- [`docs/product/Yiveno-产品文档-v4.0.md` §7.05 Gap 5 段](../../product/Yiveno-产品文档-v4.0.md)
- [`docs/audits/Recall-主线与文档对齐-2026-10.md`](../../audits/Recall-主线与文档对齐-2026-10.md)（对齐轮审计）
- ADR-001 / ADR-003 / ADR-005 / ADR-010 / ADR-011 / ADR-014
- 代码：`core/recall/topic-embedding.ts` · `core/recall/topic-embedding.test.ts` · `core/recall/recall-topic.ts` · `core/recall/topic-lookup.ts` · `core/recall/topic-lookup.test.ts` · `core/recall/parse-recall-clue-types.ts` · `core/recall/orchestrate-keyword-recall.ts` · `application/recall/backends/hybrid-recall-backend.ts`
