---
title: 2026-11-17 Decider Flash Gate A 对照评测
created: 2026-11-17 16:18 +0800
updated: 2026-11-17 16:18 +0800
author: agent:cursor
scope: Gate A+ 意图分类对照（Decider Flash vs deepseek-v4-flash）；topic 仅 present/absent 探针；不改产品代码
status: complete
upstream:
  - HEAD d0bd4ebc
  - extension/src/core/recall/eval/intent-eval-cases.ts（INTENT_EVAL_MUST · 38）
  - extension/src/core/recall/eval/arbitrary-input-pressure-cases.ts（p21–p24 附录）
  - extension/src/core/recall/eval/recall-topic.test.ts（topic 探针 20）
downstream:
  - 仅决策记录；不直接改产品模型路由
---

# 2026-11-17 Decider Flash Gate A 对照评测

## 1. 判定结论

**不换**

主集分类 Decider 36/38 < deepseek 38/38。决策模型不适合直接替换 Gate A 分类/抽取层；留作记录。

## 2. 补定锚（Step 0）

| 项                                 | 实测                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| HEAD                               | `d0bd4ebc`                                                                        |
| 工作区                             | 干净（评测开始时）                                                                |
| `OPENROUTER_API_KEY`               | 已从 `.env.shared.local` 加载（值不写入本报告）                                   |
| 分类主集                           | `INTENT_EVAL_MUST` **38**（chitchat 18 / recall 12 / question 4 / instruction 4） |
| 弱点附录                           | pressure **p21–p24**（期望均为 recall；对照假设，非断言）                         |
| 原 `PARSE_GOLD_CASES` / 11-05 快照 | **不作基线**（槽位集，非意图四类）                                                |
| 基线模型                           | **`deepseek-v4-flash`**（经 `understandRecallClue`，对齐 `nlu:try`）              |
| Decider 模型                       | `perplexity/pplx-decider-flash-v1.3:free`                                         |
| R5 fallback                        | **不入** choice 选项；触发时在逐 case note 单列                                   |
| ≥28 字无空格中文 mash              | **本次不测**（仓库无专用 gold）                                                   |
| Topic span 精确度                  | **映射缺口 / 无结论**（无 gold span 表）                                          |

## 3. 分类记分（两项分开）

### 3.1 主集 INTENT_EVAL_MUST（38）

| 模型              | 准确率    |
| ----------------- | --------- |
| deepseek-v4-flash | **38/38** |
| Decider Flash     | **36/38** |

| id  | expected    | deepseek    | decider     | ds_ms | dec_ms | note |
| --- | ----------- | ----------- | ----------- | ----: | -----: | ---- |
| c01 | chitchat    | chitchat    | chitchat    |  1779 |   1887 | —    |
| c02 | chitchat    | chitchat    | chitchat    |  1802 |   1895 | —    |
| c03 | chitchat    | chitchat    | chitchat    |  1804 |    482 | —    |
| c04 | chitchat    | chitchat    | chitchat    |  2106 |    445 | —    |
| c05 | chitchat    | chitchat    | chitchat    |  1644 |    452 | —    |
| c06 | chitchat    | chitchat    | chitchat    |  1607 |    485 | —    |
| c07 | chitchat    | chitchat    | chitchat    |  1923 |    444 | —    |
| c08 | chitchat    | chitchat    | chitchat    |  2466 |    389 | —    |
| c09 | chitchat    | chitchat    | chitchat    |  1906 |    425 | —    |
| c10 | chitchat    | chitchat    | chitchat    |  1681 |    517 | —    |
| r01 | recall      | recall      | recall      |  1024 |    406 | —    |
| r02 | recall      | recall      | recall      |   914 |    408 | —    |
| r03 | recall      | recall      | recall      |   815 |    436 | —    |
| r04 | recall      | recall      | chitchat✗   |   942 |    439 | —    |
| r05 | recall      | recall      | recall      |   837 |    432 | —    |
| r06 | recall      | recall      | recall      |  1006 |    393 | —    |
| r07 | recall      | recall      | recall      |   917 |    477 | —    |
| r08 | recall      | recall      | recall      |  1145 |    404 | —    |
| r09 | recall      | recall      | chitchat✗   |   573 |    395 | —    |
| r10 | recall      | recall      | recall      |   940 |    407 | —    |
| c11 | chitchat    | chitchat    | chitchat    |  1895 |    433 | —    |
| c12 | chitchat    | chitchat    | chitchat    |  1906 |    408 | —    |
| c13 | chitchat    | chitchat    | chitchat    |  1777 |    402 | —    |
| c14 | chitchat    | chitchat    | chitchat    |  1965 |    413 | —    |
| c15 | chitchat    | chitchat    | chitchat    |  2093 |    454 | —    |
| c16 | chitchat    | chitchat    | chitchat    |  2067 |    492 | —    |
| c17 | chitchat    | chitchat    | chitchat    |  1659 |    509 | —    |
| c18 | chitchat    | chitchat    | chitchat    |  1970 |    487 | —    |
| r11 | recall      | recall      | recall      |   718 |    408 | —    |
| r12 | recall      | recall      | recall      |   797 |    388 | —    |
| q01 | question    | question    | question    |  1644 |    459 | —    |
| q02 | question    | question    | question    |  1420 |    379 | —    |
| q03 | question    | question    | question    |  1733 |    502 | —    |
| q04 | question    | question    | question    |  2166 |    637 | —    |
| i01 | instruction | instruction | instruction |  2021 |    475 | —    |
| i02 | instruction | instruction | instruction |  1489 |    505 | —    |
| i03 | instruction | instruction | instruction |  1961 |    418 | —    |
| i04 | instruction | instruction | instruction |  1396 |    424 | —    |

