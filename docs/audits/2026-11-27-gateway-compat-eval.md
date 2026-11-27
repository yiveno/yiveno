---
title: 2026-11-27 CF Gateway compat 候选模型 Stage 1 解析评测
created: 2026-11-27 14:44 +0800
updated: 2026-11-27 14:44 +0800
author: agent:cursor
scope: 只评测；经 CF Gateway compat 对照 deepseek-flash 与 gemini-3.5-flash-lite；不切换生产、不改产品代码与生产配置
status: complete
upstream:
  - extension/tests/eval/clue-chain/
  - worker/src/services/ai/gateway-compat-ai-chat-provider.ts
  - HEAD 6465e312
downstream:
  - 生产模型切换讨论（本轮候选未过 JSON 失败率门槛，不建议进入切换）
---

# 2026-11-27 CF Gateway compat 候选模型 Stage 1 解析评测

## 1. Step 0 基线

| 项                  | 实测                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| HEAD                | `6465e312` feat(worker): add gateway-compat provider; production default unchanged                                    |
| git status（开工）  | 干净；与 `origin/main` 一致                                                                                           |
| worker 门禁         | **404 pass / 0 fail**（69 files）                                                                                     |
| Stage 1 harness     | `clue-chain:parse` 同源评分；本批用 eval-only CLI `extension/scripts/clue-chain-gateway-compat-eval.*` 打 compat 端点 |
| 用例                | 70（`clue20_expected` + `clue50_phase1_fixed`）                                                                       |
| 固定时钟            | `nowMs=1784980800000`（`2026-07-25T12:00:00.000Z`）                                                                   |
| temperature         | 显式 **0**                                                                                                            |
| 缓存隔离            | `cf-aig-skip-cache: true` + 开跑 `clearLlmParseCache()`                                                               |
| `DEEPSEEK_API_KEY`  | present（`.env.shared.local`）                                                                                        |
| `GOOGLE_AI_API_KEY` | present（`.env.shared.local`）                                                                                        |
| `OPENAI_API_KEY`    | 本轮不要求                                                                                                            |

请求体分档（沿用 openai-compatible / gateway-compat profile 等价实现）：

- deepseek：`max_tokens` + `thinking: disabled`
- google：`max_tokens`，不发思考字段（bodyCompat=`dashscope`）

Gemini 限速：≤ **12 RPM**；429 退避最多再试 **2** 次（本轮 **0** 次 429）。

## 2. 两组指标

| 指标                            | 对照 deepseek/deepseek-flash | 候选 google-ai-studio/gemini-3.5-flash-lite |
| ------------------------------- | ---------------------------: | ------------------------------------------: |
| core                            |                    **70/70** |                                   **69/70** |
| intent                          |                        70/70 |                                       70/70 |
| topic                           |                        62/62 |                                       61/62 |
| time                            |                        62/62 |                                       62/62 |
| type                            |                        62/62 |                                       62/62 |
| entities                        |                        62/62 |                                       61/62 |
| JSON 解析失败数                 |          2（rules_fallback） |                         3（rules_fallback） |
| JSON 失败率                     |                        2.86% |                                   **4.29%** |
| 延迟 p50 / p95（ms，HTTP 墙钟） |              1442 / **2119** |                             1368 / **2010** |
| prompt / completion tokens      |               166415 / 11585 |                              176003 / 18488 |
| HTTP 调用数                     |                          137 |                                         139 |
| retries429                      |                            0 |                                           0 |

### 产物路径

- 对照：`extension/tests/eval/clue-chain/runs/run-compat-control-deepseek-flash_2026-11-27_06-17-59_6465e312.json`
- 候选：`extension/tests/eval/clue-chain/runs/run-compat-candidate-gemini-3.5-flash-lite_2026-11-27_06-43-43_6465e312.json`
- 指针：`latest-compat-deepseek.json` / `latest-compat-gemini.json`

## 3. 失败聚类（候选）

| 聚类                                                     | 条数 | ids  | 失败字段 |
| -------------------------------------------------------- | ---: | ---- | -------- |
| A · 语义召回——记得观点含义，关键结论词缺失（看什么来着） |    1 | `02` | topic    |

说明：`02` 仍走 `source=llm`；topic judge 判实际词面过泛（仅 ai/agent），未落到「评判标准」观点。entities 同条连带未过。

rules_fallback（计入 JSON 解析失败口径：LLM 结构化失败后降级规则）：

- 候选：`09` / `13` / `17`
- 对照：`04` / `A17`（对照自身亦有 fallback，但门槛只约束候选）

## 4. Token 与费用

单价（美元 / 1M tokens · prompt / completion）：

| 模型                  | 单价                                      |                     本轮费用 |
| --------------------- | ----------------------------------------- | ---------------------------: |
| deepseek-flash        | 0.15 / 0.60                               |                  **$0.0319** |
| gemini-3.5-flash-lite | 免费层本轮记 **$0**；付费参照 0.30 / 2.50 | 付费切换成本参照 **$0.0990** |

合计实际费用（免费层）：**≈ $0.032**（远低于 $5 预算）。

## 5. 门槛判读（预注册，未事后改）

| 门槛        | 要求                       | 候选实测      | 结果     |
| ----------- | -------------------------- | ------------- | -------- |
| core        | ≥ 对照 − 1（≥69）          | 69            | 过       |
| intent      | 全对                       | 70/70         | 过       |
| JSON 失败率 | ≤ 1%                       | 4.29%（3/70） | **不过** |
| p95 延迟    | ≤ 对照 × 1.5（≤3178.5 ms） | 2010          | 过       |

**结论：候选 `google-ai-studio/gemini-3.5-flash-lite` 本轮不过。**  
主因：JSON/结构化解析失败率高于 1%（3 条 rules_fallback）。不调 prompt、不重跑凑分；**不进入生产切换讨论**。

## 6. 备注

- 首轮 Gemini 全量在 judge 尾段触发 12s 产品 fetch 预算超时、未落盘；eval CLI 已改为 60s fetch 超时 + judge try/catch + checkpoint 后续跑，**重跑一整轮**后取本报告数字。
- 生产默认仍为 deepseek 原生 provider；本批仅评测 compat 路径。
