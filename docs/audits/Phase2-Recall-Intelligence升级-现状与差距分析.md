---
created: 2026-09-17T14:46:37+08:00
updated: 2026-09-17T15:05:00+08:00
author: agent:cursor
scope: 在 Phase 0/1 基础上，盘点 Recall Intelligence 相关能力落点与差距
status: final
upstream:
  - Yiveno-现实地图.md
  - Phase1-架构完整性审计.md
downstream:
  - §5.9 种子验证 / Recall 质量闭环（自然 clue 采样 + recall-eval / TTE / Outcome §7.2）
  - 后续 Recall 迭代排期
---

# Yiveno Phase 2 — Recall Intelligence 升级：现状与差距分析

> 纯分析，不修改代码。基准：Phase 0 Reality Map + Phase 1 架构完整性审计。
> 对应英文口径：Recall Intelligence Upgrade — Gap Analysis & Implementation Plan。

---

## 0. 摸底结论：Phase 2 大部分目标已实现

经过对 `frontend/src/core/recall/` 和 `eval/` 的逐文件审查，**Phase 2 目标中的大部分能力已在代码中实现**。下表是精确对照：

| Phase 2 目标                        | 代码证据                                               | 状态   |
| ----------------------------------- | ------------------------------------------------------ | ------ |
| ✅ 保留用户原始 query               | `ParsedRecallClue.raw`                                 | 已实现 |
| ✅ 解析失败 graceful fallback       | `source: 'rules_fallback'`                             | 已实现 |
| ✅ Query Understanding Gold Dataset | `parse-gold-cases.ts`（40 条 must/stretch）            | 已实现 |
| ✅ Query Understanding eval         | `runParseGold()` + `runParseGoldAsync()`               | 已实现 |
| ✅ Noise Gateway eval               | `noise-gateway-cases.ts` + `run-noise-gateway-eval.ts` | 已实现 |
| ✅ Hybrid Retrieval Pipeline        | `fuseHybridMatches()` + RRF                            | 已实现 |
| ✅ Keyword + Semantic 双路融合      | `fuseScoredPools()`                                    | 已实现 |
| ✅ Behavior signals soft 加权       | `computeBehaviorBoost()` cap 12                        | 已实现 |
| ✅ 当前 tab 域名加成                | `applyCurrentTabDomainBoost()`                         | 已实现 |
| ✅ 可解释排序                       | `explainRecallMatch()` + `matchedFields[]`             | 已实现 |
| ✅ Framing eval                     | `recall-framing-eval.ts`                               | 已实现 |
| ✅ Recall eval（Keyword）           | `runRecallEval()` + `recall-eval-cases.ts`（42 条）    | 已实现 |
| ✅ Recall eval（Hybrid）            | `runHybridEval()` + `hybrid-eval-cases.ts`             | 已实现 |
| ✅ Cold Start clue examples         | `generateGettingStartedClueSamples()`                  | 已实现 |
| ✅ Outcome Labeling schema          | `recall-outcome-pairs.ts` + `commit-recall-outcome.ts` | 已实现 |
| ✅ TTE 埋点                         | `recall-telemetry.ts` 七事件                           | 已实现 |
| ✅ ECS 打分                         | `scoreRecallEvidenceEcs()`                             | 已实现 |

---

## 1. 真正的 Gap（Phase 2 实施应聚焦的部分）

### Gap 1：真实库 Recall Accuracy 可见性（P0）

**现状：** `runRecallEval` 只跑工厂 corpus（30 条合成 MemoryItem）。

**问题：** 无法知道 Yiveno 在**真实用户库**上的 Recall quality。

**建议：**

- 创建 `scripts/recall-eval-real.mjs`：读本机 IndexedDB → 跑 eval → 输出报告
- 建立定期跑真实库 eval 的机制（手动或 CI）

### Gap 2：Outcome Labeling UI 收集通道（P0）

**现状：** `commit-recall-outcome.ts` 定义了 schema，`RecallConversation.vue` 有 `dismiss` 事件。但「弱确认」通道（用户确认「找到了」）没有明确的 UI 入口。

**问题：** Outcome Labeling §7.2 P1 需要用户主动标注「这条是 / 不是答案」，但当前 UI 只有 dismiss（负反馈），没有正反馈收集路径。

**建议：**

- 确认 Side Panel Recall 结果卡上是否有「Found it」类正反馈按钮
- 如果没有，增加弱确认通道（点击结果 → 隐式正反馈）

### Gap 3：Eval 框架与 CI 集成（P1）

**现状：** `runRecallEval`/`runParseGold` 存在于测试框架中，但没有作为 CI pre-push 门禁正式接入。

**建议：**

- 将 `recall-eval must` 纳入 `bun run test:run`
- 确保 pre-push 门禁跑 recall eval must

### Gap 4：Explanation UI 分条展示（P1）

**现状：** `explainRecallMatch()` 输出结构化 `reasonParts`，但 `RecallResultCard.vue` 只展示单行 `reasonLine`。

**Phase 2 目标要求：**

```
Why this result?
✓ matched "RAG"
✓ saved from AI research domain
✓ opened 3 times before
```

**建议：** 在 `RecallCardModel` 增加 `reasonParts?: string[]`，UI 侧渲染 ✓ 分条。

### Gap 5：真实库 Golden Dataset 扩增（P1）

**现状：** 42 条工厂 corpus eval cases。

**建议：** 收集真实用户 recall case → 加入 `recall-eval-cases.ts`，持续扩增至 100 条。

### Gap 6：LLM vs 规则解析质量对比报告（P1）

**现状：** `runParseGoldAsync()` 已存在，但需要对比 LLM 解析 vs 规则解析在真实 clue 上的质量差异。

