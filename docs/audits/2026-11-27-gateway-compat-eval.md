---
title: 2026-11-27 CF Gateway compat 候选模型 Stage 1 解析评测
created: 2026-11-27 14:44 +0800
updated: 2026-11-27 16:25 +0800
author: agent:cursor
scope: 只评测；经 CF Gateway compat 对照 deepseek-flash，候选 gemini-3.5-flash-lite 与 groq gpt-oss-120b；不切换生产、不改产品代码与生产配置
status: complete
upstream:
  - extension/tests/eval/clue-chain/
  - extension/scripts/clue-chain-gateway-compat-eval.ts
  - worker/src/services/ai/gateway-compat-ai-chat-provider.ts
  - HEAD af697093（产品码同 6465e312；中间仅 docs/eval CLI/runs）
downstream:
  - 生产模型切换讨论（两候选均未过门槛，不建议进入切换）
---

# 2026-11-27 CF Gateway compat 候选模型 Stage 1 解析评测

## 1. Step 0 基线

### 1.1 双组阶段（deepseek + gemini）

| 项                  | 实测                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| HEAD                | `6465e312` feat(worker): add gateway-compat provider; production default unchanged                             |
| git status（开工）  | 干净；与 `origin/main` 一致                                                                                    |
| worker 门禁         | **404 pass / 0 fail**（69 files）                                                                              |
| Stage 1 harness     | `clue-chain:parse` 同源评分；eval-only CLI `extension/scripts/clue-chain-gateway-compat-eval.*` 打 compat 端点 |
| 用例                | 70（`clue20_expected` + `clue50_phase1_fixed`）                                                                |
| 固定时钟            | `nowMs=1784980800000`（`2026-07-25T12:00:00.000Z`）                                                            |
| temperature         | 显式 **0**                                                                                                     |
| 缓存隔离            | `cf-aig-skip-cache: true` + 开跑 `clearLlmParseCache()`                                                        |
| `DEEPSEEK_API_KEY`  | present（`.env.shared.local`）                                                                                 |
| `GOOGLE_AI_API_KEY` | present（`.env.shared.local`）                                                                                 |

### 1.2 Groq 续跑阶段（本批）

| 项                 | 实测                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| HEAD               | `af697093` docs(eval): gateway compat 双模型 stage 1 评测报告                           |
| `6465e312..HEAD`   | 仅 `.gitignore` / 本报告 / eval CLI / runs 产物；**无产品码改动**                       |
| git status（开工） | 干净；与 `origin/main` 一致                                                             |
| worker 门禁        | **404 pass / 0 fail**（69 files）                                                       |
| `GROQ_API_KEY`     | present（`.env.shared.local` + 登记 `scripts/dev-env.mjs` 后同步进 `worker/.dev.vars`） |
| 只跑               | `--arm=groq`；**不**重跑 DeepSeek / Gemini                                              |

请求体分档：

