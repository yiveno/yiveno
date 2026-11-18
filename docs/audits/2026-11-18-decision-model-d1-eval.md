---
title: 2026-11-18 决策模型 D1 对照评测
created: 2026-11-18 21:45 +0800
updated: 2026-11-18 21:57 +0800
author: agent:cursor
scope: D1 决策模型对照（Liquid d1.2-ultra / Microsoft-Decision-1.1 / Decider v1.3）vs deepseek-v4-flash；只读；不改产品
status: complete
upstream:
  - HEAD daf526f4
  - extension/scripts/decider-flash-gate-a-eval.ts（INTENT_CHOICE_CRITERIA · 同打法）
  - docs/audits/2026-11-17-decider-flash-gate-a-eval.json（Decider 主集复用）
downstream:
  - docs/audits/2026-11-18-recall-ablation-audit.md（D1 章节引用）
---

# 2026-11-18 决策模型 D1 对照评测

**有模型达标：** liquid/d1.2-ultra。本批只给结论，不推进接入。

## 2. Step 0 核实

| 项             | 结论                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| Liquid 入口    | OpenRouter Decisions · `liquid/d1.2-ultra` · $0.042/1M input · 零输出               |
| Microsoft 入口 | OpenRouter Decisions · `microsoft/microsoft-decision-1.1` · $0.042/1M input         |
| Decider 入口   | `perplexity/pplx-decider-flash-v1.3:free` 与 11-17 同一模型 id → 主集分类复用 36/38 |
| 本机凭据       | `OPENROUTER_API_KEY` + DeepSeek key 均存在                                          |
| noul 形状      | 实测 `{ type:"noul", noul:<prob> }`；≥0.5 = present                                 |

## 3. 结果表

| 模型                                                | 主集 38 | noise 误判 recall | topic absent/present/halluc | 延迟中位 ms | input tokens |  成本估算 | 结论         |
| --------------------------------------------------- | ------- | ----------------- | --------------------------- | ----------: | -----------: | --------: | ------------ |
| deepseek-v4-flash                                   | 38/38   | 0/86 (0.0%)       | 0/10 / 0/10 / 0             |       995.5 |            0 | $0.000000 | **对照基线** |
| liquid/d1.2-ultra                                   | 38/38   | 2/86 (2.3%)       | 10/10 / 6/10 / 0            |         732 |        35331 | $0.001484 | **达标**     |
| microsoft/microsoft-decision-1.1                    | 37/38   | 4/86 (4.7%)       | 10/10 / 7/10 / 0            |         623 |        34860 | $0.001464 | **不换**     |
| perplexity/pplx-decider-flash-v1.3:free（分类复用） | 36/38   | 48/86 (55.8%)     | 10/10 / 2/10 / 0            |         455 |        31663 | $0.000317 | **不换**     |

## 4. 映射缺口 / 偏差

- Topic span 精确度：仓库无 clue→gold topic span 表 → 无结论（仅 present/absent proxy）
- Liquid / Microsoft 无 extractions locate → 用 noul has_concrete_topic 作 present/absent 代理
- ≥28 字无空格中文 mash：本次不测
- Decider 主集分类复用 2026-11-17（同模型 id perplexity/pplx-decider-flash-v1.3:free）；noise 与 topic 本批实测
- noise 误判 recall 分母 = must 集中 expect reject_noise 的条数（86），不是 116 全量

- 偏差：Decider 主集不重跑（提示词允许：同 API/版本复用 11-17）
- 偏差：Microsoft / Liquid 经 OpenRouter Decisions API（非 Foundry 直连）；定价取 OpenRouter/官方 Global Standard $0.042/1M input
- 偏差：Decider 官方价记 $0.01/1M input（与 11-17 同）；免费端点 :free 实际 input 可能记 0——成本按官方价估算
- 偏差：初跑 Liquid/Microsoft topic noul 解析误用 value:boolean；实测字段为 noul:<prob>；已补跑并回写

逐行 JSON：`/Users/cqw/Documents/github/yiveno/docs/audits/2026-11-18-decision-model-d1-eval.json`
