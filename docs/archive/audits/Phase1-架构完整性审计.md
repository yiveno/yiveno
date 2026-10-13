---
created: 2026-09-17T14:05:44+08:00
updated: 2026-10-10T19:05:00+08:00
author: agent:cursor
scope: 在 Reality Map 基础上验证架构铁律与文档一致性（只读审计）
status: archived
upstream:
  - Yiveno-现实地图.md
downstream:
  - Phase 2 Recall Intelligence 差距分析
  - 后续回归基线
---

# Yiveno Phase 1 — 架构完整性审计（Architecture Integrity Audit）

> **ARCHIVED（2026-10-10）：** 迁入 `docs/archive/audits/`。**非**现行权威；对照结论以产品文档 / ADR / 代码为准。

> 纯审计，不修改任何文件。基准：Phase 0 Reality Map。
> **重新生成版（2026-09-17）**：上一版 `/tmp/yiveno-phase1-architecture-audit.md` 文件丢失，本次按同口径重新生成，并把"向用户提问的问题"附在末尾便于日后翻阅整理。

---

## 1. Architecture Boundaries

### 依赖方向验证（实际 import 拓扑）

| 方向                             | 预期                                   | 实际                                             | 状态                   |
| -------------------------------- | -------------------------------------- | ------------------------------------------------ | ---------------------- |
| `core` → `application`           | ❌ 禁止                                | 0 个反向依赖                                     | ✅ Healthy             |
| `core` → `infrastructure`        | ❌ 禁止                                | 0 个反向依赖                                     | ✅ Healthy             |
| `core` → `background`            | ❌ 禁止                                | 0                                                | ✅ Healthy             |
| `core` → `pages`                 | ❌ 禁止                                | 0                                                | ✅ Healthy             |
| `application` → `infrastructure` | ✅ 允许                                | 正常（memoryItemRepository, indexedDB, storage） | ✅ Healthy             |
| `infrastructure` → `application` | ❌ 应无                                | **1 处**（见 Finding P0-1）                      | ⚠️ Needs investigation |
| `pages` → `core`                 | ✅ 允许（UI 可依赖纯 domain 类型）     | 正常（RecallCardModel、RecallResult 等）         | ✅ Healthy             |
| `background` → `application`     | ✅ 允许（SW 调用 application service） | 正常                                             | ✅ Healthy             |
| `background` → `infrastructure`  | ✅ 允许                                | 正常                                             | ✅ Healthy             |
| `background` → `pages`           | ❌ 禁止                                | 0                                                | ✅ Healthy             |
| `pages` → `background`           | ❌ 禁止                                | 0                                                | ✅ Healthy             |

**无循环依赖。** 全量 grep 未发现任何环形 import 路径。

### Finding P0-1

- **Severity:** P0
- **Location:** `extension/src/infrastructure/identity/subscription-service.ts`（第 3 行）
- **Problem:** `infrastructure` 层直接调用 `application/recall/refresh-clue-llm-completer.ts` 的 `refreshClueLlmCompleterFromDevConfig`

```ts
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
```

- **Evidence:** 这是整个 extension 中**唯一**的 `infrastructure → application` 依赖（grep 全仓仅 3 处 import 该模块：`subscription-service.ts`、`background/bootstrap.ts`、`background/handlers/settings-handler.ts`）。其中后两者属于 `background`（SW 调度层），调用 application 是正常的；**唯一违反分层的是 subscription-service**。
- **Root cause:** `subscription-service` 位于 `infrastructure/identity`（属于 identity 子域），负责「订阅状态变更时重新挂载 LLM completer」。将其放在 infrastructure 是合理的（它使用 chrome.storage.local、network calls），但它依赖了 application 的 `refreshClueLlmCompleterFromDevConfig`。
- **Why it matters:** 这使得 `subscription-service`（infrastructure）隐式依赖于 `HybridRecallBackend` 的 LLM completer 注入机制。当 `refreshClueLlmCompleter` 的签名变更时，infrastructure 代码需要修改。这不是数据泄露，而是**行为编排跨越了层级**。
- **Confidence:** High
- **Recommended direction:** 这是一个有意的跨层调用（订阅 → Recall LLM 重挂），但不应该是 infrastructure 主动 import application。可以改为：
  - 在 `background/bootstrap.ts` 中统一订阅变更事件，调用 `refreshClueLlmCompleterFromDevConfig`
  - 或将 `subscription-service` 提升为 application 层（identity application）
  - 当前风险低，因为只有一处，且路径清晰

