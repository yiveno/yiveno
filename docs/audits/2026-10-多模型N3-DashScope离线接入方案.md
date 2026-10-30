---
created: 2026-10-30T07:23:26+08:00
updated: 2026-10-30T08:14:00+08:00
author: agent:cursor
scope: qwen-flash 离线 parse-gold 接入 + 首轮评测
status: eval-complete-first-run
upstream:
  - docs/audits/2026-10-多模型N3国内第二厂商桌面选型.md（维护者确认首选 qwen-flash）
  - docs/audits/2026-10-多模型N3-OpenAI离线接入方案.md（评测暂停；openai compat 保留）
  - docs/audits/2026-10-多模型N1N2基线与N3对比准备.md
  - docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash.json
  - https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
  - https://help.aliyun.com/zh/model-studio/qwen-structured-output
  - https://help.aliyun.com/zh/model-studio/qwen-flash
downstream:
  - 可选：qwen-plus 对照；或 grounding 容忍 noteHint null（非本轮默认）
---

# N3 · DashScope `qwen-flash` 离线接入方案

> **维护者确认：** 国内对照首选 **`qwen-flash`**；接线 + **首轮评测已完成**（2026-10-30）。  
> **不变：** 生产 DeepSeek；Pro `INSUFFICIENT_EVIDENCE`；OpenAI 评测暂停；Prompt / Schema / L3=`NOT_RUN` 契约同 Flash 基线。

---

## 0. 结论摘要

| 项                  | 结论                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **目标 model**      | `qwen-flash`                                                                                                        |
| **接线**            | `compat=dashscope` + P1 path；Key 按 compat 优先 `DASHSCOPE_API_KEY`                                                |
| **首轮评测**        | L1 **35/42**；L2 llm must **25/35** · stretch **6/7**；snapshot 见下                                                |
| **相对 Flash 基线** | Flash verify（37 条旧集）must **27/29**；本轮用例已扩到 **42**，**不可直接比绝对数**；must 通过率约 **71% vs ~93%** |
| **主失败模式**      | `noteHint: null` 触发 Zod（6 must）；另有 timeLabel 非法值、exclude/contentTerms/confidence 槽位差                  |

---

## 0.1 首轮评测结果（FACT · 2026-10-30）

| 项                | 值                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Snapshot          | `docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash.json`                                 |
| cases             | **42**（must 35 + stretch 7；较 Flash verify 的 37 已扩面）                                   |
| L1 schema         | **35/42**（失败 7，均为 Zod）                                                                 |
| L2 llm            | must **25/35** · stretch **6/7**（lift: `stretch-manifest-v3-looked-at`）                     |
| L3                | `NOT_RUN`                                                                                     |
| latencyMs         | n=42 · p50 **695** · p95 **916** · max 980                                                    |
| tokens            | prompt **33838** · completion **2085** · total **35923**                                      |
| 粗算成本          | ≈ ¥**0.008**（按官方约 ¥0.15 / ¥1.5 每百万 token · 手算）                                     |
| Flash verify 对照 | model `deepseek-v4-flash` · L1 37/37 · llm must **27/29** · stretch **7/8**（**旧 37 条集**） |

**must 失败归因（10）：** schema×7（`noteHint` null×6 + `timeLabel` 非法×1）· slot×3（confidence / contentTerms / exclude）。

---

## 1. 现有能力（FACT）

| 能力      | 现状                                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| CLI       | `bun run parse-gold:llm`；Key 按 `COMPAT` 选厂商变量（`PARSE_GOLD_LLM_API_KEY` 可覆盖） |
| compat    | `deepseek` \| `openai` \| **`dashscope`**                                               |
| JSON 报告 | L1/L2、latency、usage、**L3=`NOT_RUN`**、指纹；`compat` 字段                            |
| 用例      | 当前 **42**（must 35 + stretch 7）；`PARSE_GOLD_NOW_MS`；`useCache: false`              |

