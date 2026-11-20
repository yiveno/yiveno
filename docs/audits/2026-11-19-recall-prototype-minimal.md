---
title: 2026-11-19 Recall 最小 LLM 原生原型（P1）+ 解析模型对照（P2）
created: 2026-11-19 19:03 +0800
updated: 2026-11-19 19:21 +0800
author: agent:cursor
scope: 离线只读实验；P1 一次解析 + bge-m3 Top50 + 一次 LLM 重排；P2 只换解析模型；不改产品行为
status: complete
upstream:
  - docs/audits/2026-11-18-recall-ablation-audit.md
  - extension/scripts/recall-ablation-audit.ts
  - extension/src/core/recall/eval/retrieval-ablation-cases.ts
downstream:
  - 仅证据与判定；不重构管线；不推进模型接入
---

# 2026-11-19 Recall 最小 LLM 原生原型

## 1. Step 0 定锚

| 项                           | 实测                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| HEAD                         | `abd69822 chore(website): 根 wrangler 对齐 pages 控制台构建` |
| git status                   | 4 行未提交（本批新增脚本+报告）                              |
| test:must                    | 127 passed                                                   |
| test:run                     | 1789 passed                                                  |
| i18n:check                   | 817 keys                                                     |
| worker test                  | 211 pass                                                     |
| 消融基线 live/pressure/noise | 38/38 / 23/24 / 116/116                                      |
| 消融基线 IR R@1/MRR/nDCG@5   | 0.8182 / 0.8788 / 0.9091（hitDenom=11）                      |
| 消融基线 LLM 调用 / 中位延迟 | 62 / 1513.5 ms                                               |
| embed API / token            | https://api.yiveno.com / supabase_admin_mint                 |

## 2. P1 对照表

| 维度                        | 原型数字                                                                                              | 管线基线数字                                                            | 结论                                    | 备注                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 质量（live/pressure/noise） | 37/38 / 24/24 / 27/116（误入84）                                                                      | 38/38 / 23/24 / 116/116                                                 | 质量落后                                | 更差：live 38/38→37/38；noise 116/116→27/116；更好：pressure 23/24→24/24；MRR 0.8788→0.9091；nDCG@5 0.9091→0.9329 |
| 质量（IR）                  | 0.8182 / 0.9091 / 0.9329                                                                              | 0.8182 / 0.8788 / 0.9091                                                | （并入质量维；R@1 持平，MRR/nDCG 略升） | hitDenom=11；live 解析非固定 goldParsed                                                                           |
| 成本                        | LLM 222（parse 200+rerank 22）；每 query 均 1.1100；tokens parse 92773/3194 rerank 14775/2514；$ 未估 | 全集 LLM 62；每 query 均 0.3100（分母=understand 178+retrieval 22=200） | 成本更高                                | deepseek 官方 $/1M 未核实                                                                                         |
| 延迟                        | 总中位 796 ms（parse 759 / embed 1177 / rerank 1175）                                                 | 1513.5 ms                                                               | 延迟更低                                | 口径不完全同构：基线多为理解墙钟；P1 含 noise 短解析                                                              |
| 可解释性                    | 见 §4                                                                                                 | —                                                                       | 可解释性：2/2 个 Top1 失败可定位到单步  | 2 个 Top1 失败均可定位到重排                                                                                      |

**总判：** 原型明显落后（现管线复杂度有证据支撑，维持）

## 3. P2 解析模型对照

| 模型                         | 意图分类（live / pressure / noise） | IR（R@1 / MRR / nDCG@5） | 延迟中位 | tokens                               |      成本估算 | 结论                                                                      |
| ---------------------------- | ----------------------------------- | ------------------------ | -------: | ------------------------------------ | ------------: | ------------------------------------------------------------------------- |
| P1 deepseek-v4-flash（对照） | 37/38 / 24/24 / 27/116              | 0.8182 / 0.9091 / 0.9329 |      796 | parse 92773/3194；rerank 14775/2514  |          未估 | P1 基线                                                                   |
| P2 GPT-6.2 Sol               | —                                   | —                        |        — | —                                    |             — | **无结论**（OpenRouter：not available in your region；无 OPENAI_API_KEY） |
| P2 Qwen4-Max                 | 36/38 / 22/24 / 27/116              | 0.7273 / 0.8182 / 0.8420 |     3495 | parse 93669/21344；rerank 13432/2304 | parse≈$0.2366 | **不换**                                                                  |
| hy4-flash                    | —                                   | —                        |        — | —                                    |             — | **无可用接入**（本机 .env*.local 无腾讯 / Hunyuan / Hy4 API key）         |

## 4. 可解释性（失败诊断链）

| caseId                         | 解析 intent/terms                       | Top50 含正解 | 重排 Top1                              | 理由                                                                                     | 可定位步骤 | 理由可信 |
| ------------------------------ | --------------------------------------- | ------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| ablate-nuclear-vs-weekly-noise | recall / [nuclear, detonation, film]    | True         | `33333333-3333-4333-8333-333333333302` | Directly about atomic bomb documentary notes, matching the clue.                         | rerank     | True     |
| ablate-fuzzy-trinity-test-film | recall / [trinity, test, film, writeup] | True         | `33333333-3333-4333-8333-333333333302` | This is a documentary note about the atomic bomb, likely covering the Trinity test film. | rerank     | True     |