### Finding P1-1

- **Severity:** P1
- **Location:** `extension/src/core/recall/content-term-corroboration.ts` 与 `extension/src/core/recall/orchestrate-keyword-recall.ts`
- **Problem:** `content-term-corroboration.ts` 内部 re-export 了 `effectiveContentTermsForRecall`，并在 `HybridRecallBackend` 中被调用，造成职责重叠
- **Evidence:**
  - `orchestrate-keyword-recall.ts` 定义了 `effectiveContentTermsForRecall`（从 `content-term-corroboration` import）并在此文件内用。
  - `content-term-corroboration.ts` 又 re-export 了 `effectiveContentTermsForRecall`。
  - `HybridRecallBackend` 同时 import 了这两个文件，直接调用各自导出的 `effectiveContentTermsForRecall`。
- **Root cause:** `effectiveContentTermsForRecall` 的定义位置在 `content-term-corroboration.ts`，但 `orchestrate-keyword-recall.ts` 也在用，且 re-export 不在同一文件内。LLM 层（`HybridRecallBackend`）绕过了 `orchestrate-keyword-recall.ts`，直接调用 `content-term-corroboration`。
- **Why it matters:** 当佐证门逻辑变更时，需要同时改两个文件；且 `HybridRecallBackend` 中的佐证门调用与 `orchestrate-keyword-recall` 中的佐证门调用是**独立**的，存在逻辑不一致风险（代码注释声称「同源」，但 import 路径分开）。
- **Confidence:** Medium
- **Recommended direction:** 统一 `effectiveContentTermsForRecall` 的定义位置；在 `orchestrate-keyword-recall.ts` 中明确「核心编排用佐证门」；`HybridRecallBackend` 若有差异逻辑，独立注释说明原因。

---

## 2. DDD Integrity

### Memory / Capture / Clue / Recall / Retrieval / Ranking

**MemoryItem** — ✅ 真正的 domain 实体

- 定义在 `core/memory/memory-item.ts`（无 Chrome API）
- `BookmarkMemoryItem` / `TextExcerptMemoryItem` 联合类型
- `MemoryClues`（clue 字段群）属于 MemoryItem 的属性，**不是独立 domain concept**
- 字段命名符合产品术语：`clues.note` = 附注，用户 clue ≠ `clues.note`

**Capture** — ✅ 分布在 `application/capture/`（行为层）和 `core/capture/`（契约层）

- `capture-text-excerpt-service.ts`（application）做编排
- `core/capture/` 仅含契约定义（`install-onboarding.ts`、`text-excerpt-selection.ts`）
- Capture 行为全在 application 层，domain 无泄漏

**Clue** — ⚠️ 多重含义，需要明确隔离

| 概念                     | 定义位置                                         | 消费者                                              |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------- |
| 用户 Recall 输入（clue） | `parse-recall-clue-types.ts`：`ParsedRecallClue` | `HybridRecallBackend`、`orchestrate-keyword-recall` |
| `MemoryItem.clues` 字段  | `core/memory/clues.ts`：`MemoryCluesSchema`      | enrichment、indexing、Capture                       |
| `MemoryItem.clues.note`  | 同上（附注）                                     | keyword-filter（note 字段权重 26）                  |