---

## 2. 官方参数约束（FACT · 对照）

来源：[OpenAI 兼容-Chat](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)、[结构化输出](https://help.aliyun.com/zh/model-studio/qwen-structured-output)、[qwen-flash](https://help.aliyun.com/zh/model-studio/qwen-flash)。

| 官方                                         | 本任务建议                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `POST …/compatible-mode/v1/chat/completions` | base 指到 compatible-mode 根（见下）                                                                                       |
| `model=qwen-flash`                           | 固定此 id（初筛）                                                                                                          |
| `max_tokens`                                 | **400**（对齐现离线）                                                                                                      |
| `temperature`                                | **0**                                                                                                                      |
| 思考                                         | 用百炼语义关思考；**不**发 DeepSeek `thinking`；**不**发 OpenAI `reasoning_effort`                                         |
| `enable_thinking`                            | 文档示例经 extra_body；初筛可 **omit**（依赖默认非思考）或显式 `false` —— 实施时二选一写死并单测；**UNKNOWN** 默认是否已关 |
| `response_format`                            | 官方支持 `json_object` / `json_schema`；**初筛不接**（与 Flash 基线同 prompt+Zod，对照公平）                               |
| Key ↔ 地域                                   | 北京 Key 配北京端点；错区 → 401                                                                                            |

**目标请求体（实施后 · dashscope profile）：**

```json
{
  "model": "qwen-flash",
  "messages": ["…与现 Prompt 相同…"],
  "max_tokens": 400,
  "temperature": 0
}
```

**禁止：** `thinking` · `reasoning_effort` · `max_completion_tokens`（除非日后实测百炼接受并文档化）。

可选加固（实施时若默认会开思考再加）：

```json
"enable_thinking": false
```

（若 OpenAI 兼容层要求放在顶层或仅 SDK extra_body —— **UNKNOWN**，实施前以官方 curl 示例为准。）

---

## 3. Base URL 选择（FACT / 待你填）

| 选项               | URL 形态                                                                | 说明                                     |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| **A · 推荐（新）** | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | 文档建议北京业务空间专属域名             |
| **B · 旧公共**     | `https://dashscope.aliyuncs.com/compatible-mode/v1`                     | 文档称建议迁出；若控制台仍给此址可作过渡 |

实施命令里 **`PARSE_GOLD_LLM_BASE_URL` 不含末尾 `/chat/completions`**（现 completer 会拼 `/v1/chat/completions`）。

注意：当前代码拼的是 `` `${baseUrl}/v1/chat/completions` ``。  
若你设的 base 已是 `…/compatible-mode/v1`，请求会变成 `…/compatible-mode/v1/v1/chat/completions` → **错**。

**最小修正（实施必含其一）：**

| 方案           | 做法                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **P1（推荐）** | dashscope 时：若 `baseUrl` 已以 `/compatible-mode/v1` 或 `/v1` 结尾，则只拼 `/chat/completions`；否则保持 `…/v1/chat/completions` |
| **P2**         | 文档约定用户只填 `https://dashscope.aliyuncs.com/compatible-mode`（无 `/v1`），由代码拼 `/v1/chat/completions`                    |

**RECOMMENDATION：** 实施用 **P1**，并在 CLI 日志打印最终 URL path（脱敏）。

---

## 4. 已改文件（已实施）

| 文件                              | 动作                                                                                                                                                       | 生产影响            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `openai-compatible-chat.ts`       | `compat: 'dashscope'`：`max_tokens` + temperature；**无** thinking / reasoning_effort / enable_thinking；`resolveOpenAiCompatibleChatCompletionsUrl`（P1） | 无（默认 deepseek） |
| `openai-compatible-chat.test.ts`  | dashscope body + path 不双 `/v1`                                                                                                                           | 无                  |
| `run-parse-gold-llm.ts`           | `dashscope` + `DASHSCOPE_API_KEY`；日志打印最终 path                                                                                                       | 无                  |
| `parse-gold-llm-report.ts`        | `OpenAiCompatibleChatCompat` 含 `dashscope`                                                                                                                | 无                  |
| Worker / Prompt / Schema / Filter | **未改**                                                                                                                                                   | —                   |

---

## 5. 参数 / 环境映射

| 项                        | 值                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `PARSE_GOLD_LLM_COMPAT`   | `dashscope`                                                                                                          |
| `PARSE_GOLD_LLM_MODEL`    | `qwen-flash`                                                                                                         |
| `PARSE_GOLD_LLM_BASE_URL` | 北京 compatible-mode 根（见 §3，实施后按 P1）                                                                        |
| Key                       | `compat=dashscope` 时优先 `DASHSCOPE_API_KEY`；`PARSE_GOLD_LLM_API_KEY` 为显式覆盖（**勿**与 DeepSeek Key 混用抢先） |
| `PARSE_GOLD_LLM_GATE`     | `all`                                                                                                                |
| temperature / maxTokens   | `0` / `400`                                                                                                          |
| cache                     | `useCache: false`                                                                                                    |

---

## 6. 待解决问题

| #   | 问题                                                                 | 类型                         |
| --- | -------------------------------------------------------------------- | ---------------------------- |
| T1  | 本机尚无 DashScope Key                                               | FACT（评测前由你配置）       |
| T2  | 默认是否关闭思考；是否必须 `enable_thinking:false`                   | UNKNOWN                      |
| T3  | Workspace 专属域名 vs 旧 `dashscope.aliyuncs.com` 你账号实际可用哪条 | UNKNOWN（以控制台为准）      |
| T4  | path 双 `/v1` 风险                                                   | FACT（实施用 P1 消掉）       |
| T5  | `qwen-plus` 是否跟跑                                                 | 仅 flash L2 明显落后基线再议 |

---

## 7. 评测契约（Key 可用后 · 另确认）

固定：37 条 · 同 Prompt/Schema/`nowMs` · L1/L2 · 失败 kind · latency · usage · 成本手算（¥0.15/¥1.5×tokens）· **L3=`NOT_RUN`** · 对照 Flash verify 27/29·7/8。

---

## 8. 测试命令

**无 Key 干跑（期望 exit 1 · 接线后可验）：**

```bash
cd extension && env -u PARSE_GOLD_LLM_API_KEY -u DASHSCOPE_API_KEY -u DEEPSEEK_API_KEY -u OPENAI_API_KEY \
  PARSE_GOLD_LLM_COMPAT=dashscope \
  PARSE_GOLD_LLM_MODEL=qwen-flash \
  PARSE_GOLD_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
  bun run parse-gold:llm
```

**正式评测（Key 仅本地注入；勿贴对话；须另授权）：**

```bash
cd extension && \
  PARSE_GOLD_LLM_COMPAT=dashscope \
  PARSE_GOLD_LLM_MODEL=qwen-flash \
  PARSE_GOLD_LLM_BASE_URL='https://dashscope.aliyuncs.com/compatible-mode/v1' \
  PARSE_GOLD_LLM_GATE=all \
  PARSE_GOLD_LLM_JSON_OUT=../docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash.json \
  bun run parse-gold:llm
```

（Workspace 域名替换 BASE_URL；以日志 `path=` 为准。）

**单测：**

```bash
cd extension && bun run test:run -- src/core/recall/understand/openai-compatible-chat
```

---

## 9. 确认记录

1. **已确认并实施：** `compat=dashscope` + P1 path（2026-10-30）。
2. **初筛 model：** 仅 **`qwen-flash`**。
3. **评测已跑：** §0.1；Key 用 `DASHSCOPE_API_KEY`（修复：勿让 `DEEPSEEK_API_KEY` 抢先）。
4. **后续可选：** `qwen-plus` 同协议对照；或仅当产品接受时再议 `noteHint` null→false 归一（非默认）。
