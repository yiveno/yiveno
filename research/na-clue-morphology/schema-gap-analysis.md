# Schema gap · Morphology ↔ ParsedRecallClue / LLM（A）

> **日期：** 2026-09-08 · **性质：** Non-normative 诊断  
> **对照：** [`morphology.md`](./morphology.md) × `ParsedRecallClue` / `LlmParsedClueProposal` / `build-llm-parse-prompt.ts`  
> **目的：** 标清「口语形态」里哪些已被单次 LLM→Zod 吃掉，哪些会静默掉进 `contentTerms` 或被剥掉，哪些缺槽。

## 当前契约（已实现）

```
clue
  → 噪音网关（selectClueProcessingDisposition）
  → 单次 LLM（LlmParsedClueProposal）| 规则 parseRecallClue
  → ground*（词面锚定）→ ParsedRecallClue
  → Filter / Hybrid
```

**`ParsedRecallClue` 槽位：** `timeRange` · `objectTypes[]` · `behaviorHints[]` · `noteHint` · `contentTerms[]` · `confidence`

**`LlmParsedClueProposal` 额外：** `timeLabel`（闭集相对时间；确定性代码展开为 `timeRange`）

**旁路 LLM（不进检索）：** Framing NLG · follow-up 芯片 · Narrow 举例润色

---

## 缺口总表