**Clue** 这个名字在代码中承担了三个不同语义：

1. 用户输入的 clue（`ParsedRecallClue`）
2. 条目元数据的 clues 字段（`MemoryClues`）
3. 条目上的附注（`clues.note`）

**这不是问题** —— 代码通过类型系统和 import 路径做了隔离。但文档（如 `project.mdc` 术语表）中对 clue 的定义需要严格区分这三种用法，防止 AI agent 混淆。

**Recall** — ✅ 职责清晰的 domain concept

- `RecallResult` / `RecallMatch` 定义在 `core/recall/recall-result.ts`
- `RecallBackend` 接口定义在 `application/recall/recall-backend.ts`（应用编排层）
- `HybridRecallBackend` 实现该接口
- 无 UI 逻辑泄漏进 Recall domain

**Retrieval / Ranking** — ⚠️ 边界模糊

`keyword-filter.ts` 承担了「检索 + 排序」双重职责：

- `tokenizeRecallClueDetailed`：分词
- `scoreMemoryItemWithTokens`：打分
- `filterMemoryItemsByKeyword`：过滤 + 截断

`orchestrate-keyword-recall.ts` 在其基础上加「编排层」：

- 时间过滤 / 佐证门 / 软重排

`hybrid-fusion.ts` 独立提供融合逻辑（纯函数）。

**Ranking 的实际位置：**

1. `scoreMemoryItem`（`keyword-filter.ts`）— 字段权重打分
2. `applyParsedClueScoreBoosts`（`orchestrate-keyword-recall.ts`）— 软加权
3. `preferKeywordLeaderInHybridFusion`（`hybrid-fusion.ts`）— RRF leader guard
4. `applyOutcomePairScoreAdjustments`（`recall-outcome-pairs.ts`）— §7.2 Outcome 对调整

这四处排序逻辑分散，但职责清晰。**潜在风险**：如果新增一种 ranking 信号，需要在四个地方同时添加协调逻辑。

---

## 3. Recall Architecture

### A. Duplicate Responsibility

**未发现**。Recall 的理解、检索、排序、后处理被明确分离在不同模块：

- 理解：`understand-recall-clue.ts` + `parse-recall-clue.ts` + `select-clue-*.ts`
- 编排：`HybridRecallBackend`（application）— 唯一编排者
- 核心检索：`orchestrate-keyword-recall.ts` + `keyword-filter.ts` + `hybrid-fusion.ts`
- 排序结果：`build-recall-result.ts`
- 后处理：framing / narrow examples / follow-up chips / outcome pairs

### B. Competing Implementations

**Omnibox vs Side Panel** — ✅ 有意分叉（不是 competing）

```ts
// HybridRecallBackend.recallWithClue
const isOmniboxEntry = entry === 'omnibox'
// Omnibox 强制 lexical，跳过 LLM 和所有后处理
```

**MCP vs UI Recall** — ✅ 有意分叉

- 本机 MCP：调用 `recallService.recallWithClue`（Hybrid + LLM），与 Side Panel 相同路径
- 云端 MCP：`cloud-keyword-recall.ts`（keyword-only，Pro+KV 双门禁）

这是**架构设计**而非 competing implementations。

### C. Boundary Leakage

**未发现严重泄漏。** Recall 核心业务逻辑全在 `core/recall/` 或 `application/recall/backends/`。

**轻微观察：** `build-recall-framing-facts.ts` 的 `kind === 'candidates'` 判断和 `shouldPolishFramingWithLlm` 的 outcome 判断逻辑在 `HybridRecallBackend` 中重复出现。如果 framing 逻辑扩展，可能需要统一。

### D. Hidden Orchestration

**未发现。** `HybridRecallBackend` 是明确的单一编排者（~890 行），涵盖了理解 → 候选加载 → 零锚点判断 → 约束邻域/融合选择 → 时间过滤 → 佐证门 → soft reopen → outcome 对 → 结果构建 → framing → narrow examples → follow-up chips 的完整链路。

