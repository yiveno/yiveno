# §7.2 P2 · Outcome 隐式标签校准

> **Normative：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§7.2** 落地顺序 P2。  
> **代码：** `frontend/src/core/recall/recall-outcome-calibration.ts`

## 目标

在 **不污染 settled / often_opened** 的前提下，校准：

1. **dwell 阈值**（默认 `RECALL_OUTCOME_DWELL_THRESHOLD_MS = 10000`）
2. **C2**（多开后 last + dwell + stop → `settled_last` / `medium_low`）是否可进 settled
3. **Mark↔隐式一致率** 与 **False target 率**（相对种子 gold）

## 门禁（未过门前）

| 常量                               | 默认        | 含义                                                                       |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `RECALL_OUTCOME_C2_SETTLE_ENABLED` | **`false`** | C2 **只打日志**，`recallOutcomeCountsAsSettled` 对 `medium_low` 返回 false |
| dwell                              | 10s         | 可调；调后须更新本文与单测                                                 |

**禁止：** 未过门将 C2 写入 `settledCount`、纳入 `often_opened`、或当作 recall-eval **must** 正例。

## 观测

Mark 结算时 `commitRecallOutcome` 打：

- `implicitSource` / `implicitTargetId`：仅用 opens+stop 的隐式结算
- `markImplicitAgrees`：`true` 同 id · `false` 冲突 · `null` 隐式非 target（不计入一致率分母）

一致率 = `agrees===true` 次数 / `agrees!==null` 次数。

## 种子 gold 对拍（最小）

与 TTE 种子 study 可共用会话；每任务记录：

1. gold `targetId`（允许替代集）
2. 用户是否 Mark / 出口 Found / dismiss / absent
3. 若仅隐式：C1/C2 推断 id（从日志或本机 Outcome 事件）

**建议过门（可随 study 收紧）：**

| 指标                         | Alpha 参考                              |
| ---------------------------- | --------------------------------------- |
| Mark↔C1 一致率（有配对时）   | ≥0.85                                   |
| Mark↔C2 一致率（有配对时）   | ≥0.70                                   |
| C2 False target（相对 gold） | ≤0.25                                   |
| 配对样本数                   | C2 至少 30 次有 Mark 或 gold 的多开会话 |

过门后：将 `RECALL_OUTCOME_C2_SETTLE_ENABLED` 改为 `true`，并在产品文档 §7.2 变更日志记一笔。

## 单测

- `recall-outcome-calibration.test.ts`：默认关 C2；Mark↔隐式对拍
- `recall-outcome.test.ts`：决策树（含 C2 标签仍可解析，但不进 settled）
