---
created: 2026-11-27T05:47:34Z
updated: 2026-11-27T05:47:34Z
author: agent:cursor
scope: prompt 约束↔校验对照表 + 变更纪律（11 处 prompt）
status: active
upstream:
  - worker/src/services/ai/hosted-system-prompts.ts
  - worker/src/config/ai-task-kind.ts
  - extension/src/core/recall/understand/
  - extension/src/core/portrait/
downstream:
  - docs/engineering/NLG-门禁度量口径.md
  - extension/src/core/recall/understand/hosted-system-prompt-fingerprint.contract.test.ts
---

# Prompt 约束对照表与变更纪律

> 权威：改 prompt / 新增 taskKind 时同批维护本表。内容以**当前代码实读**为准，不以审计旧结论为准。

## 1. 约束 ↔ 校验 ↔ eval

| #   | Prompt                                                           | 主要约束（摘要）                                                                    | 校验落点（文件 + 函数）或「仅 prompt」                                                                                                                                                                                                                                                                               | Eval / 度量覆盖                                                                                 |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | **nlu parse**（`build-llm-parse-prompt.ts`）                     | 只出 JSON；闭集槽位；非召回 `assistantReply` 仅一句兜底；不发明 memory id / DB 操作 | **有校验：** `mapLlmProposalToParsedClue`（`map-llm-proposal-to-parsed.ts`）+ `groundTimeLabel` / `groundObjectTypes` / `groundBehaviorHints` 等（`ground-llm-parse-slots.ts`）；Zod：`llm-parsed-clue-proposal.ts`。**指纹：** `validateHostedSystemPrompt('nlu', …)` 接受 parse 指纹（`hosted-system-prompts.ts`） | Stage 1 `clue-chain:parse`（70 条）；门禁计数不适用（解析非 NLG 门禁表主路径）                  |
| 2   | **chitchat**（`build-chitchat-reply-prompt.ts`）                 | 1–2 句、同语言、引回找东西；禁编造存档/心情故事；删除边界                           | **有校验：** `gateChitchatReply`（`parse-recall-clue-with-llm.ts`：过长 / 语言不匹配 / 缺删除边界）。**指纹：** 同 `nlu` taskKind 的 chitchat 指纹                                                                                                                                                                   | NLG 门禁计数 `chitchat`（`nlg-gate-metrics.ts`）                                                |
| 3   | **framing_nlg**（`build-llm-framing-prompt.ts`）                 | 1–2 句；必达理解+澄清；仅用 facts；芯片规则；禁蛇形 timeLabel                       | **有校验：** Zod `LlmFollowUpProposalSchema` + `mapLlmFollowUpProposal`（`complete-recall-framing-nlg.ts` / `map-llm-follow-up-proposal.ts`；非 need_a_clue 清空 chips）。**指纹：** `validateHostedSystemPrompt('framing_nlg', …)`                                                                                  | NLG 门禁计数 `framing_nlg`                                                                      |
| 4   | **follow_up_nlg**（`build-llm-follow-up-prompt.ts`）             | 只帮在弱候选间收窄；禁问卷/画像推销；芯片须切割                                     | **有校验：** 同 framing 的 schema + `mapLlmFollowUpProposal`（`complete-recall-follow-up.ts`）；芯片元值参考 `gate-recall-follow-up-chips.ts`。**指纹：** `validateHostedSystemPrompt('follow_up_nlg', …)`                                                                                                           | NLG 门禁计数 `follow_up_nlg`                                                                    |
| 5   | **narrow_polish**（`build-llm-narrow-example-polish-prompt.ts`） | 只润色已选词面；禁造词/换词；长度顺序不变                                           | **有校验：** `gatePolishedComposerNarrowExamples`（`gate-polished-composer-narrow-examples.ts`，经 `complete-composer-narrow-example-polish.ts`）。**指纹：** `validateHostedSystemPrompt('narrow_polish', …)`                                                                                                       | NLG 门禁计数 `narrow_polish`                                                                    |
| 6   | **portrait_narrative**（`portrait-narrative-prompt.ts`）         | 只用给定内容点；一段纯文本；禁列表/黑话；长度按 locale                              | **有校验：** `validatePortraitNarrative`（`validate-portrait-narrative.ts`，经 `generate-portrait-narrative.ts`）。**指纹：** `validateHostedSystemPrompt('portrait_narrative', …)`                                                                                                                                  | NLG 门禁计数 `portrait_narrative`                                                               |
| 7   | **portrait_cluster**（`portrait-cluster-prompt.ts`）             | 划分必须覆盖全部输入；标签层级规则；只出 JSON                                       | **有校验：** `validatePortraitClusters`（`validate-portrait-clusters.ts`，经 `generate-portrait-clusters.ts`）。**指纹：** `validateHostedSystemPrompt('portrait_cluster', …)`                                                                                                                                       | NLG 门禁计数 `portrait_cluster`；评测 `portrait-cluster:eval`（`tests/eval/portrait-cluster/`） |
| 8   | **dreaming**（`dreaming-compile-proposal.ts` · dedicated）       | 只出 JSON；命题须带原文 sourceQuote；不发明事实                                     | **有校验：** Zod `DreamingCompileLlmPayloadSchema` + `parseDreamingCompileText` / `isVerbatimSourceQuote` / `filterDreamingCompileResults`（同文件）。**无** hosted 指纹（dedicated）                                                                                                                                | 无 Stage 1；无 NLG 门禁表行                                                                     |
| 9   | **enrichment**（`memory-enrichment-proposal.ts` · dedicated）    | 只出 JSON；英文本地 token；不发明 URL/id；无 note/embedding                         | **有校验：** Zod + `parseEnrichmentProposalText` / `filterEnrichmentProposal`（同文件；弱 grounding + 去 CJK）。**无** hosted 指纹                                                                                                                                                                                   | 无 Stage 1；无 NLG 门禁表行                                                                     |
| 10  | **gs_samples**（`gs-clue-samples-proposal.ts` · dedicated）      | 4 条自然回忆线索；禁复述 title/URL；禁发明事实                                      | **有校验：** Zod + `validateGsClueSamplesResult`（互异 / 无 CJK / 词数 / 不含完整 title·url）。**无** hosted 指纹                                                                                                                                                                                                    | 无 Stage 1；拒收日志经 `buildAiGateRejectedLogFields('gs_samples', …)`                          |
| 11  | **extract**（`extract-summary-proposal.ts` · dedicated）         | 只出 `{"summary"}`；同语言；禁 markdown 列表标题；不发明事实                        | **有校验：** Zod + `parseExtractSummaryText` / `isValidExtractSummary`（长度 / markdown / 语言粗检）。**无** hosted 指纹                                                                                                                                                                                             | 无 Stage 1；无 NLG 门禁表行                                                                     |