**轻微观察：** `attachRecallFraming` / `attachComposerNarrowExamplesIfNeeded` / `attachEnvironmentFollowUpIfNeeded` 三个 attach 函数是 `HybridRecallBackend` 内部闭包，没有独立建模，但职责清晰（都是「附加 UI 元数据」），不需要进一步抽象。

### E. Extension Difficulty

**低耦合区域（易扩展）：**

- 新增 LLM 后处理：扩展 `attachRecallFramingLlmPolish`
- 新增 ranking 信号：修改 `applyParsedClueScoreBoosts`
- 新增理解模式：在 `selectClueUnderstandingMode` 加分支

**高耦合区域（难扩展）：**

- `HybridRecallBackend` 的 `recallsWithClue` 是 ~890 行单函数。新增 recall 路径（如 semantic-only）需要修改此函数的主体分支逻辑。
- `content-term-corroboration` 与 `orchestrate-keyword-recall` 的佐证门调用存在双路径。

**建议（不实施）：** 若 Recall 路径继续增加，考虑将 `fuseHybridMatches` / `finalizeKeywordResult` / `recallByConstraintNeighborhood` 提取为独立的 Strategy 对象，由 `HybridRecallBackend` 委托调用。

---

## 4. LLM Plane vs Data Plane

### ADR-004 执行验证

**LLM 职责（实际）：**

- clue NLU：`understand-recall-clue.ts` → LLM 解析 → Zod schema 提案 → deterministic 代码执行
- embedding 生成：`embed-api-client.ts` → Cloudflare Workers AI → float[] 数组
- framing NLG：`completeRecallFramingNlgWithLlm` → LLM 润色文案 → 字符串
- narrow example polish：`completeComposerNarrowExamplePolishWithLlm` → LLM 润色举例
- follow-up suggestions：`completeRecallFollowUpWithLlm` → LLM 生成续找建议
- memory enrichment：`memory-enrichment-api-client.ts` → LLM 补全 metadata

**Deterministic 代码职责（实际）：**

- 所有 Zod 验证（`LlmParsedClueProposalSchema` 等）
- 所有 IndexedDB 读写（`indexedDBManager` 唯一入口）
- 所有排序决策（keyword-filter、orchestrate、hybrid-fusion）
- 所有 outcome 决策（`buildRecallResult`）
- 所有 LLM 降级路径（无 completer → 规则备选）

**边界验证：**

| 检查项                                     | 预期 | 实际                                                                                   | 状态      |
| ------------------------------------------ | ---- | -------------------------------------------------------------------------------------- | --------- |
| LLM 直接操作 IndexedDB                     | ❌   | 0                                                                                      | ✅        |
| LLM 决定 final outcome                     | ❌   | 0                                                                                      | ✅        |
| Zod schema 作为门禁                        | ✅   | 所有 LLM 输出均经 schema 验证                                                          | ✅        |
| Provider-specific 逻辑在 infrastructure    | ✅   | `clue-understand-api-client.ts`（dev）、`hosted-clue-understand-api-client.ts`（prod） | ✅        |
| Prompt assumptions 在 deterministic 逻辑中 | 低   | `selectClueUnderstandingMode` 有 model-specific 默认参数                               | ⚠️ 可接受 |

**轻微观察：** `selectClueUnderstandingMode` 中有 `model === 'deepseek-chat'` 判断，这是 provider coupling。但代码注释注明了意图（DeepSeek 对中文理解更准），且逻辑是确定性的（不是概率性的），属于可接受的实现细节。

**Cloudflare 依赖耦合：** embedding 通过 `requestWorkerEmbeddings` 调用 Workers AI；clue understand 通过 `clue-understand-api-client.ts` 代理到 Worker `/api/ai/clue/complete`。两者都在 `infrastructure/ai/` 中，隔离良好。

