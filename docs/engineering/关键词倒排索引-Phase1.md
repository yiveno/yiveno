# 关键词倒排索引（Phase 1）

> 工程备注。产品 Normative 见产品文档 §0.4 / §8 R3。  
> 冲突时先改产品文档。

## 目标

在 **不改变** `keyword-filter` 打分语义的前提下，用倒排 **预过滤候选**，避免每次 Recall 全表加载 ≤10k 条再逐条扫。

```text
口语 → 理解 / 门禁
  → 查询 token（复用 tokenizeRecallClueDetailed）
  → 倒排 union(postings) → 批量 getById
  → 现有 Filter / Hybrid / 追问
```

索引 **不健康 / 未建** → **fallback** `list(RECALL_SCAN_LIMIT)`，行为与旧路径一致。

## 候选 cap

`KEYWORD_INDEX_CANDIDATE_ID_CAP = 2000`：并集超限时用 `selectPostingCandidateIds`——按 Σ(1/postingLen) 稀有度加权截断，避免常见 CJK 单字先塞满挤掉稀有命中。**不**用 posting 分替代精排。

## Schema（Memory DB v4）

| Store                | keyPath                             | 值                                                      |
| -------------------- | ----------------------------------- | ------------------------------------------------------- |
| `keyword_postings`   | `id` = `` `${ownerId}\0${token}` `` | `{ id, ownerId, token, itemIds: string[] }`             |
| `keyword_index_meta` | `ownerId`                           | `{ ownerId, schemaVersion, builtAt, itemCount, dirty }` |

`upgrade` **只建表**，不在迁移里全量建索引。

## 文档 token

`extractDocumentIndexTokens(item)`：对 `collectSearchableFields` 各字段提取 **查询 token 超集**（拉丁词 + CJK 1/2-gram 截断 + `tokenizeRecallClueDetailed`），单条上限防爆。

软删：`deletedAt != null` 的条目不进 posting。

## 维护

| 事件                                       | 动作                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| 单条 `put` 且文档 token 变化、索引**健康** | **增量** `applyItemTokenDiff`（增删 posting）                        |
| 单条 `put` token 变化但索引不健康          | `dirty=true`，等 Recall rebuild                                      |
| `put` 仅行为字段（open/dismiss）           | token 不变 → 不动索引                                                |
| `putMany` 且索引**健康**、条数 ≤500        | **批内增量** `applyItemTokenDiffs`（同 owner 单事务；按 token 聚合） |
| `putMany` 不健康 / 条数 >500               | `dirty=true`，等 Recall rebuild                                      |
| `replaceOwnerItems`                        | 清空该 owner posting + dirty                                         |
| Recall                                     | meta 缺 / dirty → **rebuild** 后查询；失败则 fallback 全表扫         |

## 明确不做（本 Phase）

- 用 posting 分替代 FIELD_WEIGHTS / fuzzy / behavior
- upgrade 同步扫库建索引
- 云端 posting；多设备仍本机重建
- 第三方语料连接器

## 修订

| 日期       | 变更                                       |
| ---------- | ------------------------------------------ |
| 2026-08-11 | Phase 1：预过滤 + dirty/rebuild + fallback |
| 2026-08-11 | 单条 put 健康索引下增量维护 posting        |
| 2026-08-11 | putMany ≤500 健康索引批内增量 posting      |
| 2026-08-11 | 候选 cap：稀有度加权截断（非 FIFO slice）  |
