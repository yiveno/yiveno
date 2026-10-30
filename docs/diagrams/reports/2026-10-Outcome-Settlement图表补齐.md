---
created: 2026-10-31T00:41:05+08:00
updated: 2026-10-31T00:45:00+08:00
author: agent:cursor
scope: Mermaid 第七阶段 · 补登记图 recall.outcome-settlement-channels（只改运行时宿主 / registry / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/reports/2026-10-Capture-Open图表语义复审.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/core/recall/recall-outcome.ts
  - extension/src/application/recall/commit-recall-outcome.ts
  - extension/src/pages/sidepanel/SidePanel.vue
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（新增 recall.outcome-settlement-channels）
---

# Outcome Settlement 图表补齐（2026-10-31）

> **本轮约束：** 补盘点 **P0-3** `recall.outcome-settlement-channels`；**不**改业务代码 / Outcome 契约；**不**顺手改 Open/Dismiss 单通道图语义（除非证据要求——本轮未改既有 Mermaid 边）；**不**开 Billing / Omnibox / Bookmark。  
> **口径：** 代码事实与 Normative 分列；open ≠ Found ≠ settled。

---

## 0. 一句话结论

登记 **flowchart** 总览：钉死 **Open / 标签 Feedback / settled 写库** 三分；通道 **B / B′ / D / C1 / C5 已接线**，**C2 默认可解析不写 settled**，**A Mark 已下线**；结算入口 = dismiss/no_match 中途 commit + New find（可先出口条）+ 关 Panel 静默 Flush；**`settleWriteDone` 防双计**。

---

## 1. Outcome 通道清单及调用链

| 通道             | 用户动作                             | 标签                                       | 置信               | 调用链（代码）                                                                                  | 状态                            |
| ---------------- | ------------------------------------ | ------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| **B Dismiss**    | None of these                        | `none_in_results`                          | strong             | `handleDismissCandidates` → `RECORD_RECALL_DISMISS` **∥** `commitRecallOutcome(reason=dismiss)` | **已接线**                      |
| **B′ no_match**  | 诚实无相关终局                       | `absent`                                   | strong             | Recall 结果 `outcome=no_match` → `sawNoMatchFinal` + `commitRecallOutcome(reason=no_match)`     | **已接线**                      |
| **D Exit strip** | 同场 New find 前 Found / None / Skip | `target` / `none` /（Skip→树落入 unknown） | strong（点了才算） | `shouldOffer…` → 条 → `completeNewFindSession` → `flushOutcomeSession(..., true)`               | **已接线**；关 Panel **不**补问 |
| **C1**           | 单 open + dwell≥T + stop             | `target` · `settled_single`                | medium             | `finalizeOpenDwell` + `sessionStopped` → resolve → **可写** settled                             | **已接线**                      |
| **C5**           | detail export copy/download          | `target` · `copy`                          | medium_high        | 仅写 `copiedOrPackedId`；**等** Flush 再 resolve                                                | **已接线**（信号侧）            |
| **C2**           | 多 open + 末条 dwell + stop          | `target` · `settled_last`                  | medium_low         | resolve 可出标签；`RECALL_OUTCOME_C2_SETTLE_ENABLED=false` → **不写** settled                   | **半开**：标签 on / settled off |
| **A Mark**       | 结果卡「Mark as…」                   | —                                          | —                  | UI 已移除；`source: mark` 仅兼容旧落盘                                                          | **已下线**                      |

**共用核：** `resolveRecallOutcome`（纯函数树）→ `commitRecallOutcome`（日志 + P3 pair + 条件 `recordRecallSettle`）。

---

## 2. Open 与 Settlement 的区别

|                    | Open                       | Outcome 标签                              | Settlement 写库                                                     |
| ------------------ | -------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| **是什么**         | 用户打开/查看一条          | 会话级「答案是谁 / 都不是 / 没有 / 未知」 | 条目 `settledCount` / `lastSettledAt`                               |
| **消息**           | `RECORD_MEMORY_OPEN`       | 内存 resolve + pair storage               | `RECORD_RECALL_SETTLE`                                              |
| **触发**           | 打开结果 / Detail ready 等 | dismiss / no_match / Flush                | `recallOutcomeCountsAsSettled` ∧ `!settleWriteDone` ∧ 有 `targetId` |
| **等于找回成功？** | **否**                     | 标签有强弱                                | strong/校准 medium 才进 `often_opened`                              |

**Open 不直接触发 settlement。** 仅把 `{id,at}`（稍后可补 `dwellMs`）塞进 `outcomeSession.opens`。

---

## 3. C1 / C2 实际策略