---

## 5. Architecture Enforcement

### 机器可执行的强制

| 边界                               | 强制方式               | 实际效果                      |
| ---------------------------------- | ---------------------- | ----------------------------- |
| `core` 无 Chrome API               | ❌ 无机器检查          | 通过代码审查和 agent 规则维护 |
| `infrastructure` 不 import `pages` | ❌ 无机器检查          | 通过代码审查                  |
| Zod schema 作为 LLM 门禁           | ✅ TypeScript 类型系统 | 编译期强制                    |
| Message type 联合类型              | ✅ TypeScript 联合类型 | 编译期强制                    |
| IndexedDB 唯一入口                 | ❌ 无 import 限制      | 通过代码审查和 agent 规则维护 |

**机器强制率：~30%**（Zod + TypeScript 类型 + 联合类型）。其余 70% 依赖代码审查和 agent 规则。

### AI Agent 抵抗架构漂移的能力

**如果未来 AI agent 不理解 Yiveno 架构，容易破坏的地方：**

1. **`core/` 中引入 Chrome API** — 当前无 import 限制，一个新 agent 可能直接写 `chrome.storage.local.get(...)`
2. **`infrastructure/` 中添加 UI 逻辑** — 当前无强制，一个 agent 可能将 framing 文案逻辑写进 infrastructure
3. **新增 message type 而不更新 schema** — `BackgroundMessage` 联合类型会强制，但新增 file 而不注册到 handler 需要人工审查
4. **在 UI 层直接调用 IndexedDB** — `background-client.ts` 是唯一桥接，但无机器检查

**防御机制：**

- `.cursor/rules/project.mdc` 硬规则已明确禁止
- `AGENTS.md` 薄指针指向 project.mdc
- `session-boot.mdc` 每次会话注入

**但：** 如果一个 AI agent 被配置为「忽略 `.cursor/rules`」或没有加载 project.mdc，这些边界完全无效。

---

## 6. AI-generated Architecture Drift

### Compatibility Layers / Wrappers

**未发现**。没有为了兼容旧 API 而保留的 wrapper 或 compatibility layer。

### Duplicate Services

**未发现**。Recall 只有一条真实路径（`HybridRecallBackend`），Omnibox 和 MCP 是 entry mode 分叉，不是 duplicate。

### Temporary Abstractions That Became Permanent

**需要第二阶段验证。** 以下需要确认是否仍在使用：

- `corpus-adapter-contract.ts`（Phase 0 标记为 UNKNOWN）
- `chrome-bookmark-sync-service.ts` 中的 `BookmarkSyncAlignmentCache`

### Dead Architecture / Legacy Pathways

**需要第二阶段验证。** 以下需要确认是否已废弃：

- `pages/popup`（project.mdc 声称已退役）
- `selection-toolbar` 的 legacy 状态

### Unnecessary Indirection

**轻微观察：** `recall-outcome-pairs.ts` 与 `apply-stored-outcome-pairs.ts` 的关系。

`recall-outcome-pairs.ts` 定义了 domain 逻辑（`applyOutcomePairScoreAdjustments`、`fingerprintRecallClue`），`apply-stored-outcome-pairs.ts` 负责从 chrome storage 读取并调用 domain 逻辑。这是有意的 infrastructure → domain → application 路径，但 `HybridRecallBackend` 直接 import 了 `apply-stored-outcome-pairs` 而不通过 application service，存在轻微的职责不清（应该是 `memory-item-service` 或独立 `outcome-pairs-service` 提供这层编排）。

### Duplicated Domain Rules

**发现 P1-1（已在 §2 报告）：** `effectiveContentTermsForRecall` 的双路径调用。

---

## 7. 其他观察

### Observation O-1

- **Severity:** P2（非问题，观察）