### 3.2 附录 pressure p21–p24（不并入主数字）

| 模型              | 对照命中（期望 recall） |
| ----------------- | ----------------------- |
| deepseek-v4-flash | **3/4**                 |
| Decider Flash     | **4/4**                 |

说明：pressure 头注释写明 `expectedIntent` 是对照假设、不是断言。

| id  | expected | deepseek  | decider | ds_ms | dec_ms | note |
| --- | -------- | --------- | ------- | ----: | -----: | ---- |
| p21 | recall   | recall    | recall  |   597 |    412 | —    |
| p22 | recall   | chitchat✗ | recall  |  1745 |    419 | —    |
| p23 | recall   | recall    | recall  |   664 |    413 | —    |
| p24 | recall   | recall    | recall  |   898 |    382 | —    |

## 4. Topic 有无探针（proxy · 非 span 精确度）

| 组                                                 | 正确（present/absent 对齐期望） |
| -------------------------------------------------- | ------------------------------- |
| 泛指 absent（10）                                  | **10/10**                       |
| 真实主题 present（10）                             | **2/10**                        |
| 泛指组 hallucination（expected absent 但 present） | **0**                           |

| clue                          | expected | observed | extracted | halluc |  ms | note  |
| ----------------------------- | -------- | -------- | --------- | ------ | --: | ----- |
| 帮我找那玩意儿                | absent   | absent   | —         | no     | 430 | empty |
| that thingy                   | absent   | absent   | —         | no     | 951 | empty |
| 那啥                          | absent   | absent   | —         | no     | 505 | empty |
| 这玩意儿                      | absent   | absent   | —         | no     | 439 | empty |
| 那事儿                        | absent   | absent   | —         | no     | 459 | empty |
| 这啥                          | absent   | absent   | —         | no     | 516 | empty |
| 那玩意                        | absent   | absent   | —         | no     | 422 | empty |
| 昨天那个东西                  | absent   | absent   | —         | no     | 777 | empty |
| that thing from yesterday     | absent   | absent   | —         | no     | 420 | empty |
| that thing                    | absent   | absent   | —         | no     | 441 | empty |
| 昨天的诗                      | present  | absent   | —         | no     | 521 | empty |
| yesterday poem                | present  | absent   | —         | no     | 493 | empty |
| 李白                          | present  | present  | 李白      | no     | 430 | —     |
| 昨天那首关于李白的诗          | present  | absent   | —         | no     | 479 | empty |
| the article I read last week  | present  | absent   | —         | no     | 479 | empty |
| my password for github        | present  | present  | github    | no     | 506 | —     |
| 昨天看到的那篇文章            | present  | absent   | —         | no     | 452 | empty |
| 那首关于秋天的诗              | present  | absent   | —         | no     | 436 | empty |
| 昨天那个视频                  | present  | absent   | —         | no     | 561 | empty |
| that song I kept listening to | present  | absent   | —         | no     | 444 | empty |

## 5. 映射缺口清单

- Topic span 精确度：仓库无 clue→gold topic span 表 → 整项映射缺口 / 无结论（仅做 present/absent proxy）
- R5 规则降级 fallback：不是意图类，未写入 choice 选项；若基线走 rules/lexical 在 note 单列
- ≥28 字无空格中文 keyboard_mash 边界：无专用 gold → 本次不测
- Gate A reject_noise（硬噪音）：非意图四类；若基线命中记为 unknown 并注 rejectReason

## 6. 延迟与成本

| 指标                                         | 值              |
| -------------------------------------------- | --------------- |
| deepseek 分类延迟中位数                      | 1651.5 ms       |
| Decider choice 延迟中位数                    | 432.5 ms        |
| Decider locate 延迟中位数                    | 469 ms          |
| Decider 合计 input_tokens（分类+探针）       | 12894           |
| 窗口后成本估算（$0.01 / 1M input，输出免费） | ≈ **$0.000129** |

限速记录：本次未观察到需记录的限速事件（429 已自动退避若发生）

## 7. 未核实 / 已知缺口

- Topic **span 精确度**无法记分（无 gold span）→ 整项映射缺口
- ≥28 字无空格中文 keyboard_mash 边界本次不测
- 免费端点限速：仅在运行中观察；未做压测画像
- `fast=True`：仅本地 HF runtime；OpenRouter **N/A**（沿用 Step 0）