|                     | C1                                                            | C2                                               |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| **条件**            | `sessionStopped` ∧ 唯一 open id ∧ 末开 dwell≥阈值（默认 10s） | `sessionStopped` ∧ 多唯一 open ∧ 末开 dwell≥阈值 |
| **source**          | `settled_single`                                              | `settled_last`                                   |
| **confidence**      | `medium`                                                      | `medium_low`                                     |
| **写 settledCount** | **是**（`recallOutcomeCountsAsSettled`）                      | **否**（默认 `allowSettledLast=false`）          |
| **Normative**       | P1 已接线                                                     | P2：可解析；开 settled 须过校准旁挂 gold 门      |

无 dwell 的 last-open **不得**升 C1/C2（`meetsDwell` 要求 `dwellMs` 已定义）。

---

## 4. 并发与幂等机制

| 机制                        | 证据                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- |
| dismiss 双轨并行            | dismiss 图 `par`：IDB dismissCount ∥ Outcome commit（分计）                             |
| 一会话至多一次 settled 写库 | `settleWriteDone`；commit 内若已 done 跳过 `recordRecallSettle`                         |
| 出口 Found 后再 Flush       | 先设 `exitChoice` 再 `completeNewFindSession` → 树优先 D，避免再被 C1 覆盖              |
| 新候选清 sticky dismiss     | 有 top_pick/need_a_clue 时 `dismissedPending=false`（防后续命中仍被 none 盖住）         |
| 关 Panel 只结算一次         | `outcomeCloseHandled` + `onUnmounted` → `handlePanelCloseOutcome`                       |
| 失败                        | commit / settle / pair **best-effort**，不抛挡 New find / 关 Panel / dismiss UI         |
| dismiss 撤脏 pair           | `none_in_results` → `revokeTargetOutcomePairsForFingerprint`；**不**回滚 `settledCount` |

**未发现**独立「重试队列」；失败即丢、下次会话另算。

---

## 5. 源码与规范差异

| 项                                      | Normative §7.2 | 代码                                                 | 图处置                           |
| --------------------------------------- | -------------- | ---------------------------------------------------- | -------------------------------- |
| open ≠ settle                           | 铁律           | Open / settle 分消息                                 | **一致**                         |
| 优先级 D>B/B′>C1>C5>C2                  | 决策树         | `resolveRecallOutcome` 同序（Mark 已删）             | **一致**                         |
| C2 默认不写 settled                     | P2             | `RECALL_OUTCOME_C2_SETTLE_ENABLED=false`             | **一致** · Note                  |
| A Mark 下线                             | 2026-08-26     | UI 无 Mark；schema 保留 `mark`                       | **图外**（已下线）               |
| 关 Panel 静默结算                       | 撤 exit park   | `onUnmounted` Flush；无跨次条                        | **一致**                         |
| C5 条件「无新 clue / 无 dismiss」等示意 | 表为示意       | 实现：有 `copiedOrPackedId` 且未被更高优先级盖住即中 | **基本一致**；细条件以纯函数为准 |
| **未发现**须用图掩盖的硬冲突            | —              | —                                                    | —                                |

---

## 6. 未解决问题

| 项                                   | 状态                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 是否改既有 open/dismiss Mermaid      | **未改**（本总览图分工即可）                                                                    |
| C2 何时改常量开 settled              | 旁挂校准；本图标默认 false                                                                      |
| Omnibox Outcome                      | **禁止**（ADR-007）；故意不画                                                                   |
| pair 重排消费细节                    | Hybrid `applyOutcomePairScoreAdjustments`；总览折叠                                             |
| 多 Tab Side Panel 并发会话           | **未穷尽**；以单 Panel `outcomeSession` 为准                                                    |
| 产品文档仍链 `docs/engineering/R4-…` | 文件已在 `docs/archive/engineering/`；**本轮未改产品文档链接**（越界）                          |
| 产品文档仍链 `docs/engineering/R4-…` | 文件已在 `docs/archive/engineering/`；**本轮未改产品文档链接**（范围外）；registry 已指归档路径 |

---

## 7. 验证结果

### 7.1 命令

```bash
bun run docs:check-diagrams
```

**结果（2026-10-31）：** `✅ diagrams 校验通过（13 张）· docs/diagrams/registry.json`  
（初跑失败因 `R4-Outcome-Labeling-P2-校准.md` 已迁 `docs/archive/engineering/`；registry `docPaths` 已改归档路径。）

### 7.2 触及路径

| 路径                                                          | 动作                                      |
| ------------------------------------------------------------- | ----------------------------------------- |
| `docs/architecture/Yiveno-运行时架构流程-v1.md`               | §3.4.1 + 锚点 + flowchart；文首状态条链接 |
| `docs/diagrams/registry.json`                                 | 新增 `recall.outcome-settlement-channels` |
| `docs/diagrams/reports/2026-10-Outcome-Settlement图表补齐.md` | 本文件                                    |

**未改：** 业务源码、其它登记图 Mermaid 正文、产品 Normative 契约条文、同步脚本。

### 7.3 停止线

按 Brief：**本阶段完成后停止**，不自动进入 Omnibox / Bookmark / Billing 补图。