判断：两例正解均在余弦 Top50 内，失败落在重排步；理由声称候选相关且与选错条目内容一致，**相对「为何不是 gold」可定位，理由对错误 Top1 自洽，不构成「理由不可信」（理由不可信仅用于正解在 Top50 外仍吹某条最相关的情况）。

理解失败行：live+pressure+noise 共 90；noise 主因无 Gate A（误入 recall 84/116）。

## 5. 映射缺口清单

- Topic span 精确度无 gold → 无结论
- ≥28 字无空格中文 mash 无专用 gold → 不测
- 2000 行规模 / ANN：本批未测（语义池仍暴力扫表）
- BRIDGE 对照组不在本批
- noise 路径：`extension/src/core/recall/eval/noise-gateway-cases.ts` + `build-synth-noise-gateway-cases.ts`；must 门 116；原型无 Gate A，期望 intent!=recall

## 6. 偏差清单

- P2 gpt-6.2-sol：无 OPENAI_API_KEY，改用 OPENROUTER_API_KEY + model `openai/gpt-6.2-sol`（OpenAI 兼容最小适配）
- 检索 IR 走原型 live 解析（非消融固定 goldParsed），以便四步管线端到端对照；与消融「跳过 live NLU」设计不同，已在 IR 解读时计入理解方差
- 重排/解析超时分别为 90000/30000ms（产品 CLUE_LLM_COMPLETE_TIMEOUT_MS=12000 对 50 候选过紧）
- P1 deepseek 官方 $/1M 本批未核实 → 成本维以 LLM 调用次数与 tokens 为主，$ 标未估
- P2 gpt-6.2-sol：OpenRouter 报 not available in your region → 判「无结论」（非质量不换）
- P2 qwen4-max：成本仅估解析层（提示词价）；重排 deepseek 价未核实
- 延迟对照：管线基线中位 1513.5ms 来自消融 understand 墙钟；P1 总中位含 noise 全量解析短调用，口径不完全同构，已在解读时注明
- Step 0 门禁数字来自本会话 Step 0 实测（test:must 127 / test:run 1789 / i18n 817 / worker 211），非脚本内重跑

## 7. 总结论

原型在 IR（R@1 持平、MRR/nDCG 略升）与部分 pressure 上不弱于管线，但 **noise 无 Gate A 崩盘（27/116）+ live 微降 + 每 query LLM 调用显著更高** → **明显落后，维持现管线**。P2：`qwen4-max` 意图与 IR 均低于 P1 → **不换**；`gpt-6.2-sol` 区域不可用 → **无结论**；`hy4-flash` → **无可用接入**。

## 附录 A · P1 解析 prompt 全文

```
You convert a user recall clue into a JSON object for a personal memory finder.
Output ONLY one JSON object. No markdown, no commentary.
Schema keys (ONLY these two):
- intent: recall|chitchat|question|instruction. recall = the user is trying to find something they saved, even vaguely (a time, a type, a topic, a feeling about something saved) — including questions ABOUT a saved item (e.g. "when did I save that article", "你是什么时候保存的那篇文章"). chitchat = the user is greeting, small-talking, commenting, OR asking who/what Yiveno is or what it can do (e.g. "good evening", "今天心情不错", "你是哪位", "你是干什么的"). question = the user asks a world/factual question with a direct answer, NOT about Yiveno identity/name/capability and NOT about finding a saved item (e.g. "how many days are in a leap year", "谁写了红楼梦", "what is the boiling point of water"). instruction = the user asks Yiveno to DO something, generate something, remind them, or delete something (e.g. "remind me to water the plants", "write a haiku", "delete my notes", "帮我翻译这段英文"). When unsure, choose recall — never block a possible recall attempt.
- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Drop fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words that only encode time/type/behavior/note without topic. These are POSITIVE want terms only. When intent is chitchat, question, or instruction, use [].
Rules:
- Zero-anchor assistant requests (e.g. "suggest something fun") → intent chitchat; contentTerms [].
- Do not invent memory ids or database operations. JSON proposal only.
- Do NOT emit timeLabel, objectTypes, behaviorHints, confidence, assistantReply, or any other keys.
```

promptVersion: prototype-minimal-v1

## 附录 B · 重排截断规则

- 候选 Top 50；每条 title≤120 字符、excerpt≤280 字符；重排输出 Top 5。
- 无余弦门（不用 0.28）；无池上限 24；无关键词 / RRF / 保护层。
- 解析超时 30000ms；重排超时 90000ms（脚本本地 fetch，非产品 12s）。

逐行 JSON：`/Users/cqw/Documents/github/yiveno/docs/audits/2026-11-19-recall-prototype-minimal.json`
