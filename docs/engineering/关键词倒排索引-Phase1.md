# 关键词倒排索引（Phase 1）

> 工程备注。产品 Normative 见产品文档 §0.4 / §8 R3。  
> **术语：** [`Yiveno-术语表.md`](../product/Yiveno-术语表.md)。  
> 冲突时先改产品文档。

## 目标

在 **不改变** `keyword-filter` 打分语义的前提下，用倒排 **预过滤候选**，避免每次 Recall 全表加载 ≤10k 条再逐条扫。

```text
clue → 理解 / 门禁
  → clue 分词 token（复用 tokenizeRecallClueDetailed）
  → 倒排 union(postings) → 批量 getById
  → 现有 Filter / Hybrid / 追问
```

索引 **不健康 / 未建** → **fallback** `list(RECALL_SCAN_LIMIT)`，行为与旧路径一致。

**形态缩写（2026-08-26，无硬编码别名表）：**

1. **建索引**：`extractDocumentIndexTokens` 对原文调用 `extractOrthographicAcronyms`——CamelCase/连续大写首字母（`JavaScript`→`js`，`CSS`→`css`）与连续 2–3 个拉丁词首字母（`React Native`→`rn`），写入 posting。
2. **查询侧**：`pickPostingLookupTokens` 只返回 clue 分词 token（如 `js`），直接查 posting；**不**维护 js→javascript 对照表。
3. **精排**：同一套形态缩写命中。注意：全小写 `javascript` **既不含**连续子串 `js`、**也不以** `js` 开头——无大小写/分词边界时残差靠字面 / Hybrid，不写死民间缩写词典。
4. **schemaVersion = 2**：升版强制 rebuild，否则旧 posting 无缩写 token。

## 候选 cap

`KEYWORD_INDEX_CANDIDATE_ID_CAP = 2000`：并集超限时用 `selectPostingCandidateIds`——按 Σ(1/postingLen) 稀有度加权截断，避免常见 CJK 单字先塞满挤掉稀有命中。**不**用 posting 分替代精排。

## Schema（Memory DB v4）

| Store                | keyPath                             | 值                                                      |
| -------------------- | ----------------------------------- | ------------------------------------------------------- |
| `keyword_postings`   | `id` = `` `${ownerId}\0${token}` `` | `{ id, ownerId, token, itemIds: string[] }`             |
| `keyword_index_meta` | `ownerId`                           | `{ ownerId, schemaVersion, builtAt, itemCount, dirty }` |

`upgrade` **只建表**，不在迁移里全量建索引。

## 文档 token

`extractDocumentIndexTokens(item)`：对 `collectFilterIndexFields` 各字段提取 **查询 token 超集**（拉丁词 + **形态缩写** + CJK 1/2-gram 截断 + `tokenizeRecallClueDetailed`），单条上限防爆。

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

| 日期       | 变更                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------ |
| 2026-08-26 | **形态缩写通解**：删硬编码别名表；索引+精排用 CamelCase/多词首字母；schemaVersion=2 强制 rebuild |
| 2026-08-26 | **折叠前全量打分**：重复 URL 不得在 `collapse` 前按固定条数截断（否则挤掉互异组）                |
| 2026-08-11 | Phase 1：预过滤 + dirty/rebuild + fallback                                                       |
| 2026-08-11 | 单条 put 健康索引下增量维护 posting                                                              |
| 2026-08-11 | putMany ≤500 健康索引批内增量 posting                                                            |
| 2026-08-11 | 候选 cap：稀有度加权截断（非 FIFO slice）                                                        |