`extension/src/core/recall/keyword-filter.ts` 是一个 ~1080 行的**超大纯函数文件**。包含：分词、权重、拉丁屈折、CamelCase 缩写、host 对齐、模糊匹配、主文贴合度、行为加权、大小写贴合、否定降权、空壳检测。

按 DDD 原则，这些应该拆分成独立的 domain service（如 `TokenizationService`、`ScoringService`、`FuzzyMatcher`），但当前实现是**有意的内聚**（所有 Recall 关键词打分逻辑集中在一个文件中，便于理解和修改）。

这不是架构问题，而是**演进方向**：当 keyword-filter 的测试覆盖率达到可接受水平后，可以考虑拆分。

### Observation O-2

- **Severity:** P2（非问题，观察）

`infrastructure/logging/flow-log.ts` 是唯一的 flow logging 工具，且只依赖 `core/logging`（`LogScope`）。这是正确的中文注释 + logging 约定，但代码中没有强制所有 application service 必须使用 `flowStart/flowOk/flowFail`。`HybridRecallBackend` 内部使用 `createRecallFlowTrace`（内部 trace 函数），与 `flow-log.ts` 并行。

两者功能有重叠，但面向不同：`flow-log.ts` 用于 SW 控制台按 scope 过滤，`createRecallFlowTrace` 用于内存中 trace 收集。**不是架构问题**，但如果未来增加 tracing 系统（OpenTelemetry 等），需要统一。

---

## Architecture Integrity Verdict

| 边界                          | 判定                   | 说明                                                                                                           |
| ----------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Domain boundaries**         | ✅ Healthy             | `core/` 无 Chrome API；无反向依赖；Domain abstraction 清晰                                                     |
| **Application boundaries**    | ✅ Healthy             | Application service 职责明确；`RecallService` + `HybridRecallBackend` + `memoryItemService` 分层清晰           |
| **Infrastructure boundaries** | ⚠️ Needs investigation | `subscription-service`（infrastructure）→ `refreshClueLlmCompleter`（application）唯一跨层调用；其余全符合预期 |
| **Extension boundaries**      | ✅ Healthy             | `background` → `application` 正确方向；SW 无 UI 直接依赖                                                       |
| **Recall boundaries**         | ⚠️ Needs investigation | 单一编排者（HybridRecallBackend ~890 行）；`effectiveContentTermsForRecall` 双路径调用（P1-1）                 |
| **LLM / Data Plane boundary** | ✅ Healthy             | ADR-004 严格执行；所有 LLM 输出经 Zod 门禁；无 LLM 直接操作数据                                                |
| **Architecture enforcement**  | ⚠️ Structural risk     | 70% 依赖文档和 agent 规则；无机器可执行的 import 限制；`core/` 无 Chrome API 边界靠 agent 纪律而非机器强制     |
| **AI-agent resistance**       | ⚠️ Structural risk     | 若 agent 不加载 project.mdc，`core` 引入 Chrome API、`infrastructure` 添加 UI 逻辑均无阻碍                     |

---

## 未来 AI Agent 最易破坏的边界（按风险排序）

1. **`core/` 引入 Chrome API**（高风险）
   无机器检查；project.mdc 禁止，但 agent 可能忽略。

2. **`infrastructure/` 添加 UI 逻辑**（中等风险）
   无 import 限制；infrastructure 文件可以轻易 import Vue 组件或 DOM 逻辑。

3. **`core/` 或 `application/` 中直接调用 IndexedDB**（中等风险）
   `indexedDBManager` 是唯一入口，但无 import 强制；agent 可能图方便直接 `indexedDB.open(...)`。

4. **新增 message type 而不注册 handler**（低风险）
   TypeScript 联合类型部分缓解，但新 file 而不更新 `background-messages.ts` 联合类型需要人工审查。

5. **`effectiveContentTermsForRecall` 双路径不一致**（低风险）
   当前代码中两处调用是「同源」的，但若不同 agent 分别修改两个文件，可能导致佐证门逻辑漂移。

