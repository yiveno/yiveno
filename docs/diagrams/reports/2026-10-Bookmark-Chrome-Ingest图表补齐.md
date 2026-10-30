---
created: 2026-10-31T01:09:58+08:00
updated: 2026-10-31T01:10:06+08:00
author: agent:cursor
scope: Mermaid 第十阶段 · 补登记图 runtime.bookmark-chrome-ingest（只改运行时宿主 / registry / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-Omnibox-Bookmark双链路盘点.md
  - docs/diagrams/reports/2026-10-Omnibox-Offline-Recall图表补齐.md
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/architecture/decisions/ADR-017-cloud-sync-excerpt-only.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/background/listeners/chrome-bookmark-sync.ts
  - extension/src/application/capture/chrome-bookmark-sync-service.ts
  - extension/src/application/capture/import-chrome-bookmarks-service.ts
  - extension/src/infrastructure/browser/chrome-bookmark-reader.ts
  - extension/src/infrastructure/indexeddb/memory-item-repository.ts
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（新增 runtime.bookmark-chrome-ingest）
---

# Bookmark Chrome → IDB Ingest 图表补齐（2026-10-31）

> **本轮约束：** 按双链路盘点 **P1-2** 补 `runtime.bookmark-chrome-ingest`；**不**改业务代码 / ADR / 同步脚本；**不**顺手 Billing / GS 全图；**不**改其它已登记 Mermaid。  
> **口径：** Bookmark ≠ Capture；不上云 ≠ 不入本机库；Chrome 读 / IDB 写 / 倒排 分步表达。

---

## 0. 一句话结论

**值得独立成图，并已落地。** 宿主 §3.1.1 登记 `sequenceDiagram`：门禁 → 全量 Import（bulk/续传 upsert + finalize）与增量 `on*`（pending / upsert / 软删）分轨；钉 Chrome 树权威、仅 http(s) 叶子、`chromeBookmarkId` 幂等、本机可召回、不上云。与 `runtime.capture-excerpt-sequence` **分图**。

---

## 1. 实际调用链（源码证据）

### 1.1 权限与入口

| 项            | 证据                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 权限          | `extension/public/manifest.json` → `"bookmarks"`                                                                                                        |
| 读            | `chrome-bookmark-reader.ts`：`get` / `getTree` → `toChromeBookmarkLeaf` / `flattenChromeBookmarkTree`                                                   |
| 增量 listener | `listeners/chrome-bookmark-sync.ts`：`onCreated/Changed/Removed/Moved`；启动可挂、关灌库卸下                                                            |
| 门禁          | `settings.chromeBookmarkIngestEnabled`（默认关）；`isChromeBookmarkIngestEnabled` / `isChromeBookmarkIncrementalSyncEnabled`（还须 import `completed`） |
| 全量          | GS / Settings → `ensureChromeBookmarksImported`（`import-chrome-bookmarks-service.ts`）                                                                 |

### 1.2 全量 vs 增量

| 路径                       | 行为                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **全量首次**               | `readChromeBookmarkLeaves` → `bulkPutChromeBookmarkLeaves`（`putMany` 分批）→ 状态 `completed` → `finalizeChromeBookmarkSyncAfterImport` |
| **全量续传**               | `upsertChromeBookmarkLeaves`（逐条 `upsertBookmarkFromChrome`，防 bulk 中断重复）                                                        |
| **已 completed 再 ensure** | 仍 `finalize`（flush + repair/reconcile），不重跑 bulk                                                                                   |
| **增量**                   | ingest 开 + import completed → `syncChromeBookmarkNode` / `softDeleteByChromeBookmarkId`；未完成 → session pending                       |
| **finalize**               | 清 LLM/embed 队列 → `flushPending` → full repair（本 SW 会话至多一次）或 holes reconcile → 无感 embedding 维护                           |
| **每日 alarm**             | 灌库开时挂 `chrome-bookmark-repair-alarm`（24h）；关则清                                                                                 |

### 1.3 清洗 / 字段 / 去重

