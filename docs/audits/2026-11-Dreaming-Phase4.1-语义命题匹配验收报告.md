---
title: 2026-11 Dreaming Phase 4.1 语义命题匹配验收报告
created: 2026-11-16 16:11 +0800
updated: 2026-11-16 17:26 +0800
author: agent:cursor
scope: Dreaming Phase 4.1 · 语义命题匹配（向量生产 / 同集入闸 / 阈值标定）；开关默认 OFF；F1–F4 修补
status: accepted-darkline
upstream:
  - HEAD 633174b4 + UI Batch 2 未提交层
  - ADR-022 §7 增补
  - docs/product/Yiveno-产品文档-v4.0.md §7.05
downstream:
  - extension 命题向量 store / note-match / Hybrid 查询向量复用
  - DREAMING_SEMANTIC_NOTE_MATCH_* 常量（默认 OFF）
  - dreaming-alarm 每日 tick 回填接线
---

# 2026-11 Dreaming Phase 4.1 语义命题匹配验收报告

## 1. 结论

**建造完成，语义匹配停在暗线。** 独立向量 store（IDB v7）+ 批量生产/回填 + rule 0b 同集入闸 + 语义评分路径 + Explain/遥测区分 + 合成评估阈值标定均已接线；`DREAMING_PREFER_READ_ENABLED` 与 `DREAMING_SEMANTIC_NOTE_MATCH_ENABLED` **均为 false**。合成评估硬线（误报 ≤2%、字面前提零重叠、语义 OFF 零向量加载）通过；F1–F4 阻塞项已补；真实库遥测复核留待开关 ON 后。

## 2. Step 0 定锚（实测）

| 项                               | 实测                                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| HEAD                             | `633174b4`                                                                                                              |
| UI Batch 2                       | 墓碑模块在；`MEMORY_DELETE_BOOKMARK_FORBIDDEN` 已从 extension 删除                                                      |
| must / run / i18n（本批 Step 0） | **127 / 1610 / 733**                                                                                                    |
| noise / live / pressure          | 见收口门禁                                                                                                              |
| 行重                             | 同 store `number[]` 加载 **43.3ms** / 堆估 **15.6MB**；字面-only **3.2ms** → **独立 store v7 + Float32Array**（不降级） |
| 查询向量可复用                   | 确认（`hybrid-recall-backend`）                                                                                         |
| `AI_EMBED_DAILY_LIMIT`           | 默认 Free 100 / Pro 500（无 wrangler 覆盖）                                                                             |

## 3. 阈值标定（完整 27 点曲线 · 本机复算）

- 扫区间：0.28→0.80 step 0.02
- 选定点：**0.66**（误报≤2% 内最大救援率 100%；并列取更严）
- **不得**沿用 0.28（曲线显示 0.28–0.60 对抗误报 20%–100%）

| 阈值      | 救援率 R      | 误报率 F   |
| --------- | ------------- | ---------- |
| 0.28–0.52 | 100% (6/6)    | 100% (5/5) |
| 0.54      | 100% (6/6)    | 80% (4/5)  |
| 0.56      | 100% (6/6)    | 60% (3/5)  |
| 0.58      | 100% (6/6)    | 40% (2/5)  |
| 0.60      | 100% (6/6)    | 20% (1/5)  |
| 0.62–0.66 | 100% (6/6)    | 0% (0/5)   |
| 0.68–0.70 | 83% (5/6)     | 0% (0/5)   |
| 0.72      | 67% (4/6)     | 0% (0/5)   |
| 0.74      | **33% (2/6)** | 0% (0/5)   |
| 0.76–0.78 | 33% (2/6)     | 0% (0/5)   |
| 0.80      | 17% (1/6)     | 0% (0/5)   |

> **与验收方复算表差异：** 验收方写 0.74 → 50% (3/6)；本机 `calibrateSemanticNoteThreshold()` 实测 **33% (2/6)**（边界余弦 `queryCosine=0.74` 的 e01 在 `sim >= 0.74` 比较下因浮点略低于阈值被判未救援）。选定点 **0.66 不受影响**（救援 100%、误报 0%）。

