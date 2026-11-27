---
created: 2026-11-27
updated: 2026-11-27
author: agent:cursor
scope: NLG 门禁拒绝率/回退率本地度量与 Worker 日志统一字段；portrait_cluster label 评测资产
status: active
upstream:
  - extension/src/core/recall/understand/nlg-gate-metrics.ts
  - worker/src/services/ai/ai-gate-log.ts
  - extension/tests/eval/portrait-cluster/
downstream:
  - docs/engineering/DEV-调试API.md
---

# NLG 门禁度量口径

> 只写事实口径；**不**写目标阈值。计数只存本机，不上传、不含用户内容文本。

## 1. 扩展侧：拒绝率 / 回退率

### 1.1 覆盖的门禁

| 度量 taskKind        | 接入点                                                 | accepted                     | rejected                                                              | fallback                     |
| -------------------- | ------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------- | ---------------------------- |
| `framing_nlg`        | `complete-recall-framing-nlg.ts`                       | map 通过                     | `rejected:map`                                                        | —                            |
| `follow_up_nlg`      | `complete-recall-follow-up.ts`                         | map 通过                     | `rejected:map`                                                        | —                            |
| `narrow_polish`      | `complete-composer-narrow-example-polish.ts`           | 长度一致（逐位回退不单独计） | —                                                                     | 长度不一致整表回退           |
| `chitchat`           | `parse-recall-clue-with-llm.ts`（`gateChitchatReply`） | 门禁通过                     | `rejected:too_long` / `language_mismatch` / `missing_delete_boundary` | —                            |
| `portrait_narrative` | `generate-portrait-narrative.ts`                       | 校验通过（含纠正重试成功）   | `rejected:<首个 reason>`（首次校验不过）                              | 回退确定性 `summaryText`     |
| `portrait_cluster`   | `generate-portrait-clusters.ts`                        | 划分校验通过                 | `rejected:partition`                                                  | —（共现回退不另计 fallback） |

说明：`chitchat` 请求 API 仍用 `taskKind=nlu`；度量桶单独为 `chitchat`。

### 1.2 比率定义

对某一 `taskKind`、某一 UTC 日桶：

- **调用次数（分母）** = 该日该 taskKind 下所有 outcome 计数之和
- **拒绝率** = `sum(rejected:*)` / 分母
- **回退率** = `fallback` / 分母
- **通过率** = `accepted` / 分母

`portrait_narrative` 在「首次拒收 → 重试成功」路径上会先记一条 `rejected:*` 再记 `accepted`，分母含两者；解读首次拒收与最终通过时请分开看 outcome。

### 1.3 本地读取

- **键：** `yiveno:nlgGateMetrics`（`chrome.storage.local`）
- **结构：**

```ts
{
  version: 1,
  days: Array<{
    day: string // UTC YYYY-MM-DD
    counts: Record<taskKind, Record<outcome, number>>
  }> // 保留最近 14 天
}
```

- **API：** `readNlgGateMetrics()`（`extension/src/core/recall/understand/nlg-gate-metrics.ts`）
- 落盘经 `installNlgGateMetricsChromeStorage()`（Background bootstrap + 扩展页 UI bootstrap）；失败静默。

## 2. Worker 日志聚合

parse / 校验拒收日志统一带字段（附加业务字段可并存）：

| 字段       | 值                                                       |
| ---------- | -------------------------------------------------------- |
| `event`    | 固定 `ai_gate_rejected`                                  |
| `taskKind` | `gs_samples` / `enrichment` / `extract` / `dreaming`     |
| `reason`   | `parse_failed` \| `validation_failed` \| `quote_dropped` |

组装函数：`buildAiGateRejectedLogFields`（`worker/src/services/ai/ai-gate-log.ts`）。

- GS / enrichment / extract / dreaming：**parse 失败** → `reason=parse_failed`（沿用原 message 名，字段补齐）。
- Dreaming：若 `droppedQuoteCount > 0`，另打汇总行 `dreaming_complete_quote_dropped`，`reason=quote_dropped`（保留既有 `droppedQuoteCount`）。
- **不**改响应码与配额口径。

Dashboard / logpush 可按 `event=ai_gate_rejected` + `taskKind` + `reason` 聚合。

## 3. portrait_cluster label 评测

| 项             | 路径 / 命令                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 用例（12 组）  | `extension/tests/eval/portrait-cluster/cases.ts`                                                                       |
| Scorer         | `extension/tests/eval/portrait-cluster/score.ts`（复用 `validatePortraitClusters`；多成员簇 label 子串命中期望关键词） |
| 单测（假输出） | `extension/tests/eval/portrait-cluster/score.test.ts`                                                                  |
| 手动 LLM 跑    | `cd extension && bun run portrait-cluster:eval`（需 `DEEPSEEK_API_KEY`；每组 1 次）                                    |

评分：划分合法 **且** 每个多成员簇的 `label` 命中该组 `expectedLabelKeywords` 任一词（大小写不敏感子串）→ pass。
