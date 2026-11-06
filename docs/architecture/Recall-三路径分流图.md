---
created: 2026-11-07T06:30:00+08:00
updated: 2026-11-07T06:55:01+08:00
author: agent:cursor
scope: Recall 三路径分流一页纸地图（定位用；不调参）
status: active
upstream:
  - docs/product/CURRENT.md
  - extension/src/application/recall/recall-service.ts
  - extension/src/application/recall/backends/hybrid-recall-backend.ts
downstream:
  - 排查 Recall 找不准 / Top Pick 错 / no_match 时的首读入口
---

# Recall · 三路径分流图（一页纸）

> **本波冻结召回核心调试**（`CURRENT.md`）：本图只用来**定位**问题，**不**调权重 / 阈值 / 门禁参数。

## 1. 唯一入口

`extension/src/application/recall/recall-service.ts` → `recallWithClue(clue, { entry, context, onVisibleProgress })`  
内部单例 `HybridRecallBackend`（`entry === 'omnibox'` 记为 `omnibox_local`，否则 `hybrid`）。

## 2. 分流（入口 + 登录态 + 在线态）

| 轨                   | 理解                                                                                                                                    | 检索                                                   | 禁止                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Omnibox**          | `understandRecallClue` + `forceMode: 'lexical'`（无 LLM completer）                                                                     | `finalizeKeywordResult` + `behaviorProfile: 'omnibox'` | Semantic / Hybrid 融合 / LLM / Outcome；下拉组装见 `omnibox-suggest.ts` |
| **Side Panel / MCP** | `understand/understand-recall-clue.ts`：有网默认 LLM（ADR-021）；失败 → `rules_fallback` → `parse-recall-clue.ts`；断网薄适配可省略 LLM | 有登录态且扫描集有 embedding → Hybrid；否则降级关键词  | —                                                                       |

**主题闸：** 无 topic anchor 且非时间/类型约束邻域 → **不进检索**，`emptyKind=missing_topic`，只追问一次。

**候选加载**（`memory-item-service`）：优先关键词倒排 → 倒排空/失败/无命中 → 全表扫；`RECALL_SCAN_LIMIT=20000`；fallback `RECALL_FALLBACK_SCAN_LIMIT=100000`；摘录前置合并 `listByOwner({ type: 'text_excerpt', limit: 500 })`。

**关键词 Filter**（`keyword-filter.ts`）字段权重：title 24 / note 26 / pageTitle 20 / textExcerpt 18 / summary 16 / domain 14 / url 10 / keywords 12 / tags 12 / **excerptContext 8**。Omnibox 另有抬标题压正文的变体权重 `OMNIBOX_FIELD_WEIGHTS`（title 28 / note 30 / domain 18 / url 14 / pageTitle 22 / textExcerpt 12 / excerptContext 4 / summary 12），见 `keyword-filter.ts`。  
门槛：`RECALL_MIN_MATCH_SCORE=10`，`RECALL_TOP_PICK_MIN_SCORE=18`。  
系数：ngram 0.5、模糊（编辑距离 ≤1）0.6、主内容命中加成 16、行为加成 cap 12、dismiss 扣减 cap 10。

**Hybrid**（`hybrid-recall-backend.ts` + `hybrid-fusion.ts`）：关键词池折至 `HYBRID_KEYWORD_POOL=100` → Worker embed → 语义近邻默认 24（keyword miss 可扩至 100）→ `HYBRID_MIN_COSINE_SIMILARITY=0.28`，`HYBRID_SEMANTIC_SCORE_SCALE=50` → 余弦 + RRF（`k=60`）。无登录态或扫描集无 embedding → 降级关键词。

**佐证与组装：** `content-term-corroboration.ts`（`contentTerms` 非空时须库内词面佐证；关键词路硬滤，Hybrid 路先软罚 `HYBRID_CORROBORATION_SOFT_PENALTY=8`）→ `build-recall-result.ts` 三态 `top_pick` / `need_a_clue` / `no_match`；池软顶 50，首屏 5，DOM 软顶 20。

## 3. 30 秒诊断表

| 症状                              | 先读 1 个文件                                   | 先跑                                               |
| --------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| 找不准 / 邻域偏                   | `hybrid-recall-backend.ts`（分流与 fuse）       | `cd extension && bun run nlu:try -- "<真实 clue>"` |
| Top Pick 错                       | `keyword-filter.ts` + `build-recall-result.ts`  | 同上；对照 `RECALL_TOP_PICK_MIN_SCORE`             |
| 直接 `no_match` / `missing_topic` | `understand-recall-clue.ts`（理解）或候选加载段 | `nlu:try`；确定性替身 `bun run test:must`          |

## 4. 源码锚点（速查）

| 环节                 | 路径                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| 入口                 | `application/recall/recall-service.ts`                                             |
| 后端分流             | `application/recall/backends/hybrid-recall-backend.ts`                             |
| 扫描上限             | `application/recall/backends/recall-scan-limit.ts`                                 |
| 候选/摘录合并        | `application/memory/memory-item-service.ts`                                        |
| Omnibox 下拉         | `core/recall/omnibox-suggest.ts`                                                   |
| 理解                 | `core/recall/understand/understand-recall-clue.ts`                                 |
| Filter / Hybrid 融合 | `core/recall/keyword-filter.ts` · `core/recall/hybrid-fusion.ts`                   |
| 佐证 / 结果          | `core/recall/content-term-corroboration.ts` · `core/recall/build-recall-result.ts` |