### ±0.05 两点

| 阈值 | 误报率 F     | 救援率 R   |
| ---- | ------------ | ---------- |
| 0.61 | **0%** (0/5) | 100% (6/6) |
| 0.71 | **0%** (0/5) | 67% (4/6)  |

与验收方复算一致（两处误报均为 0）。

## 4. 硬线

| 硬线                                            | 结果                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| 误报率 ≤2%（选定阈值）                          | **通过**（0%）                                                                       |
| 字面集零回归（must 127 + 语义 ON 下 D-N1–D-N6） | **通过**（F2：6 组无翻转；非命题 must 不经 note-match）                              |
| 首 token / 查询向量增量                         | **OFF 路径通过**；**ON 路径见 §5 F1 代理指标**                                       |
| 引用完整率 100% / 孤儿率 0                      | **沿用 Phase 4 实测**（引用门未改动；推理：语义匹配只增向量谓词，不改引用/孤儿过滤） |
| 语义 sole 占比                                  | 合成意译救援 **6/6** 均为语义独占命中（单源池 → 若进 Top1 则均为 sole）              |

## 5. F1–F4 修补

### F1 · 语义 ON 延迟（代理指标）

- 测试：`extension/src/core/dreaming/semantic-note-eval.test.ts`（`F1：语义 ON vs 字面-only…`）
- **首 token 延迟未直接测**（Side Panel 不在 vitest harness）；代理 = `findNoteMatchesForQuery` 端到端 + `candidateLoadMs`（`loadEmbeddings` 内 `Float32Array.from` 模拟独立 store 行重）。
- 局限：无 UI / 无线索理解层 / 无 Hybrid 融合墙钟。

| 路径                      | 中位数 (ms) | p95 (ms)  | candidateLoadMs 中位数 (ms) |
| ------------------------- | ----------- | --------- | --------------------------- |
| 字面-only（semantic OFF） | **0.015**   | **0.262** | **0**                       |
| 语义 ON                   | **0.041**   | **0.704** | **0.009**                   |

ON 相对 OFF 有可测劣化（向量加载 + 余弦），量级仍远低于 50ms 硬线噪声带；**未改阈值/实现凑数**。

### F2 · 语义开启字面零回归

- 测试：同文件 `F2：语义开启下 D-N1–D-N6…`
- 机制：**显式传 `semanticEnabled: true`** 进 `findNoteMatchesForQuery`（字面优先仍为 `matchKind: 'literal'`），再经 `recallByKeywordWithParsedClue` 对比 Top1/outcome。
- 结果：**D-N1–D-N6 共 6 组全部通过，无翻转**。其余 must 不经命题路径，语义 ON 无翻转面。

### F3 · 回填生产调度

- 选型 **(a)** `dreaming-alarm.ts` 的 `handleDreamingAlarmTick`：编译之后、孤儿扫之前调 `backfillPropositionEmbeddingsTick`。
- 理由：回填是日桶 pacing 任务，应挂每日 alarm；与编译 tick 解耦，避免编译路径耦合 embed 配额；fail-open try/catch 不阻断孤儿扫。
- 接线：`extension/src/background/listeners/dreaming-alarm.ts`
- 测试：`dreaming-alarm.test.ts` · `onAlarm tick 在编译后调用命题向量回填一次`

### F4 · 接线级评分

- 测试：`extension/src/core/recall/note-match-semantic.test.ts` · `接线级：filterMemoryItemsByKeyword…`
- 断言：语义 provenance → `score === 12 × similarity` 且 ≤12；**spy `logger.warn`** 未被调用（真实 fallback 用 `logger.warn`，非 `console.warn`）。

### (f) 对抗文本纯度

- 修订 f02 / f03 / f05 正确命题（去掉 `battery` / `ticket(s)` / `winter`）；f05 错误命题去掉 `sky`。
- **余弦常量未改**；标定重跑仍选定 **0.66**（成立）。

## 6. 门禁（收口实测）

见会话汇报格式块；`test:run` = Step 0 基线 + 新增 it；两开关 OFF；未 commit / push。
