# 时间置信度分层 · 执行计划（2026-09-10）

> **状态：** 已落地（产品 Normative + 代码 + must + MCP 2026-09-10）  
> **前置共识：** 自然 clue 采样仍是**决策主线**；本计划是已观测失败（硬窗 `no_match` / 糊时间切空）驱动的 **P1 工程刀**，不替代采样。  
> **禁止：** 用扩开放同义/内容灰名单冒充通解；糊时间硬编码成「精确月数」后轻易空结果。

## 目标

| 档       | label 例                                                                    | Filter                                                          |
| -------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **high** | `today` / `yesterday` / `day_before_yesterday` / `last_week` / `last_month` | **硬筛** `timeRange`                                            |
| **low**  | `recent` / `a_while_ago` / `few_months_ago` / `long_ago`                    | **不硬空**：窗内软加分；窗外保留；禁止仅因糊时间终局 `no_match` |

置信度由 **label → 确定性表** 派生（LLM 不得自报 confidence）。

## 步骤

1. ✅ 产品文档相对时间表 + ADR-011 + 本页
2. ✅ `ParsedRecallClue.timeConfidence` + `timeConfidenceForRelativeLabel`
3. ✅ `filterMatchesByParsedTimeRange` / 约束邻域 / Hybrid 分流 + soft boost
4. ✅ Framing：low → `Around …,`（非 `Within`）
5. ✅ 闭集 surface：`some time ago` → `a_while_ago`；`a long time ago` → `long_ago`
6. ✅ 单测 + recall-eval must；MCP UI：high=`Within last week`；low=`Around a while ago` + postgres 邻域命中（对照原 T28 硬空）

## 与采样关系

```
采样(B) 继续量自发线索
    ↕ 并行可观测
本计划(D) 修「糊时间硬空」已知坑
    → must 以采样口语优先补强
```
