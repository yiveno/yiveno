# ADR-010: Clue 理解流水线（LLM NLU → 可执行约束）

- **状态：** 已接受
- **日期：** 2026-09-08
- **决策者：** 维护者（2026-09-08 明示接受）
- **前置：** ADR-004（LLM 不碰数据平面）· ADR-005（禁止灰名单通解）· 产品文档 §0.1.0 / M1
- **诊断输入：** [`research/na-clue-morphology/schema-gap-analysis.md`](../../research/na-clue-morphology/schema-gap-analysis.md)

## 背景

北美用户 clue 口语变体极多（`DEM`/`GIST`/`SRC`/`HEDGE`…）。用海量人工口语调试 / 内容别名表做「通解」不可承受，且违反 ADR-005。

产品已选定：**LLM 听懂口语 → Zod/门禁 → `ParsedRecallClue` → 确定性 Filter/Hybrid**。当前实现是**单次** completer（另有旁路 NLG）。维护者希望明确：是否、以及如何把理解做成「多 LLM 分工流水线」，把任意字符串逐步收成越来越可执行的范式约束。

## 决定

### 1. 分工原则（接受后不变）

| 角色                | 负责                                          | 禁止                                                     |
| ------------------- | --------------------------------------------- | -------------------------------------------------------- |
| **LLM 理解**        | 口语 → 结构化**提议**                         | 返回 MemoryItem id；自由文本当查询；开放同义扩词冒充通解 |
| **Zod / grounding** | 校验 + 词面锚定                               | 放过无支撑槽位                                           |
| **确定性代码**      | `timeLabel`→窗、host 启发、Filter/Hybrid/索引 | 把未校验模型输出当事实                                   |
| **LLM NLG**         | Framing / 芯片文案 / Narrow 润色              | 改写检索约束或造词过 fold 门禁                           |

### 2. 默认拓扑：**单次理解 LLM**（现状保留为默认）

```
clue
  → Stage 0 噪音网关（规则，已有）
  → Stage 1 单次 NLU LLM → LlmParsedClueProposal
  → Zod + ground* → ParsedRecallClue
  → Filter / Hybrid
  →（旁路）Framing / follow-up NLG（同配额桶或另计，不进检索）
```

**理由：** 延迟与托管配额已可感（真机含 hosted clue LLM 可达十余秒）；每多一跳错误与成本倍增。口语形态缺口优先靠 **扩闭集槽位 + prompt/schema**（见 schema-gap），不靠默认双模型。

### 3. 可选 Stage 2（仅当门禁触发，非默认）

允许**第二次** LLM（或同模型第二次调用）仅用于下列之一，且须独立 Zod：

| 触发                                           | Stage 2 任务                      | 输出门禁                                                                                |
| ---------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| Stage 1 有 `sourceHints` 候选但 host 未解析    | 刊名/站名 → 候选 host 标签        | 必须落在**产品文档明示**的 host/刊名启发表，或原样保留为 contentTerms；禁止发明库外别名 |
| Stage 1 `contentTerms` 过碎且 Hybrid 关闭/失败 | 从 raw 重抽 gist 短语（不多造词） | fold/字面门禁：token 须在 clue 或已选 terms 的 fold 闭包内                              |
| Stage 1 Zod 失败 / 空锚但网关已 proceed        | 重试一次 NLU（同一 schema）       | 仍失败 → 规则 `parseRecallClue`                                                         |

**禁止** Stage 2：全库喂模型、生成答案 id、开放「同义词表」、把 FEEL/NEG 变成硬过滤。

### 4. 槽位演进方向（与形态对齐；改前先改产品文档）

1. ~~时间闭集补齐口语窗（如 month 级）— 对齐 T13。~~ **已落地（2026-09-08）：** `last_month` / `few_months_ago`。  
   1b. ~~时间置信度分层（糊时间勿硬空）。~~ **已落地（2026-09-10 · ADR-011）：** high 硬筛 / low 软排。
2. `sourceHints` → 确定性 host 软加权（P1，未做）。
3. 软旗：`knownItemHint`（DEM）、`hedgeHint`（压 confidence）（P1，未做）。
4. 意图：`preferNoteMatch` / `intentTerms`（附注优先软信号）（P1，未做）。

具体字段以产品文档 Normative + Zod 为准；本 ADR 钉「LLM 提议 → 门禁 → 执行」与「默认单次、条件二次」。

### 5. 与离线口语研究的边界

- `research/na-clue-morphology/`：校准 eval / TTE / placeholder（验尺子）。
- Runtime：**不**依赖海量口语人工表；变体由 Stage 1 LLM 吸收。
- 禁止把 morphology 例句复制成生产灰名单。

## 后果

**必须：**

- 新理解能力先问：单次 schema 能否覆盖？不能再谈 Stage 2。
- 任何多跳须可观测（`pipelineTiming` / clue flow trace 标 stage）。
- 配额：Stage 2 计入同一 hosted complete 桶；耗尽降级规则。
- 产品文档 M1 拓扑与相对时间闭集与本 ADR 对齐（已同步 2026-09-08）。

**禁止：**

- 默认串行 ≥3 次理解 LLM。
- 用多模型绕过 Zod/grounding。
- 用 Stage 2 做内容别名通解（ADR-005）。

## 备选（已拒或暂缓）

| 方案                                      | 结论                                                |
| ----------------------------------------- | --------------------------------------------------- |
| 海量人工口语调试 + 规则词典通解           | 拒：成本与 ADR-005                                  |
| 默认 3+ LLM 流水线（分类→槽位→扩词→重写） | 暂缓：延迟/配额/级联错误；无证据证明优于单次+槽位扩 |
| LLM 直接返回检索结果 id                   | 拒：ADR-004                                         |

## 相关

- 产品文档 §0.1.0、§0.1.1、M1、§2 理解层
- `frontend/src/core/recall/understand/understand-recall-clue.ts`
- `research/na-clue-morphology/`（形态 + schema-gap）
- ADR-004 · ADR-005