| Morph    | 现有落点                        | 覆盖度            | 问题 / 风险                                                                                                   | 建议优先级                                                                                                           |
| -------- | ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GIST`   | `contentTerms` + Hybrid         | **高**            | Prompt 要求单 token、排除 `about`；多词 gist 被拆碎；Hybrid 补语义缝                                          | P1：允许多词 phrase 进 embedding 文本（已有 `buildClueEmbeddingText`）并审计拆词是否过狠                             |
| `TYPE`   | `objectTypes` 闭集              | **中高**          | 闭集无 `recipe` / `notes` / `tweet`；`docs`→`article`；`thing`/`piece` 不进类型                               | P2：产品文档先扩闭集再接线；`thing` 保持 DEM 勿硬映射类型                                                            |
| `TIME`   | `timeLabel` → `timeRange`       | **高（P0 已补）** | 已增 `last_month` / `few_months_ago`（含 `a while back`）；窗宽见产品文档                                     | —                                                                                                                    |
| `BEH`    | `behaviorHints` + `noteHint`    | **中高**          | `half_read` / `often_opened` / `recently_saved`；`left a note`→`noteHint`；缺「for later / 存了没看」等弱行为 | P2：仅当真机失败再扩闭集 surface                                                                                     |
| `DEM`    | **无槽**；prompt 当 filler 剥掉 | **低（有意？）**  | `that`/`thing`/`something`/`the one` 被排除；**丢失「已知项再找」信号**（vs 开放浏览）                        | P1：可选 `knownItemHint: boolean`（软信号，影响 confidence / Framing，**不**当硬过滤）                               |
| `SRC`    | 无槽；指望落进 `contentTerms`   | **低**            | `FT` / `New Yorker` / `from github docs` 易被拆成弱 token；无 host 归一                                       | **P0/P1**：提议 `sourceHints: string[]`（品牌/刊名/站名原词）→ 确定性 host 启发式（Normative 已允许「高频 host」类） |
| `INTENT` | 无槽；进 `contentTerms`         | **低**            | `for a talk` / `for a workshop` 靠字面碰附注；无「意图→优先 note 字段」加权开关                               | P1：`intentTerms[]` 或复用 contentTerms + `preferNoteMatch` 软旗                                                     |
| `HEDGE`  | **无槽**；常被当 filler         | **低**            | `stuff`/`maybe`/`i think` 被剥；不影响检索词，但丢失「把握低」→ 应更易 `need_a_clue`                          | P1：`hedgeHint: boolean` → 压低 confidence / Framing 弱命中                                                          |
| `ATTR`   | `contentTerms`                  | **中**            | `Li Bai` 可检；`that guy` 无实体                                                                              | P2：残差留给 Hybrid；禁止做人名灰名单                                                                                |
| `FEEL`   | 无；偶进 contentTerms           | **低**            | `scary`/`long` 弱；产品文档有感受维度但无槽                                                                   | P3：勿硬过滤；可选软加权以后再说                                                                                     |
| `NEG`    | 无                              | **无**            | 否定追问未进理解 schema                                                                                       | P3：跟 follow-up / dismiss 路径，不进首轮 parse                                                                      |
| `KW`     | `contentTerms`                  | **高**            | 关键词式本就能检；勿当口语金标                                                                                | —                                                                                                                    |

---

## 与 TTE v2 失败对照

| Task    | 口语形态                                                     | 理解层可疑缺口                                                                                  |
| ------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| T13     | `something about public libraries i saved a few months back` | `TIME`：`few months back` **不在** `timeLabel` 闭集 → 时间硬窗可能未建；主靠 gist，易语义偏邻域 |
| T14     | `something from the ft about working from home`              | `SRC`：`ft` 无 source/host 槽，仅弱 contentTerm；Top1 被噪声抢走属排序，但源锚未升权            |
| T12/T15 | DEM+GIST / DEM+BEH+INTENT                                    | DEM/INTENT 无一等公民；靠 contentTerms 碰巧够用                                                 |
| T16     | Notion + notes + gist                                        | `notes` 非 objectType；Notion 作 SRC 未归一                                                     |

---

## Prompt 与形态的直接冲突

`build-llm-parse-prompt.ts` 明确要求 contentTerms **排除**：

> `the, a, about, saved, read, that, …, thing, …, from, at, …`

| 被剥词                         | Morph       | 影响                                                |
| ------------------------------ | ----------- | --------------------------------------------------- |
| `that` / `thing` / `something` | `DEM`       | 结构框消失                                          |
| `about`                        | `GIST` 标记 | 无害（gist 词应保留）；标记本身不需要进 terms       |
| `from`                         | `SRC` 标记  | 刊名/站名须靠后续 token；若模型漏提 `ft` 则源锚全丢 |
| `saved`                        | `BEH`       | 应由 `recently_saved` 承接；映射侧有 reinforce      |

**结论：** 剥 filler 对 Filter 词面合理；但 **DEM / HEDGE / SRC 结构信息不应只靠「别进 contentTerms」**——要么单独布尔/数组槽，要么在 map 后从 raw 再抽。

---

## Grounding 门禁（已有，保留）

- `objectTypes` / `behaviorHints` / `timeLabel`：**须线索词面支撑**（`ground-*`），防模型瞎填。
- 扩 `SRC`/`INTENT` 新槽时：**同等 grounding**；host 映射用确定性表（产品文档明示的高频 host），**禁止**开放内容别名（ADR-005）。

---

## 建议落地顺序（仍须 Brief 才改代码）

1. ~~**P0 文档+闭集：** `last_month` / `few_months_ago`~~ **已落地 2026-09-08**
2. **P0/P1 schema：** `sourceHints?: string[]`（LLM 提议刊名/站名原词）→ map 到 domain/host 软加权。
3. **P1 soft flags：** `knownItemHint` / `hedgeHint`（影响 confidence / Framing，不改 Filter 硬逻辑）。
4. **P1 intent：** `preferNoteMatch` 或 `intentTerms`（T15「for a talk」）。
5. **第二跳 LLM：** 仅当单次 schema 仍不稳再启用（见 ADR-010）；默认不拆。

---

## 相关代码锚点

| 文件                                                                | 角色                   |
| ------------------------------------------------------------------- | ---------------------- |
| `frontend/src/core/recall/parse-recall-clue-types.ts`               | `ParsedRecallClue`     |
| `frontend/src/core/recall/understand/llm-parsed-clue-proposal.ts`   | LLM 提议 Zod           |
| `frontend/src/core/recall/understand/build-llm-parse-prompt.ts`     | system prompt          |
| `frontend/src/core/recall/understand/map-llm-proposal-to-parsed.ts` | 提议→门禁→结构         |
| `frontend/src/core/recall/understand/understand-recall-clue.ts`     | 网关 + 单次 LLM / 降级 |
| `frontend/src/core/recall/parse-recall-clue-lexicon.ts`             | 时间/类型/行为闭集词面 |