**建议：** 创建 `run-parse-comparison.ts`，输出量化对比报告（LLM 提升了多少 stretch case）。

---

## 2. 当前不需要实施的部分

以下 Phase 2 目标**已在代码中完整实现，不需要新增代码**：

| 不需要实施                      | 证据                                                  |
| ------------------------------- | ----------------------------------------------------- |
| Query Understanding schema 扩展 | `ParsedRecallClue` 已有完整槽位                       |
| Hybrid Retrieval Pipeline 新增  | `fuseHybridMatches` + RRF 已完整                      |
| Ranking System 重构             | 排序因子完整且合理                                    |
| Behavior Signals 新增           | `computeBehaviorBoost` / `applyCurrentTabDomainBoost` |
| Evaluation Framework 新建       | eval 体系已覆盖 parse/noise/recall/framing/hybrid     |
| Cold Start clue examples 新建   | `generateGettingStartedClueSamples` 已实现            |
| LLM/Data Plane 边界调整         | ADR-004 执行完整                                      |

---

## 3. 实施计划（按优先级）

### P0-A：真实库 Recall Accuracy 基线测量

**目标：** 获得 Yiveno 在真实库上的 Recall quality 数字。

**做法：**

1. 创建 `scripts/recall-eval-real.mjs`（Node 脚本）
   - 读本机 IndexedDB（通过 MCP 或直接 IndexedDB 访问）
   - 按 `recall-eval-cases.ts` 的格式构造 corpus 子集
   - 跑 `runRecallEval` 输出 must/stretch 报告
2. MCP 实测：提交 5–10 条真实 clue → 记录 Recall 结果 → 对比 eval 预测

**文件：**

- 新增 `scripts/recall-eval-real.mjs`
- （可选）新增 `frontend/src/core/recall/eval/real-corpus-helpers.ts`

### P0-B：Outcome Labeling UI 通道确认

**目标：** 确保正向 Outcome Labeling 有收集路径。

**做法：**

1. 检查 `RecallConversation.vue` 的结果卡交互
2. 确认「点击结果打开 / 复制」是否隐式记录 `target` Outcome
3. 补充缺失的正反馈通道

**文件：**

- 修改 `frontend/src/pages/sidepanel/components/RecallConversation.vue`（如有缺口）
- 修改 `frontend/src/application/recall/commit-recall-outcome.ts`（如有缺口）

### P1-A：Recall eval 接入 CI

**目标：** 让 recall eval must 成为 pre-push 门禁。

**做法：**

1. 在 `frontend/src/core/recall/eval/` 确认 `runRecallEval()` 可独立运行
2. 在 `frontend/package.json` 的 `test:run` 脚本中加入 eval runner
3. 确认 `run-hybrid-eval.test.ts` 已通过

**文件：**

- 修改 `frontend/package.json`
- （如有）新增 `frontend/src/core/recall/eval/recall-eval-cli.ts`

### P1-B：Parse Quality 对比报告

**目标：** 量化 LLM 解析 vs 规则解析的质量差异。

**做法：**

1. 创建 `run-parse-comparison.ts`
2. 用 `runParseGold()`（规则）vs `runParseGoldAsync()`（LLM）跑同一批 cases
3. 输出对比报告

**文件：**

- 新增 `frontend/src/core/recall/eval/run-parse-comparison.ts`

### P1-C：Explanation UI ✓ 分条

**目标：** 实现 Phase 2 目标中的「每一项都可解释」。

**做法：**

1. 在 `explainRecallMatch` 输出 `reasonParts: string[]`
2. 在 `RecallCardModel` 增加 `reasonParts`
3. 在 `RecallResultCard.vue` 渲染 ✓ 分条

**文件：**

- 修改 `frontend/src/core/recall/explain-recall-match.ts`
- 修改 `frontend/src/pages/sidepanel/recall-conversation-types.ts`
- 修改 `frontend/src/pages/sidepanel/RecallResultCard.vue`

---

## 4. 不修改的内容（Architecture Integrity）

Phase 1 发现的以下问题在 Phase 2 实施中**不处理**（保持原样）：

- P0-1：`subscription-service.ts` 跨层依赖
- P1-1：`effectiveContentTermsForRecall` 双路径调用

---

## 5. Phase 2 真实工作估算

### 高可信估算（已有代码支撑）

| 任务                            | 工作量                     | 风险 |
| ------------------------------- | -------------------------- | ---- |
| P0-A：真实库 eval 脚本          | 小（新增 1 个 .mjs）       | 低   |
| P0-B：Outcome Labeling 通道确认 | 小（UI 交互确认 + 补缺失） | 低   |
| P1-A：Recall eval 接入 CI       | 中（需要跑通 test runner） | 中   |
| P1-B：Parse Quality 对比报告    | 小（组合现有函数）         | 低   |
| P1-C：Explanation UI ✓ 分条     | 中（跨 core/UI 多文件）    | 中   |

### 需要先决策再估

| 任务                         | 前置条件                                                |
| ---------------------------- | ------------------------------------------------------- |
| 真实库 Golden Dataset 扩增   | 需要 P0-A 的 baseline 数字                              |
| 排序权重配置化               | 需要真实库 eval 数据验证不同配置                        |
| Structured Query Schema 扩展 | 需要 Phase 2 用户调研（intent/entity 字段是否真的需要） |

---

## 6. 建议下一步

1. **先跑 P0-A**（真实库 eval）+ **P0-B**（Outcome Labeling 确认），获得 baseline 数字和当前质量感知
2. **基于 baseline 决定** P1-C（Explanation UI）是否值得实施
3. **再决定** 是否需要 Structured Query Schema 扩展

Phase 2 的核心不是新增功能，而是**验证已有功能的真实效果**。