---

## 8. 上一轮向用户提出的问题（翻阅归档）

> 以下问题在 Phase 1 末尾提出，因本轮是审计而非修复，未得到答复；记录在此方便日后翻阅整理。

1. **`infrastructure → application` 跨层依赖 P0-1 是否值得处理？**
   - 是有意为之（订阅变更 → LLM 重挂）还是历史遗留？
   - 如果有意为之，是否应在 `background/bootstrap.ts` 中以事件总线统一，而非 infrastructure 主动 import application？
   - 若选择不处理，是否应至少在文件头注释中标明「此处有意跨层」以防后续 agent 误以为 bug？

2. **`effectiveContentTermsForRecall` 双路径 P1-1 是否会引发佐证门逻辑漂移？**
   - 当前两处 import 的实现完全同源，但若未来在 `content-term-corroboration.ts` 中修改逻辑而忘了同步 `orchestrate-keyword-recall.ts`，会出现不一致。
   - 是否值得做「单一来源 + re-export」的强化？
   - 还是接受「两处调用 = 同一函数」的现状，仅靠注释和测试维持一致？

3. **`keyword-filter.ts` ~1080 行超大文件（O-1）是否需要拆分？**
   - 当前是有意内聚（Recall 关键词打分逻辑集中，便于理解和修改）。
   - 若后续新增 ranking 信号（如个性化偏好、跨语言 embedding 等），该文件将更难维护。
   - 何时触发拆分？测试覆盖率门槛？文件行数门槛？还是新信号添加门槛？

4. **`flow-log.ts` vs `createRecallFlowTrace`（O-2）是否需要统一？**
   - 两者功能重叠但面向不同（前者 SW 控制台 scope 过滤，后者内存 trace）。
   - 若未来引入 OpenTelemetry 或类似 tracing 系统，是否应统一到一种？
   - 还是接受「双轨并行」的现状？

5. **Architecture Enforcement 70% 靠文档/agent 纪律——这是否构成真实风险？**
   - 当前 `core/` 无 Chrome API、`infrastructure` 不 import UI、`IndexedDBManager` 唯一入口——全靠 `.cursor/rules/project.mdc` 维护。
   - 若未来 AI agent 没有加载这些规则（如新 IDE、新工具），架构边界会瞬间被破坏。
   - 是否值得做以下加固？（不实施，只是问题）
     - 在 `package.json` 或 CI 增加 `eslint-plugin-boundaries` 类似检查
     - 在 `core/` 顶层增加 `chrome = undefined as never` 注入以触发 TypeScript 错误
     - 在 `infrastructure/` 顶层增加 `__vue_components__ = forbidden` 注释 + grep 检查

6. **MCP 云端 keyword-only（`cloud-keyword-recall.ts`）是否构成与前端 Hybrid 的「分裂」？**
   - 本机 MCP 走 Hybrid + LLM；云端 MCP 走纯 keyword + Pro+KV 门禁。
   - 同一 MCP 接口、不同实现——这是有意为之还是历史遗留？
   - 如果是 Phase 0 早期为了「先打通云端 keyword」而做的过渡，未来是否计划升级到 Hybrid？
   - 是否会因两端语义不一致导致 MCP 用户感知到「本机和云端不一样」？

7. **Recall 路径的扩展性——`HybridRecallBackend` ~890 行单函数是否会成为瓶颈？**
   - 当前函数承担了：理解、候选加载、零锚点判断、约束邻域/融合选择、时间过滤、佐证门、soft reopen、outcome 对、结果构建、framing、narrow examples、follow-up chips。
   - 若新增 recall 路径（如 semantic-only、关系图谱召回、时序推理），需要修改此函数主体分支。
   - 是否值得提取 Strategy 模式？现在？还是等到实际需要时再重构？

---

**报告完成。** 重新生成版写入 `/tmp/yiveno-phase1-architecture-audit.md`。