### 共用层（非单 prompt，但挡住漂移）

| 层                     | 落点                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hosted system 指纹     | `worker/.../hosted-system-prompts.ts` · `validateHostedSystemPrompt`                                       |
| 指纹 ↔ builder 契约测  | `extension/.../hosted-system-prompt-fingerprint.contract.test.ts`                                          |
| taskKind 注册表 ↔ 镜像 | `worker/.../ai-task-kind.ts` + `extension/.../ai-chat-task-kind.ts` + `ai-chat-task-kind.contract.test.ts` |
| Parse 缓存 prompt 版本 | `llm-parse-cache.ts`（键含 parse system 哈希）                                                             |
| 画像缓存 prompt 版本   | `portrait-narrative-signature.ts`（事实签名 + system 哈希）                                                |
| NLG 门禁度量口径       | `docs/engineering/NLG-门禁度量口径.md`                                                                     |

## 2. Prompt 变更纪律

改**任一**上表 prompt 文案或锚行时，同批必须：

1. **指纹：** 若触及 Worker `hosted-system-prompts.ts` 中对应 `prefix` / `anchors` 原文 → 同批改指纹表；契约测会失败直至对齐。dedicated 四类无指纹，仍须保持 Zod/过滤器与 prompt 承诺一致。
2. **对照验收：**
   - **parse 类**（nlu parse）：跑 Stage 1 `cd extension && bun run clue-chain:parse`，与 `runs/latest.json` / 既有 baseline 对照（parseOk / core / intent / topic / time / type / entities）；单项回退须回滚或停下汇报。
   - **NLG 类**（chitchat / framing / follow_up / narrow / portrait_*）：对照改前改后 `nlg-gate-metrics` 拒绝率/回退率（见 `NLG-门禁度量口径.md`）；勿只靠感觉。
3. **本表：** 约束或校验落点变化 → 更新 §1 对应行（禁止半同步）。
4. **缓存：** parse / portrait 的 prompt 版本已编入键/签名；文案变化后旧条目自然 miss，**无需**手工清缓存。紧急复位仍可用 `clearLlmParseCache()`。

### 新增 taskKind checklist

权威清单在 `worker/src/config/ai-task-kind.ts` 文件头（须四处一次改齐，并同步本表）：

1. 本注册表登记（kind / route / maxTokens / tier）
2. `route=hosted` 须在 `hosted-system-prompts.ts` 登记指纹（前缀 + 锚行）
3. 扩展侧镜像表同步（`extension/.../ai-chat-task-kind.ts`）
4. 配额口径确认（hosted 月/日 vs dedicated 专用端点配额）
5. 更新本文件 §1 一行（约束 / 校验 / eval）
6. 若 hosted：扩展契约测会覆盖新指纹常量；补 builder 最小样例断言路径
7. 若产出用户可见 NLG：接入 `nlg-gate-metrics` 计数口径

## 3. 相关命令

```bash
# Stage 1 parse 对照
cd extension && bun run clue-chain:parse

# 指纹 / 注册表契约
cd extension && bun run test:run -- src/core/recall/understand/hosted-system-prompt-fingerprint.contract.test.ts src/core/recall/understand/ai-chat-task-kind.contract.test.ts

# 画像聚类评测（手动）
cd extension && bun run portrait-cluster:eval
```