- deepseek：`max_tokens` + `thinking: disabled`（maxTokens **400**）
- google：`max_tokens`，不发思考字段（bodyCompat=`dashscope`；maxTokens **400**）
- groq GPT-OSS（[官方 Reasoning 文档](https://console.groq.com/docs/reasoning) · 2026-11-27 核实）：`max_completion_tokens` + `reasoning_effort: low`（官方最小；**无** `none`）+ `include_reasoning: false`；maxTokens 抬到 **1024**（低 reasoning 会吃 completion 预算，400 易截断 JSON；与既有两组差异已记）

限速：

- Gemini：≤ **12 RPM**；429 退避最多再试 **2** 次（双组阶段 **0** 次 429）
- Groq：免费层 TPM **8K** / TPD **200K**（[Rate Limits](https://console.groq.com/docs/rate-limits)）；分钟预算 **7K** + **≤2 RPM**；429 退避最多再试 **2** 次并记响应头剩余量/重置（本轮 **0** 次 429）

## 2. 三组指标

| 指标                            | 对照 deepseek/deepseek-flash | 候选 A google-ai-studio/gemini-3.5-flash-lite | 候选 B groq/openai/gpt-oss-120b |
| ------------------------------- | ---------------------------: | --------------------------------------------: | ------------------------------: |
| core                            |                    **70/70** |                                     **69/70** |                       **68/70** |
| intent                          |                        70/70 |                                         70/70 |                       **68/70** |
| topic                           |                        62/62 |                                         61/62 |                           60/62 |
| time                            |                        62/62 |                                         62/62 |                           62/62 |
| type                            |                        62/62 |                                         62/62 |                           62/62 |
| entities                        |                        62/62 |                                         61/62 |                           59/62 |
| JSON 解析失败数                 |          2（rules_fallback） |                           3（rules_fallback） |             2（rules_fallback） |
| JSON 失败率                     |                        2.86% |                                     **4.29%** |                       **2.86%** |
| 延迟 p50 / p95（ms，HTTP 墙钟） |              1442 / **2119** |                               1368 / **2010** |                 1024 / **2609** |
| prompt / completion tokens      |               166415 / 11585 |                                176003 / 18488 |                  197023 / 31100 |
| HTTP 调用数                     |                          137 |                                           139 |                             150 |
| retries429                      |                            0 |                                             0 |                               0 |

### 产物路径

- 对照：`extension/tests/eval/clue-chain/runs/run-compat-control-deepseek-flash_2026-11-27_06-17-59_6465e312.json`
- 候选 A：`extension/tests/eval/clue-chain/runs/run-compat-candidate-gemini-3.5-flash-lite_2026-11-27_06-43-43_6465e312.json`
- 候选 B：`extension/tests/eval/clue-chain/runs/run-compat-candidate-groq-gpt-oss-120b_2026-11-27_08-25-16_af697093.json`
- 指针：`latest-compat-deepseek.json` / `latest-compat-gemini.json` / `latest-compat-groq.json`

## 3. 失败聚类

### 3.1 候选 A · gemini-3.5-flash-lite

| 聚类                                                     | 条数 | ids  | 失败字段 |
| -------------------------------------------------------- | ---: | ---- | -------- |
| A · 语义召回——记得观点含义，关键结论词缺失（看什么来着） |    1 | `02` | topic    |

rules_fallback：`09` / `13` / `17`（对照自身：`04` / `A17`；门槛只约束候选）。

### 3.2 候选 B · groq/openai/gpt-oss-120b

| 聚类                                                               | 条数 | ids   | 失败字段     |
| ------------------------------------------------------------------ | ---: | ----- | ------------ |
| A · 认知知识检索——描述不精确，关键机制词缺失；intent 误判 question |    1 | `13`  | intent+topic |
| A · 利用用户不精确的因果记忆解析主题；intent 误判 question         |    1 | `A13` | intent+topic |

rules_fallback（JSON 失败口径）：`09` / `10`。

entities 未过但未拖垮 core（core 已因 intent/topic 失败）：`03`（缺「拼多多」）、`11`（缺「周杰伦」）、`D07`（缺「小米/美的」）。

## 4. Token 与费用

单价（美元 / 1M tokens · prompt / completion）：

| 模型                  | 单价                                                                                                                                                   |                     本轮费用 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------: |
| deepseek-flash        | 0.15 / 0.60                                                                                                                                            |                  **$0.0319** |
| gemini-3.5-flash-lite | 免费层本轮记 **$0**；付费参照 0.30 / 2.50                                                                                                              | 付费切换成本参照 **$0.0990** |
| gpt-oss-120b（Groq）  | 免费层本轮记 **$0**；付费参照 **0.15 / 0.60**（来源：[Groq 模型页](https://console.groq.com/docs/model/openai/gpt-oss-120b)，核实日期 **2026-11-27**） | 付费切换成本参照 **$0.0482** |

合计实际费用（免费层三组）：deepseek 对照 **≈ $0.032**；两候选免费额度记 **$0**。

## 5. 门槛判读（预注册，未事后改）

门槛：core ≥ 对照−1（≥69）；intent 全对；JSON 失败率 ≤ 1%；p95 ≤ 对照×1.5（≤3178.5 ms）。

| 门槛        | 候选 A gemini | 结果 A   | 候选 B groq   | 结果 B   |
| ----------- | ------------- | -------- | ------------- | -------- |
| core ≥69    | 69            | 过       | 68            | **不过** |
| intent 全对 | 70/70         | 过       | 68/70         | **不过** |
| JSON ≤1%    | 4.29%（3/70） | **不过** | 2.86%（2/70） | **不过** |
| p95 ≤3178.5 | 2010          | 过       | 2609          | 过       |

**结论：**

- 候选 A `google-ai-studio/gemini-3.5-flash-lite`：**不过**（JSON 失败率）。
- 候选 B `groq/openai/gpt-oss-120b`：**不过**（core 68、intent 非全对、JSON 失败率）。主因：`13`/`A13` 把 recall 判成 question 且 topic 空；另 2 条 rules_fallback。

不调 prompt、不重跑凑分；**两候选均不进入生产切换讨论**。生产默认仍为 deepseek 原生 provider；本批仅评测 compat 路径。

## 6. 备注（Groq 跑程）

- eval CLI 增 `--arm=groq`；`GROQ_API_KEY` 仅键名登记进 `SHARED_OPTIONAL_KEYS` / `WORKER_KEYS`。
- 首轮 C 类在默认 60s 单条 understand 超时下被 2 RPM 排队误杀；抬 groq 默认 `CLUE_CHAIN_TIMEOUT_MS=300000`，从 checkpoint 去掉超时条后续跑（**非**为凑分改模型输出）。
- judge 尾段曾出现 DNS/证书瞬时失败（`ENOTFOUND` / `unknown certificate verification error`）；剥离异常 judge 后续跑 7 条，全部 match=true。记分以续跑后落盘为准。
- 本轮未触 TPD；`retries429=0`。