| 规则                | 证据                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| 仅可存 http(s) 叶子 | `toChromeBookmarkLeaf`：`url` + `isSavablePageUrl`；否则 null → 软删同 id    |
| 标题                | `title.trim() \|\| url`                                                      |
| 层级                | `parentFolderId` 入 payload；**文件夹本身不进 Memory 叶子**；库树另读 Chrome |
| 键                  | `chromeBookmarkId`；upsert 同 id 更新标题/URL、清 `deletedAt`（复活）        |
| 保留                | `clues.note`、open/settled/dismiss 计数与时间戳                              |
| 第三方书签          | 无 `chromeBookmarkId` → full repair **不动**                                 |
| captureEntry        | 灌库路径 `'sync'`                                                            |

### 1.4 IDB 与失败

| 项     | 证据                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| 写入口 | `memoryItemService.upsertBookmarkFromChrome` / `softDeleteByChromeBookmarkId` → repository `put` / `putMany`  |
| 事务   | `indexedDBManager.withTransaction`；`put` 后 token diff 更新倒排，失败 `markDirty`                            |
| 配额   | `isIndexedDbQuotaExceededError` → 本会话 `markIndexedDbWriteQuotaExhausted`，后续 flush/reconcile/repair 跳过 |

### 1.5 进入 Recall

1. Memory 行 `type=bookmark` 已在 IDB。
2. `put`/`putMany` 同步倒排（大批量 markDirty → 后续 ensureReady 重建）。
3. Recall `listForKeywordRecall` 可读本机书签（与摘录共享 Filter/Hybrid 基础设施）。
4. **仅增量** `scheduleAsyncMemoryEmbedding`；bulk/reconcile **不**刷万级 Worker。
5. **不上云**（ADR-017）；本机检索与云面解耦。

### 1.6 与划词 Capture

|            | Capture Text Excerpt                            | Bookmark Ingest                      |
| ---------- | ----------------------------------------------- | ------------------------------------ |
| 入口       | messaging / 右键直调                            | Chrome `bookmarks.on*` / bulk ensure |
| 类型       | `text_excerpt`                                  | `bookmark`                           |
| 图         | `runtime.capture-excerpt-sequence`              | **本图**                             |
| enrichment | 可 LLM + embed                                  | bulk 不烧 LLM；增量可 embed          |
| 云         | Pro 可同步摘录                                  | **不上云**                           |
| 共享       | `memory-item-repository` / 倒排 / Recall 读路径 | 同左                                 |

---

## 2. 图表决策

| 问题           | 结论                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| 是否独立成图？ | **是** — 与划词 Capture 分轨；门禁/全量/增量/对账复杂度够；漂移易混 Capture 或云 sync |
| kind           | `sequence`（谁何时如何）                                                              |
| id             | `runtime.bookmark-chrome-ingest`                                                      |
| 宿主           | 运行时 §3.1.1（紧邻 Capture，显式「≠ 划词」）                                         |
| status         | `implemented`                                                                         |

**不画：** GS 进度 UI、文件夹只读树、embed 队列内部、`CAPTURE_BOOKMARK`、云书签并集。

---

## 3. 变更清单

| 路径                                                              | 动作                             |
| ----------------------------------------------------------------- | -------------------------------- |
| `docs/architecture/Yiveno-运行时架构流程-v1.md`                   | 文首索引 + §3.1.1 锚点与 Mermaid |
| `docs/diagrams/registry.json`                                     | 新增本 id                        |
| `docs/diagrams/reports/2026-10-Bookmark-Chrome-Ingest图表补齐.md` | 本报告                           |

**未改：** 业务代码、测试、ADR、其它 Mermaid、同步脚本。

---

## 4. 验证（实测）

```text
$ bun run docs:check-diagrams
✅ diagrams 校验通过（15 张）· docs/diagrams/registry.json
```

（本机 2026-10-31 跑通；非预期臆测。）

---

## 5. 未解决问题 / 证据缺口

| 项                                          | 状态                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `CAPTURE_BOOKMARK` 是否仍有用户面入口       | 产品称非日常主入口；**未**全仓枚举 UI 调用面（本图刻意排除） |
| bulk `putMany` 与续传 upsert 字段完全对称性 | 均经 `createBookmarkMemoryItem` / upsert；未逐字段 diff 测   |
| MCP 预览渲染                                | 未跑（结构门禁已绿）                                         |
| Billing / GS 全图                           | 仍 P2；本轮不做                                              |

### 停止线

本阶段仅 Bookmark Ingest 补图。**停止**，等待下一阶段指示。
