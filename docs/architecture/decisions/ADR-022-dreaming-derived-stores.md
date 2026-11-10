---
created: 2026-11-10T10:14:35+08:00
updated: 2026-11-10T10:14:35+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: ADR-015（Topic 语义表示）, ADR-016（双线程）, ADR-017（云同步仅摘录）, ADR-021（在线默认薄离线）, 产品文档 §5.5.1 / §5.8 / §7.05
downstream: docs/product/Yiveno-产品文档-v4.0.md §5.5.1 / §7.05, extension/src/infrastructure/indexeddb/memory-notes-*.ts, extension/src/core/dreaming/*
---

# ADR-022: Dreaming 派生表（独立 IndexedDB store · 不改用户原文）

- **状态：** 已接受
- **日期：** 2026-11-10
- **决策者：** 维护者（2026-11-10：D-1=A 独立派生 store；D-3=A v1 本地-only；预嵌/命题不写进 `memory_items` 行形状）
- **前置：** ADR-015 · ADR-016 · ADR-017 · ADR-021 · 产品文档 §5.5.1 / §5.8 / §7.05

## 背景

离线 dreaming 最小三件套需要：

1. 夜间把当日新增/变更摘录编译成**原子命题**（带原文引用）；
2. Capture 侧去重键 / duplicate-group 链接；
3. 每周死链巡检状态。

这些都是**派生数据**，不得改用户原文（`payload` / `clues.textExcerpt` / `clues.note`）。ADR-015「不做的事」曾写「不改 IndexedDB schema（embedding 字段在内存层，不持久化到 MemoryItem）」——该句针对的是 **Topic embedding / 禁止为持久化去改 `memory_items` 行形状**，不是禁止一切新 store。若把命题 / 死链状态塞进 `clues.*`，会污染云同步载荷、`updatedAt` 排序与 Outcome 语义。

## 决定

### 1. 独立派生 store（D-1 = A）

| 项             | 决定                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| **命题表**     | `memory_notes`（`keyPath: id`）+ 索引 `by_owner_source` / `by_owner_updated`          |
| **run 元数据** | `memory_notes_meta`（`keyPath: ownerId`；游标 / dirty / schemaVersion）               |
| **DB 版本**    | `MEMORY_DATABASE_VERSION = 5`；迁移**只建 store/索引**，不做回填 / 全库扫描           |
| **禁止**       | 为 dreaming 改 `memory_items` 行形状；命题文本写入 `clues.*`；dreaming 写回改用户原文 |

### 2. 预嵌向量存哪

| 面                   | 决定                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Capture 条目向量** | 继续走既有 `scheduleAsyncMemoryEmbedding` → `clues.embedding`（已存在；非本 ADR 新开字段）                                                                     |
| **命题向量**         | 若需要，写在 `memory_notes` 行的 `embedding` / `embeddingModel` / `embeddingDim`（字段名对齐 clues 三件套；模型锁定 `@cf/baai/bge-m3`；**不得写死维度 1024**） |
| **禁止**             | 为「Topic 预嵌持久化」新增 `memory_items` schema；把命题向量抄进源条目 `clues.embedding`                                                                       |

### 3. 登录门与 §5.8

- **Embed 仅登录时**不变：条目预嵌 / 命题向量化均遵守既有门禁（AI 关 / 未登录 / quotaPaused → skip）。
- 未登录态允许本机规则 enrichment 与命题表结构存在，但**不得**为 dreaming 放宽 Embed 登录门。

### 4. Backup / Portable / 同步（D-3 = A · L3）

| 面                                | 决定                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| **归属**                          | `memory_notes` = **L3 条目级派生**，随条目走                                           |
| **Backup**                        | **必须含**（与 enrichment / 条目 embedding 同档）                                      |
| **Portable**                      | **默认不含**（可重算）                                                                 |
| **云同步**                        | **v1 本地-only，不进** `/api/memory/sync/*`；换机后本地重算。若要同步须另开 ADR        |
| **CLEAR_LOCAL_MEMORY**            | **连带清除**该 owner 的 `memory_notes` + `memory_notes_meta`（经 `replaceOwnerItems`） |
| **CLEAR_LOCAL_RECALL_ADAPTATION** | **不**清命题表（只清 Outcome / TTE）                                                   |

### 5. 与 ADR-015 的关系

- ADR-015「不改 IndexedDB schema」收窄为：**不改 `memory_items` 行形状以持久化 Topic embedding**；**允许**独立派生 store（本 ADR）。
- Topic 门 / `TopicDescriptor` / `hasRecallTopicAnchor` **不动**；命题 `topicAnchor` 仅检索信号，不参与 Topic 门判定。

### 6. 不做的事

- 不用知识图谱；不用查询时大模型做离线批处理而不经独立 `dreaming` taskKind。
- 全量重嵌 / 全量重算；命题冒充原文作 ECS 锚；命题进 Omnibox 候选（默认）。
- 死链巡检写 `clues` / 改 `deletedAt` / 做成管理页。

## 后果

- 扩展 IndexedDB v5 起多两张表；旧库打开自动升级，既有 `memory_items` 行原样保留。
- 夜间编译 / 优先读 / 死链降权分 Phase 落地；本 ADR 只钉**存储与归属边界**。
- 闹钟为「浏览器开着时从创建起每 1440 分钟」；**无**固定墙钟；关浏览器不跑（ADR-021 薄本机维护，非第二套离线产品）。
