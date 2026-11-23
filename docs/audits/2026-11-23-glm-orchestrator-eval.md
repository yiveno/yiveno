---
title: 2026-11-23 GLM-5.3 Flash + Perplexity Orchestrator 解析对照（Stage 1 硬停）
created: 2026-11-23 15:00 +0800
updated: 2026-11-23 15:00 +0800
author: agent:cursor
scope: 离线只读；Orchestrator 连通性 +（未跑）P2 式 GLM 单腿；对照 P1-deepseek；不改产品/Worker 行为；不推进生产切换
status: stopped
upstream:
  - docs/audits/2026-11-19-recall-prototype-minimal.md
  - docs/audits/2026-11-18-recall-ablation-audit.md
downstream:
  - 账号开通 Orchestrator paid credits 后另批续跑 Stage 1–2
---

# 2026-11-23 GLM-5.3 Flash + Perplexity Orchestrator 解析对照

## 1. Step 0 定锚

| 项                 | 实测                                                           |
| ------------------ | -------------------------------------------------------------- |
| HEAD               | `416e009a` fix(getting-started): 开壳失败显示可重试可见文案    |
| git status         | 本批允许改动 4 行级：compat + 原型脚本 + 新 .mjs（无 G4 残留） |
| test:must          | 127                                                            |
| test:run           | 1920 → **1922**（compat +2）                                   |
| i18n               | 902                                                            |
| worker             | 308                                                            |
| website            | 70                                                             |
| PERPLEXITY_API_KEY | present（`.env.shared.local`）                                 |
| DEEPSEEK_API_KEY   | present                                                        |

### P1-deepseek 对照基线（11-19 JSON 实读）

- 意图：live **37/38** / pressure **24/24** / noise **27/116**（误入 84）
- IR：R@1 **0.8182** / MRR **0.9091** / nDCG@5 **0.9329**
- 延迟总中位 **796** ms（parse 759 / embed 1177 / rerank 1175）
- tokens parse **92773/3194**；rerank **14775/2514**；LLM **222**

### 管线全开基线（11-18 消融 JSON 实读）

- live **38/38** / pressure **23/24** / noise **116/116**
- IR **0.8182 / 0.8788 / 0.9091**；LLM **62**；中位延迟 **1513.5** ms

## 2. Stage 1 · Orchestrator 连通性

- 目录接口：`GET https://api.perplexity.ai/orchestrator/v1/models`
- HTTP **403**
- 错误体（全文）：

```json
{
  "error": {
    "message": "The Orchestrator API requires paid credits. Sign-up credits and Perplexity Pro or Max subscriptions do not count. Add credits at https://console.perplexity.ai to unlock it.",
    "type": "restricted_api_key",
    "code": 403
  }
}
```

- GLM 条目与价格：**未读到**（403）
- DeepSeek Pro 条目：**未读到**（403）
- deepseek-v4-flash 是否在列：**未知**（403）
- 试调：**未执行**（§4.2：目录非 200 则停下，不绕过）
- 已知缺口：provider failover 无法直接测试——无法主动让某个厂商部署失败；本批只验证网关路径通，不验证 failover 行为。

**停下条件触发：** 提示词 §4.2 — 目录 402/403/404 或其他错误 → 记下状态码与错误体，停下汇报。

## 3. Stage 2 · 对照表（P2 同列）

| 模型                            | 意图分类（live / pressure / noise） | IR（R@1 / MRR / nDCG@5） | 延迟中位 | tokens                              | 成本估算 | 结论                       |
| ------------------------------- | ----------------------------------- | ------------------------ | -------: | ----------------------------------- | -------: | -------------------------- |
| P1 deepseek-v4-flash（对照）    | 37/38 / 24/24 / 27/116              | 0.8182 / 0.9091 / 0.9329 |      796 | parse 92773/3194；rerank 14775/2514 |     未估 | P1 基线                    |
| P2 GLM-5.3 Flash (Orchestrator) | —                                   | —                        |        — | —                                   |        — | **无结论**（Stage 1 硬停） |

**判定：** 无结论（目录 403 / restricted_api_key；账号需 Orchestrator paid credits，Sign-up / Pro / Max 不计）。

## 4. Stage 3 · Worker 接入就绪分析（只读）

- **新 provider 实现**：需新增 `worker/src/services/ai/perplexity-ai-chat-provider.ts` 实现 `AiChatProvider`（`isConfigured` / `complete`）；env key=`PERPLEXITY_API_KEY`；请求体仅 `model` / `messages` / `temperature` / `max_tokens`，**不可**照搬 DeepSeek 的 `thinking` 字段。
- **resolveAiChatProvider**：`worker/src/services/ai/ai-chat-provider.ts` 的 switch 增 `case 'perplexity'`；保留 default 对未知值抛 `ai_provider_unsupported`。
- **模型 ID 流向**：`resolveHostedModelForTask` 在 `worker/src/config/ai-task-kind.ts`：经 `AI_HOSTED_MODEL` / `AI_HOSTED_MODEL_NLU` 等注入 `request.model`；生产切换需改默认或新 per-task 变量写入 `perplexity/glm-5.3-flash`。
- **AI Gateway**：DeepSeek 适配器默认经 Cloudflare AI Gateway（`resolveDeepSeekChatCompletionsUrl`）；Orchestrator 独立 base URL，**不宜**沿用 deepseek Gateway 路径；直连 `https://api.perplexity.ai/orchestrator/v1` 或另配 Gateway `provider=perplexity-ai`。
- **预估改动规模**：约 2–4 个新/改文件（provider + resolve 分支 + env 类型 + 单测），测试增量约 5–15；本 Stage 只读估算，未动手。

## 5. 映射缺口清单

- provider failover 无法直接测试
- 2000 行规模测试未做
- Topic span 精确度无 gold
- ≥28 字无空格中文 mash 无专用 gold
- 目录动态：本批因 403 未读到实读价格

## 6. 偏差清单

- Stage 1 目录 403 → 按 §4.2 硬停；未跑试调、未跑 Stage 2 GLM eval
- 执行方式：在现有原型脚本内扩展 `glm-5.3-flash` 腿 + 导出 `runGlmOrchestratorEval`；另加入口 `recall-glm-orchestrator-eval.mjs`
- eval 客户端已加 `perplexity` compat；`test:run` 1920→1922（+2）
- 账号开通 paid credits 后可用同一入口续跑，无需再改口径

## 7. 总结论

**无结论：** Orchestrator 目录返回 403（需付费 credits，Pro/Max/注册赠送不计）；网关未通到可用态；GLM 质量对照未跑；**不推进生产切换**。下一步：在 [console.perplexity.ai](https://console.perplexity.ai) 为该 key 加 Orchestrator credits 后，用 `cd extension && bun run scripts/recall-glm-orchestrator-eval.mjs` 续跑 Stage 1–2。

逐行 JSON：`docs/audits/2026-11-23-glm-orchestrator-eval.json`（本批 `rows` 为空，因 Stage 2 未跑）。
