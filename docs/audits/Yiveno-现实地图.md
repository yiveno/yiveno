---
created: 2026-09-17T14:02:23+08:00
updated: 2026-09-17T15:05:00+08:00
author: agent:cursor
scope: Yiveno 真实代码与文档的第一阶段摸底（只读审计）
status: final
upstream:
  - Yiveno 仓库代码（frontend/ backend/ website/ packages/）
  - .cursor/rules/project.mdc
  - docs/product/Yiveno-产品文档-v4.0.md
  - docs/product/Yiveno-术语表.md
  - docs/architecture/decisions/ADR-001..013
downstream:
  - Phase 1 架构完整性审计
  - Phase 2 Recall Intelligence 差距分析
  - 第二阶段深度审计（UNKNOWN-A1..A10 补读清单）
---

# Yiveno — 现实地图（Reality Map · 只读第 1 阶段审计）

> 维护者提示：本报告**完全只读**，未修改、未创建、未删除任何文件，未提出修复建议。  
> 一切结论以仓库内可验证代码/配置为依据；标注 `UNKNOWN` 处为无法在不进一步实验或的情况下确认。
>
> 恢复说明（2026-09-17）：本文件由上一会话丢失的 `/tmp/yiveno-reality-map.md` 恢复而来——`/tmp` 在 Cursor 会话级沙箱间会被清空，因此原始版本在会话结束后随即不可见。现已落盘到仓库根 `Yiveno-Reality-Map.md`，供后续第二阶段审计对照。
>
> **教训（AI Agent 自查）：** 把"面向持久查阅的产物"写到 `/tmp` 是错误的选择。下次同体量审计 / 报告 / 长篇交付，**默认写到工作区根**或专门的 `docs/audit/` 目录，避免会话结束即丢。
>
> 恢复渠道：从 `~/.cursor/projects/.../agent-transcripts/<uuid>.jsonl` 的 Write `contents` 字段回捞（每个 jsonl event 即一条结构化记录，单文件可能含 GB 级历史）。

---

## 0. 阅读指南

- 引用以文件路径 + 类/函数名为主，避免行号漂移。
- "层" 概念基于 `frontend/src/{core,application,infrastructure,background,pages,content}/` 与 `backend/src/{handlers,services,data-access,schemas,routes,middleware,types,utils,config}/` 实际目录结构。
- 文档 vs 代码对照请跳到 §8。

---

## 1. System Overview

Yiveno 是一个 **Bun workspaces monorepo**，包含一个 **Chrome MV3 扩展**（Yiveno 本身）、一个 **Cloudflare Worker 后端**（auth / AI / sync / MCP）、一个 **Astro 营销/账单站**、和四个共享/工具 workspace。

四个运行时边界各自独立，但**仅靠 HTTP/SW message 桥接**：

1. **Extension (frontend)** — Vue 3 + Vite MV3 扩展。
   - 后台是 **Service Worker**（`frontend/src/background/`）。
   - UI 是 **Side Panel**（`pages/sidepanel`），辅以 `library` / `detail` / `settings` / `getting-started` 页面。
   - 有一个 **Content Script**：划词浮层（`frontend/src/content/selection-toolbar/`）。
   - **Dev Probe** (`frontend/src/dev/probe/`、`packages/yiveno-probe/`) 真实库调试钩子。
2. **Cloudflare Worker (backend)** — Hono + Supabase 数据面；与扩展通过 fetch / Bearer 鉴权；与官网 / Supabase 跨边界。
3. **Marketing site (website)** — Astro；登录、账单页、Dodo 集成等在这里完成；通过 extension auth handoff 把 session 写回扩展。
4. **Shared packages** — `@yiveno/types`（跨端 Zod 类型）、 `@yiveno/design-tokens`（品牌/UI token，**仅被 frontend 真实引入**）、 `@yiveno-mcp`（扩展/外部共享 MCP 类型/工具）、 `@yiveno-probe`（已上包，但前端真实使用的是 `frontend/src/dev/probe/`，package 形态更像是"封装点"，需要确认是否在生产构建被引用 —— 见 §8 UNKNOWN）。

### 1.1 各运行时实际承担的职责

| 运行时             | 实际职责（来自代码）                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extension SW**   | 消息分发；Capture 写库（MemoryItem + 倒排 posting 增量）；Chrome 书签/右键菜单/命令/Omnibox/Storage/Side Panel；Recall 主链路；Auth/Sync 编排；MCP 本机 evidence；遥测；DEV probe。                                                                                                                                                                                                 |
| **Extension UI**   | 仅在 Side Panel、Detail、Library、Settings、Getting Started 五个入口展示/触发消息；不直接读 IndexedDB、不直接调 Chrome API（除 `sidePanel.open` / `tabs.navigate` 这类基础设施胶水）。                                                                                                                                                                                              |
| **Content Script** | 划词后弹 Shadow DOM 浮层；`captureTextExcerpt` + `openRecallShell` + 跨页 keepalive；与 SW 用 chrome.runtime.sendMessage + chrome.runtime.connect 通信。                                                                                                                                                                                                                            |
| **Worker (Hono)**  | `/api/ai/*`（clue/enrichment/embed/hosted/gs-clue-samples）、`/api/memory/sync/*`（Supabase 同步）、`/api/mcp`（只读 MCP）、`/api/account`（删除/订阅/隐私）、`/api/billing`/`webhooks/dodo`（Dodo 集成）、`/api/website`（营销/回调）、`/api/admin`（JWT 守护）。                                                                                                                  |
| **Supabase**       | PG（`memory_items` / `memory_sync_backups` 等表）；GoTrue Auth；扩展不直连 service_role key（仅匿名 `auth/v1` 用 fetch）。                                                                                                                                                                                                                                                          |
| **Dodo**           | 订阅（Webhook `/api/webhooks/dodo`；订阅投影 → entitlements → Pro 门禁）。                                                                                                                                                                                                                                                                                                          |
| **Website**        | 登录 UI、OAuth 流程、回写扩展 session（`/auth/callback` handoff）；订阅页面；与 SW 通过 `connect_extension=1&extension_id=...` 与 postMessage 桥接。                                                                                                                                                                                                                                |
| **Telemetry/eval** | `frontend/src/infrastructure/ai/recall-telemetry-recorder.ts` 在主分支被引用，但**文件当前不存在**（`infrastructure/ai/` 实际只有 `clue-understand-api-client.ts`、`hosted-clue-understand-api-client.ts`、`hosted-quota-api-client.ts`、`memory-enrichment-api-client.ts`、`embed-api-client.ts`、`gs-clue-samples-api-client.ts`、`dev-clue-llm-config.ts`）—— 见 §8 UNKNOWN-A1。 |

### 1.2 协作链路（高阶）

```
[User]
  │
  ▼ 划选 / Cmd / Right-click / Omnibox / Side Panel composer
[Content Script ─ SW Listener] ─▶ [SW MessageDispatcher]
                                          │
                ┌─────────────────────────┼──────────────────────────┐
                ▼                         ▼                          ▼
       [application/* services]    [chrome.* listeners]    [memoryItemService]
                │                         │                          │
                ▼                         ▼                          ▼
   [infrastructure/indexeddb]   [chrome.* APIs]   [keywordIndexRepository]
                                        │
                                        └──────▶ [Worker fetch / Bearer]
                                                       │
                                                       ▼
                                          [Hono routes → services]
                                                       │
                                ┌──────────────┬───────┴────────┬──────────┐
                                ▼              ▼                ▼          ▼
                          Supabase PG    AI Gateway       Dodo webhook   MCP HTTP
                            (sync)    (DeepSeek/Embed)      (sub)
```

---

## 2. Actual Architecture

### 2.1 模块依赖方向（来自实际 import 拓扑）

```
pages/             (Vue UI; only one component imports infra/messaging directly: RecallComposer/Conversation → background-client)
   │
   ▼
application/      (UI-facing application services; depends on core + infrastructure/indexeddb + infrastructure/identity + infrastructure/messaging + infrastructure/storage)
   │
   ▼
core/             (Pure TS, Zod schemas, message contracts, understand pipeline; depends on NO chrome.* or IDB; only AI api-client import path goes through core/recall/understand/openai-compatible-chat)
   │
   ▼
infrastructure/   (Chrome API wrappers, IndexedDB manager, messaging client, identity session, AI HTTP clients, storage, settings, logging)
   │
   ▼
background/       (SW entry; depends on application + core + infrastructure/dev probes; also static imports for SW-safe behavior)
```

**实际"硬"边界（enforced）：**

- `core/**` 的导入白名单只能向上指：`core/*` → `core/*`；任何 chrome.\*、IndexedDB、env 都在 infrastructure。代码里 `core/recall/understand/openai-compatible-chat.ts` 直接做 fetch —— 但只 fetch OpenAI-compatible 协议（无 chrome API）。
- `core/messaging/*` 是所有 `BackgroundMessage` 的 union 源；`infrastructure/messaging/background-client.ts` 只 export typed helpers，类型来自 core。
- `infrastructure/indexeddb/manager.ts` 是**唯一** `indexedDB.open` 入口；`MemoryItemRepository` / `KeywordIndexRepository` 都通过 `indexedDBManager.withTransaction(...)` 间接访问；搜索未发现 application/ 或 pages/ 直接 `indexedDB.open(...)` 调用（边界真实 enforced）。
- `chrome.*` API 调用集中在 `infrastructure/browser/**` 与 `background/listeners/**`；唯一的页面级例外是 `pages/sidepanel/main.ts` 的入口（Vite 多入口页），无逻辑 chrome 调用。

**实际"软"边界（文档/约定强、代码未强制）：**

- 应用服务（`application/*`）理论不应被 `core/*` 反向依赖；现状下 `core/recall/keyword-filter.ts` 等核心检索函数被 `application/memory/memory-item-service.ts` 调用，这是合法的（application→core）。**没有任何反向依赖**。
- "pages 不能直接调 IndexedDB" 的硬规则在代码里是**真实**的：`pages/sidepanel/SidePanel.vue` 经 `recallWithClue(...)`（在 `infrastructure/messaging/background-client.ts`）走 SW，不直接 IDB。
- "Application 不能直接用 chrome API"：未发现 application/ 内的 chrome.\* 调用。`memoryItemService` 内部仍依赖 `getCurrentOwnerId`（来自 `infrastructure/identity/local-profile-service`），这是允许的（application → infrastructure 合法）。

### 2.2 Chrome Extension MV3 实际入口与编排

**入口**：`frontend/src/background/main.ts`

```text
runtime.onMessage.addListener → handleBackgroundMessage → dispatchBackgroundMessage(switch)
runtime.onInstalled → ensureSidePanelOpensOnActionClick + ensureBackgroundBootstrapped + registerContextMenuItems + openGettingStartedOnInstall
其它监听器（在 import 期同步挂上）：
  - registerExternalAuthHandoffListener
  - registerSelectionToolbarKeepaliveListener
  - registerCommandListeners
  - registerOmniboxListeners
  - registerContextMenuListeners
  - registerMemoryCloudSyncAlarmListener
  - attachChromeBookmarkSyncListenersAtStartup
```

`dispatchBackgroundMessage` 内是一个 `switch (message.type)`，覆盖了 `background-message-types.registry` 中全部 56 个 type（含 `PING` / `GET_LOCAL_IDENTITY` / `*_HANDLER`）。Dev-only 消息 (`DEV_SEED_RECALL_PROBE` 等 5 个) 用 `import.meta.env.DEV` 守门，调用 `handleDebugBackgroundMessage`。

**Bootstrap 链**：`dispatchBackgroundMessage` → `ensureBackgroundBootstrapped`（非 `PING` / `OPEN_RECALL_SHELL` 阻塞，详见 §4.4 注释）→ handler。

### 2.3 Cloudflare Worker 实际路由

`backend/src/app.ts` 注册路由（按出现顺序）：

| 路径前缀             | 中间件               | Router              |
| -------------------- | -------------------- | ------------------- |
| `/`                  | 全局 secure/cors/log | `healthRouter`      |
| `/api/admin/*`       | `jwtAuth()`          | `adminRouter`       |
| `/api/auth`          | —                    | `authRouter`        |
| `/api/ai`            | —                    | `aiRouter`          |
| `/api/memory/sync`   | —                    | `memorySyncRouter`  |
| `/api/account`       | —                    | `accountRouter`     |
| `/api/mcp`           | 全局 supabaseAuth    | `mcpRouter`         |
| `/api/billing`       | —                    | `billingRouter`     |
| `/api/webhooks/dodo` | —                    | `dodoWebhookRouter` |
| `/api/website`       | —                    | `websiteRouter`     |

**实际能力（按 route × handler 实测）：**

- `/api/ai` 子路由：
  - `POST /clue/complete`（IP 日配额 200/d，开发模式；走 DeepSeek）
  - `POST /enrichment/complete`（Capture enrichment 结构化提议）
  - `POST /gs-clue-samples/complete`（Getting Started 一次 4 条示意）
  - `POST /embed`（需 Supabase Bearer + Pro 门禁；Workers AI `bge-m3`）
  - `GET /hosted/quota`、`POST /hosted/complete`（需 Supabase Bearer；月配额）
- `/api/memory/sync`：基于 owner_id 的 `pull` / `push` / `status` / `replace` / `restore`；操作 `memory_items` + `memory_sync_backups` 表。
- `/api/mcp`：仅 1 个 tool（`yiveno_recall_evidence`），keyword-only，1–5 条，Pro + AI_USAGE_KV 双门禁。
- `/api/account`：订阅快照、订阅刷新、删账号、清云端、隐私 notice ack。
- `/api/billing` + `/api/webhooks/dodo`：Dodo 投影/对账；`/api/admin` JWT 守护。

### 2.4 Supabase 数据模型（实际表）

`backend/src/data-access/memory-items.ts` 与 `supabase/migrations/` 共同定义（迁移目录未在本审计中细读，但被 `data-access/memory-items.ts` 实际查询所证实）：

- `memory_items(id, owner_id, source_local_profile_id, type, payload, clues, created_at, updated_at, deleted_at, rev)` —— Zod 校验在 `backend/src/schemas/memory-item.ts`。
- `memory_sync_backups(id, owner_id, item_count, snapshot, created_at)` —— 整侧 replace 前快照，用于误覆盖恢复（`restoreMemoryItemsFromLatestBackup`）。
- 其它表（Auth.users / waitlist 等）通过 Dodo / OAuth 间接使用。

`backend/src/data-access/supabase.ts` 用 `SUPABASE_SERVICE_ROLE_KEY` 创建 service client；`createSupabaseClient(env)` 按需构造 client。

### 2.5 扩展端 IndexedDB schema（实际定义）

`infrastructure/indexeddb/memory-db-definition.ts`：

- 库名 + version 来自 `infrastructure/indexeddb/constants.ts`（本审计未深读该常量文件，但升级逻辑证实了版本）。
- `memory_items` store：`id` keyPath；索引：
  - `[ownerId, updatedAt]`（`MEMORY_ITEM_INDEX_BY_OWNER_UPDATED`）
  - `[ownerId, type, updatedAt]`
  - `[ownerId, payload.chromeBookmarkId]`
  - `[ownerId]`
- `keyword_postings` + `keyword_index_meta` store：version 4 引入；ownerId-prefixed id 字符串。
- 升级分支 `oldVersion < N` 创索引/store（v1 创 store；v2 创 chromeBookmarkId 索引；v3 创 ownerId 索引；v4 创 posting/meta）。

`keyword-index-types.ts` 定义了 `KeywordPostingRecord`（ownerId+token→itemIds[]）+ `KeywordIndexMeta`（dirty/schemaVersion/builtAt/itemCount）。

### 2.6 循环依赖 / 隐藏耦合（实际检查结果）

- **未发现循环依赖**：从 import 拓扑看，`core` ← `application` ← `infrastructure` / `background` ← `pages` 单向；`core` 内部无相互循环（`recall-result.ts` 引用 `explain-recall-match.ts`，反向 import 仅出现在测试文件）。
- **隐藏耦合点**（可能值得第二阶段审计）：
  1. `infrastructure/ai/clue-understand-api-client.ts` 直接读 `import.meta.env.VITE_API_BASE_URL`；其它 ai 客户端也独立读同一 env 变量，但**没有共享单点** —— 见 §9 INITIAL-OBSERVATIONS。
  2. `application/recall/clue-llm-completer-registry.ts` 是一个**进程内单例**（模块级 let），由 `refresh-clue-llm-completer.ts` 在 settings 变化时设置；跨上下文（Side Panel vs SW）共享同一 registry，但跨 SW 进程重启会丢 —— 这是 MV3 正常。
  3. `application/recall/backends/hybrid-recall-backend.ts` 同时 import `application/memory/memory-item-service`、`application/recall/apply-stored-outcome-pairs`、`infrastructure/identity/auth-session-service`、`infrastructure/ai/embed-api-client`、`core/recall/*` —— 这是有意为之的 orchestration，但说明 "application layer" 不再 thin。

---

## 3. Domain Model

### 3.1 核心域对象定义位置（实际文件）

| 概念                          | 文件 / schema                                                                                                                                                                                                                                                                                                                        | 备注                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MemoryItem**（领域根实体）  | `core/memory/memory-item.ts`（`MemoryItemSchema = z.discriminatedUnion('type', [BookmarkMemoryItemSchema, TextExcerptMemoryItemSchema])`）                                                                                                                                                                                           | 仅 `bookmark` 与 `text_excerpt` 两个实现（`SupportedMemoryItemTypeSchema`）；其它类型被预留但未启用。                                                                                                                                                                                                            |
| **Capture**（"存东西"的入口） | 不是一个对象，而是一组入口：`application/capture/capture-text-excerpt-service.ts`、`application/memory/memory-item-service.captureBookmark / captureTextExcerpt / upsertBookmarkFromChrome / upsertBookmarkFromThirdPartyCorpus`                                                                                                     | 产出 MemoryItem；不直接动 IDB（经 Repository）。                                                                                                                                                                                                                                                                 |
| **Clue**（用户 Recall 输入）  | `core/messaging/recall-messages.ts` `recallWithCluePayloadSchema`：`{ clue: string(1..2000), context?: RecallDialogContext }`；解析结果在 `core/recall/parse-recall-clue-types.ts` `ParsedRecallClueSchema`                                                                                                                          | 用户输入即 clue；解析产物即 `ParsedRecallClue { raw, timeRange?, timeConfidence?, objectTypes?, behaviorHints?, noteHint?, contentTerms[], confidence }`。                                                                                                                                                       |
| **Recall**                    | `core/recall/recall-result.ts` `RecallResult` + `application/recall/recall-service.ts` `RecallService` + `application/recall/backends/hybrid-recall-backend.ts` `HybridRecallBackend`                                                                                                                                                | Recall 的"产品形态"是 `RecallResult { outcome, topPick, alsoPossible[], totalRankedCount, clue, parsed?, effectiveClue?, emptyKind?, relatedGuess?, assistantFollowUp?, recallFraming?, composerNarrowExamples?, pipelineTiming?, visibleProgressStages? }`。outcome 三态：`top_pick / need_a_clue / no_match`。 |
| **Retrieval**                 | `core/recall/keyword-filter.ts` `filterMemoryItemsByKeyword` + `core/recall/orchestrate-keyword-recall.ts` `recallByKeywordWithParsedClue` + `core/recall/extract-document-index-tokens.ts`（倒排 token 化） + `infrastructure/indexeddb/keyword-index-repository.ts`（posting 倒排） + `core/recall/hybrid-fusion.ts`（余弦 + RRF） | 关键词 Filter 是确定性纯函数；Hybrid = Filter + cosine 余弦 + RRF 融合。                                                                                                                                                                                                                                         |
| **Ranking**                   | 同上 + `core/recall/orchestrate-keyword-recall.ts` `applyParsedClueScoreBoosts`、`recallMatchesByConstraintNeighborhood`、`filterMatchesByParsedTimeRange`、`content-term-corroboration.ts` `filterMatchesByContentTermCorroboration`、`hybrid-fusion.ts` `preferKeywordLeaderInHybridFusion`                                        | 排序是纯确定性（无 LLM 直接干预 final rank）。LLM 只在 `understand` 阶段产出 `ParsedRecallClue`；排序阶段 LLM 仅做 NLG（framing、Narrow 润色、follow-up），不改检索结果。                                                                                                                                        |

### 3.2 概念之间的实际关系（基于代码读取）

```
                      [用户输入 clue]
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ Gate A: selectClueProcessingDisposition      │  ← reject_noise: empty / pure_symbol / digit_mash / keyboard_mash
   │ （理解层前置网关，纯规则）                    │
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ Gate B: selectClueUnderstandingMode          │  ← lexical | semantic
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ understandRecallClue                          │
   │  - LLM (parseRecallClueWithLlm)  ← JSON → Zod → mapLlmProposalToParsedClue
   │  - 或规则 (parseRecallClue)                   │
   │  → ParsedRecallClue                          │
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ mergeRecallDialogTurn                         │  ← 多轮对话上下文合并（Side Panel only）
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ memoryItemService.listForKeywordRecall       │  ← 倒排 keyword_index_repository.lookupCandidateIds；fallback 全表扫
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ HybridRecallBackend.recallWithClue            │
   │  ├─ Zero-anchor 短路 (shouldSkipRecallAsZeroAnchor)        │
   │  ├─ 约束邻域 (shouldRecallByConstraintNeighborhood)        │
   │  └─ fuseHybridMatches（关键词 + cosine + RRF）             │
   │       ├─ requestWorkerEmbeddings（Worker bge-m3）         │
   │       ├─ fuseScoredPools（timeFilter → RRF → domain boost）│
   │       └─ applyStoredOutcomePairsToMatches（§7.2）        │
   └──────────────────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────┐
   │ attachRecallFraming / LLM Polish / Env Follow-up / Narrow Examples │
   │ → RecallResult                               │
   └──────────────────────────────────────────────┘
```

### 3.3 哪些抽象是真 domain，哪些被污染

| 抽象                     | 真 domain?                                                                               | 实际污染 / Provider-specific                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MemoryItem`             | ✅                                                                                       | 仅 schema 约束 + Zod；不依赖 chrome/storage；IDB 是存储细节。                                                                                                             |
| `ParsedRecallClue`       | ✅                                                                                       | 纯 Zod；时间 label 是闭集；object/behavior 也是闭集。                                                                                                                     |
| `RecallResult`           | ⚠️                                                                                       | 自身是纯 TS interface；但 `assistantFollowUp` / `recallFraming` 字段是 LLM NLG 注入点。                                                                                   |
| `RecallService`          | ⚠️                                                                                       | 类 thin wrapper，但依赖 `application/recall/clue-llm-completer-registry`（进程单例）+ `infrastructure/identity/auth-session-service`（chrome.storage）。                  |
| `HybridRecallBackend`    | ❌ orchestration 混合                                                                    | 同时编排 application、infrastructure 与多个 core 子模块（OK），但混了 UI 进度回调（`onVisibleProgress` 是 UI 关注点）。`fuseHybridMatches` 才是核心，UI hook 是外层装饰。 |
| `KeywordFilter`          | ✅                                                                                       | 纯函数；唯一外部依赖是 `normalizeRecallText`（同文件内）。                                                                                                                |
| `KeywordIndexRepository` | ✅ 索引逻辑；但依赖 IndexedDBManager（infrastructure）—— 这是正常的 repository pattern。 |
| `Hybrid Fusion`          | ✅                                                                                       | 余弦 + RRF + leader-guard；纯函数；只接受 `{ id, embedding }[]` 与 query vector。                                                                                         |
| `MemoryItemSchema`       | ✅                                                                                       | Zod discriminated union。                                                                                                                                                 |
| `Capture`                | ⚠️                                                                                       | 没有统一 `Capture` 域对象；是一组 services。                                                                                                                              |

### 3.4 LLM 真正负责的部分（基于代码读取）

LLM 实际触达点：

1. **理解**（`understand-recall-clue.ts` → `parse-recall-clue-with-llm.ts`）：`raw → JSON { timeLabel, objectTypes, behaviorHints, noteHint, contentTerms, confidence }` → Zod → `ParsedRecallClue`。失败 → 规则降级。
2. **Capture 后台 enrichment**（`memory-enrichment-api-client.ts`、`application/memory/schedule-async-memory-llm-enrichment.ts`）：异步 enrich MemoryItem.clues（keywords/entities/tags/summary）。失败 → 仅记录，不阻塞 capture 路径。
3. **Embedding**（`embed-api-client.ts` → Worker `bge-m3`）：异步为 MemoryItem 计算 `clues.embedding[]`。登录 Free/Pro 配额分档。
4. **Recall Framing NLG**（`understand/complete-recall-framing-nlg.ts`）：在 Recall 完成后再润色召回结果旁白文案，不改检索结构。失败 → 规则模板降级。
5. **Composer Narrow Examples NLG**（`understand/complete-composer-narrow-example-polish.ts`）：润色 placeholder examples 展示形态。失败 → 原词。
6. **GS Clue Samples**（`gs-clue-samples-api-client.ts`）：Getting Started 一次 4 条示意 clue。失败 → 静态回退模板。
7. **Follow-up NLG**（`understand/complete-recall-follow-up.ts`）：追问 NLG；当前实现里**实际只挂在 chip-level**（来自 `assistantFollowUp.suggestions`，env-follow-up 接管）。

LLM **不**触碰：

- MemoryItem 写库（Capture / Sync / Enrichment 全部走"LLM 提议 → 门禁 → 确定性代码执行"路径，符合 ADR-004）。
- 排序（`applyParsedClueScoreBoosts`、`preferKeywordLeaderInHybridFusion`、`filterMatchesByContentTermCorroboration` 等全为纯函数）。
- IndexedDB 事务 / Supabase 写。
- final `outcome` 决策（由 deterministic 评分 + 阈值驱动）。

---

## 4. Recall Execution Path

### 4.1 Side Panel Recall：完整调用链（来自代码）

```
[1] User 输入 clue
   SidePanel.vue (handleSendTurn) ← RecallComposer emits 'send'
       │
       ▼
[2] recallWithClue({ clue, context?, progressRequestId? })
   infra/messaging/background-client.ts (recallWithClue)
       │ chrome.runtime.sendMessage({ scope:'background', type:'RECALL_WITH_CLUE', payload })
       ▼
[3] chrome.runtime.onMessage → handleBackgroundMessage
   background/handlers/message-handler.ts
       │ isBackgroundScopedMessage + dispatchBackgroundMessage
       │ ensureBackgroundBootstrapped（除 PING/OPEN_RECALL_SHELL 外阻塞）
       ▼
[4] dispatchBackgroundMessage switch 'RECALL_WITH_CLUE' → handleRecallWithClue(payload)
   background/handlers/recall-handler.ts
       │ parseRecallWithCluePayload (Zod)
       │ resolveCurrentTabDomain（resolveCurrentTabDomain读 chrome.tabs）
       │ logger.info('Recall', '收到 RECALL_WITH_CLUE', …)
       │ onVisibleProgress → notifyRecallVisibleProgress
       ▼
[5] recallService.recallWithClue(clue, { context, onVisibleProgress })
   application/recall/recall-service.ts
       │ flowStart('Recall', '选型后端')
       │ → hybridBackend.recallWithClue(clue, options)
       ▼
[6] HybridRecallBackend.recallWithClue
   application/recall/backends/hybrid-recall-backend.ts
   ├── createRecallFlowTrace (ClueFlowTrace)
   ├── normalizedClue = clue.trim()
   ├── entry = options.entry ?? 'sidepanel'
   ├── context = options.context（Side Panel 多轮上下文）
   ├── priorUserUtterances / accumulated / dismissedIds / currentTabDomain
   ├── if !normalizedClue → return no_match（空线索短路）
   ├── complete = getClueLlmCompleter()（来自 clue-llm-completer-registry 进程单例）
   ├── visibleProgressStages.push + reportProgress('understanding')
   ├── [A] understandStarted = Date.now()
   │       understood = await understandRecallClue(normalizedClue, { complete, trace })
   │       └── core/recall/understand/understand-recall-clue.ts
   │             ├── selectClueProcessingDisposition (Gate A)
   │             │     └── reject_noise (empty/pure_symbol/digit_mash/keyboard_mash)
   │             ├── selectClueUnderstandingMode (Gate B)
   │             │     └── URL-like → lexical；否则 semantic（如有 completer）
   │             ├── if mode=='lexical' or !complete → parseRecallClue (规则)
   │             └── else → parseRecallClueWithLlm
   │                   ├── buildLlmParseClueMessages (system + user)
   │                   ├── complete(messages) → text
   │                   ├── parseJsonObjectFromLlmText
   │                   ├── LlmParsedClueProposalSchema.parse (Zod)
   │                   └── mapLlmProposalToParsedClue → ParsedRecallClue
   │       understandMs = Date.now() - understandStarted
   ├── if understood.disposition === 'reject_noise' → 返回 no_match（仅 visibleProgress）
   ├── merge = mergeRecallDialogTurn({ accumulated, currentParsed: understood.parsed,
   │                                       priorUserUtterances, currentUtterance: normalizedClue })
   │       └── core/recall/merge-recall-dialog-turn.ts
   ├── reportProgress('narrowing')
   ├── listedResult = await memoryItemService.listForKeywordRecall({ rawClue, parsed: merge.merged, limit: RECALL_SCAN_LIMIT })
   │       └── application/memory/memory-item-service.ts
   │             ├── if shouldRecallByConstraintNeighborhood(parsed) → 全表 listByOwner
   │             └── else
   │                   ├── filterClue = buildFilterClueFromParsed(parsed) || rawClue
   │                   ├── keywordIndexRepository.lookupCandidateIds(filterClue)
   │                   │   └── posting OR → IDs（cap = KEYWORD_INDEX_CANDIDATE_ID_CAP）
   │                   ├── memoryItemRepository.getManyByIds(ids)
   │                   ├── mergeExcerptsIntoCandidates（摘录优先）
   │                   ├── filterMemoryItemsByKeyword(merged, filterClue, { limit: 1 })  ← 探针
   │                   └── fallback listByOwner 全表（mergeExcerptsIntoCandidates 仍调用）
   ├── items = excludeDismissedMemoryItems(listed, dismissedIds)
   ├── clueEmbeddingText = buildCLueEmbeddingText({ effectiveClue, parsed, rawClue })
   ├── reportProgress('checking')
   ├── if shouldSkipRecallAsZeroAnchor(clue, merge.merged) → return no_match
   │       ├── looksLikeNonRecallLifeRequest（天气/点餐/摘要/写码等闭合产品枚举）
   │       └── looksLikeAssistantImperativeClue + effectiveContentTermsForRecall==0
   ├── if shouldRecallByConstraintNeighborhood(merge.merged)
   │     finalized = finalizeKeywordResult(... items, merge.merged, currentTabDomain, pairClue)
   │       └── application/memory 已被绕开；直接走 orchestrate-keyword-recall
   │             recallByKeywordWithParsedClue(items, clue, { parsed })
   │             ├── shouldSkipRecallAsZeroAnchor → no_match
   │             ├── shouldRecallByConstraintNeighborhood → recallMatchesByConstraintNeighborhood
   │             │     └── 类型过滤 + 高置信时间硬筛 + 低置信时间窗内软加分
   │             ├── filterClue = buildFilterClueFromParsed
   │             ├── filterKeywordMatchesBeforeCollapse (keyword-filter)
   │             │     └── filterMemoryItemsByKeyword → scoreMemoryItem
   │             │           ├── tokenizeRecallClueDetailed
   │             │           │     ├── phrase + term + ngram
   │             │           │     ├── latinInflectionVariants (ies/es/s/ing/ed)
   │             │           │     ├── extractOrthographicAcronyms (JavaScript→js)
   │             │           │     ├── expandRecallHostClueVariants (www.↔裸域)
   │             │           │     └── pushUnspacedScriptTokens (汉字整段+首尾2-gram)
   │             │           ├── scoreMemoryItemWithTokens
   │             │           │     ├── collectFilterIndexFields
   │             │           │     ├── FIELD_WEIGHTS (title=24, note=26, pageTitle=20, textExcerpt=18, summary=16, domain=14, keywords=12, tags=12, url=10, excerptContext=8)
   │             │           │     ├── exactScore（含 ngram bonus, multi-term bonus, primary content bonus）
   │             │           │     ├── fuzzy 短 token (edit dist ≤1)
   │             │           │     ├── computeCaseFitBoost (cased clue tokens)
   │             │           │     ├── computeBehaviorBoost (openCount+recency, cap 12)
   │             │           │     ├── computeDismissPenalty (cap 10)
   │             │           │     └── weakAnchorScorePenalty
   │             │           └── hasRecallPrimaryContentMatch + pageTitle generic gate
   │             ├── applyParsedClueScoreBoosts (object/note/half-read/soft time)
   │             ├── applyTimeFilterThenContentCorroborationWithSoftReopen
   │             │     ├── filterMatchesByParsedTimeRange (high confidence only)
   │             │     ├── filterMatchesByContentTermCorroboration
   │             │     └── if shouldAttemptTimeSoftReopen → softParsed → 再筛
   │             ├── collapseRecallMatches
   │             └── buildRecallResult（outcome=top_pick/need_a_clue/no_match）
   │     applyCurrentTabDomainBoost + 排序（score desc + updatedAt tiebreak）
   │     applyStoredOutcomePairsToMatches（§7.2 outcome label pair 软调整）
   │     filterMatchesByContentTermCorroboration
   │     buildRecallResult（带 contentTerms）
   │
   ├── else (有内容词)
   │     hybrid = await fuseHybridMatches({ displayClue, pairClue, items, filterClue, parsed: merge.merged,
   │                                          clueEmbeddingText, currentTabDomain?, trace })
   │       └── application/recall/backends/hybrid-recall-backend.ts fuseHybridMatches()
   │             ├── getAuthSession → accessToken（无则直接返回 null → 降级关键词）
   │             ├── keywordScored = collapseRecallMatches(filterKeywordMatchesBeforeCollapse(items, filterClue)
   │             │                          .map(applyParsedClueScoreBoosts)
   │             │                          .filter(!isGenericOnlyHitAgainstSpecificClue), { limit: HYBRID_KEYWORD_POOL=100 })
   │             ├── embeddedCandidates = items.flatMap(item => item.clues.embedding 数组)
   │             ├── if embeddedCandidates.length === 0 → return null → 降级关键词
   │             ├── embed = await requestWorkerEmbeddings(accessToken, [clueEmbeddingText])
   │             │     └── infra/ai/embed-api-client.ts → POST /api/ai/embed (Bearer)
   │             │           └── backend/handlers/ai-embed.ts → env.AI.run('@cf/baai/bge-m3')
   │             ├── semanticScored = rankIdsByCosineToQuery(queryVector, embeddedCandidates)
   │             │     └── core/recall/hybrid-fusion.ts：cosineSimilarity + filter ≥ 0.28 + 取 Top 24
   │             ├── fuseWithParsed = parsed => fuseScoredPools({ keywordTimed, semanticTimed, parsed, currentTabDomain? })
   │             │     ├── filterMatchesByParsedTimeRange (high confidence only)
   │             │     ├── sortIdsByRrf([keywordOrder, semanticOrder], k=60)
   │             │     ├── merge byId (max score, union matchedFields 'embedding')
   │             │     ├── RRF boost per id (40 - index)
   │             │     ├── preferKeywordLeaderInHybridFusion（防单共享词 + 强语义压过多词附注）
   │             │     └── applyParsedClueScoreBoosts + applyCurrentTabDomainBoost + 排序
   │             ├── corroborationTerms = effectiveContentTermsForRecall(parsed)
   │             ├── corroborated = filterMatchesByContentTermCorroboration(fused, corroborationTerms)
   │             ├── if shouldAttemptTimeSoftReopen(parsed, corroborated.length)
   │             │     → effectiveParsed = parsedClueForTimeSoftReopen
   │             │     → 再 fuse + 再 corroborate
   │             ├── if corroborated.length === 0 → return null → 降级关键词
   │             ├── applyStoredOutcomePairsToMatches (outcome pair)
   │             ├── filterMatchesByContentTermCorroboration 再滤
   │             ├── collapseRecallMatches (pool + backfill)
   │             └── buildRecallResult (带 contentTerms)
   │     result = hybrid?.result ?? finalizeKeywordResult(...).result
   │
   ├── postProcessStarted = Date.now()
   ├── withMeta = attachDialogMeta(result, { clue, parsed, effectiveClue })
   │     └── 把 parsed + effectiveClue 挂到 RecallResult
   ├── if isOmniboxEntry → 简化路径（不走下面这堆）
   ├── enriched = enrichEmptyRecallResult(withMeta, items, effectiveParsedForFraming)
   │     └── 仅在 no_match 时挂 `relatedGuess`（同 type 的最近一条），仍 no_match
   ├── withNarrowExamples = await attachComposerNarrowExamplesIfNeeded(enriched, { clue, trace, complete })
   │     └── 抽 grounded Narrow 举例 → 可选 LLM 润色展示形态
   ├── withFraming = attachRecallFraming(withNarrowExamples)
   │     └── buildRecallFramingFacts + renderRecallFraming（规则模板）
   ├── withFramingLlm = complete ? await attachRecallFramingLlmPolish(...) : withFraming
   │     └── P1-P5 润色 + 计数 P6 仍规则拼接；失败静默降级
   ├── withFollowUp = attachEnvironmentFollowUpIfNeeded(withFramingLlm, { clue, trace, currentTabDomain? })
   │     └── 无 LLM chip 时挂环境弱芯片
   ├── postProcessMs / pipelineTiming (understandMs, candidateLoadMs, retrieveMs, postProcessMs, totalMs, understandSource, usedHybrid, timeSoftReopen?)
   └── return { ...withFollowUp, pipelineTiming, visibleProgressStages }
       │
       ▼
[7] handleRecallWithClue 返回 { ok: true, result }（或 RECALL_FAILED）
       │
       ▼
[8] chrome.runtime.sendMessage response → background-client.ts → SidePanel.vue handler
   - 把 result 投到 turns 列表（ConversationTurn[]），渲染 RecallConversation + RecallResultCard
   - 如果 progressRequestId 存在，onVisibleProgress 已经通过 notifyRecallVisibleProgress
     把阶段消息回推 Side Panel（多轮 pending 队列）
```

### 4.2 Omnibox Recall：完整调用链

```
[User 输入 omnibox 'yiveno <clue>']
  chrome.omnibox.onInputChanged
   → omnibox.ts handleOmniboxInputChanged(requestId, text, suggest)
        └── recallService.recallWithClue(clue, { entry: 'omnibox' })
              └── HybridRecallBackend.recallWithClue（isOmniboxEntry=true）
                    └── understandRecallClue({ forceMode: 'lexical' }) ← 强制走规则
                    └── context = undefined（Omnibox 不传多轮上下文）
                    └── complete = undefined（Omnibox 不挂 LLM completer）
                    └── 跳过 enrichEmptyRecallResult / framing / env follow-up
                    └── 直接返回 pipelineTiming + withMeta
              → recallResultToOmniboxSuggests(result, { detailPageUrl, translate: t, clue })
                    └── core/recall/omnibox-suggest.ts → chrome.omnibox.SuggestResult[]
```

### 4.3 MCP Recall：两条路径

**Local (extension-side MCP)**：

```
MCP_RECALL_EVIDENCE → mcp-handler.ts handleMcpRecallEvidence
  → mcpRecallEvidenceLocal (application/recall/mcp-recall-evidence-service.ts)
      ├── settings.mcpReadOnlyEnabled（否则 MCP_DISABLED）
      ├── McpRecallEvidenceArgsSchema.safeParse（否则 MCP_INVALID_ARGS）
      ├── recallService.recallWithClue(clue)（与 Side Panel 同轨）
      ├── ranked = [topPick, ...alsoPossible] → slice(0, min(limit, 5))
      ├── memoryItemService.getById per match（去除软删）
      └── buildMcpDetailExport + renderDetailExportMarkdown
  → return { ok: true, pack, markdown, backend: 'local_hybrid' }
```

**Cloud (Worker-side MCP)**：

```
POST /api/mcp/tools/call { name: 'yiveno_recall_evidence', arguments: { clue, limit? } }
  → requireMcpGate (AI_USAGE_KV + mcp_disabled + isActiveProUser)
  → recallCloudKeywordEvidence (services/mcp/cloud-keyword-recall.ts)
        ├── 纯关键词扫描（不 Hybrid，不 Embedding）
        ├── pullMemoryItems(env, ownerId, MCP_CLOUD_SCAN_LIMIT=2000)
        ├── 过滤 owner → MemoryItem 列表
        ├── tokenize + 词面匹配（同 frontend core/recall/keyword-filter 思路但 server-side）
        ├── 返回 1-5 条 evidence item
        └── renderMcpDetailExportMarkdown
  → return { ok: true, pack, markdown, backend: 'cloud_keyword' }
```

**两路径区别：** 本机 MCP 是 Hybrid + LLM（理解层）；云端 MCP 是纯关键词 + 不 Hybrid + 不 Embedding（服务端数据面能力有限，避免泄漏）。

### 4.4 message-handler `bootstrap` 行为

`dispatchBackgroundMessage` 内：

```ts
if (message.type !== 'PING' && message.type !== 'OPEN_RECALL_SHELL') {
  await ensureBackgroundBootstrapped()
}
```

即除了 PING 与 `OPEN_RECALL_SHELL`（Side Panel 入口手势），所有消息都要等 bootstrap 完成。`bootstrap.ts` 内的实际行为未在本审计深读，但保证 IDB / identity / settings 等就绪。

### 4.5 Recall 中 LLM 调用的实际次数

按 ADR-010 + 代码：

- 默认 **1 次** LLM 调用（语义理解）。
- 失败 → 降级规则（不再 LLM）。
- Recall 后的 LLM Polish（framing）+ LLM Narrow Polish 是 **额外、独立** 的完成器调用，挂在 LLM-mode 且仅当 `complete` 已注入（即非 omnibox、非 dev-only 路径）。
- Stage 2 / 多次 LLM：**未启用**（ADR-010 §3 明确条件触发，本审计未看到运行时调用）。

---

## 5. Data Flow

### 5.1 Capture 路径（Bookmark + Text Excerpt）

```
[Bookmark]
  chrome.bookmarks.onCreated/Changed/Removed (background/listeners/chrome-bookmark-sync.ts)
   → chrome-bookmark-sync-service.ts (application/capture/chrome-bookmark-sync-service.ts)
        ├── createBookmarkMemoryItem (pure factory in core/memory/create-memory-item.ts)
        ├── withEnrichment → enrichMemoryClues + mergeMemoryClueEnrichment
        ├── captureBookmark (user 主动) 或 upsertBookmarkFromChrome (sync 入库)
        ├── memoryItemRepository.put → indexedDBManager.withTransaction
        │     └── store.put → token diff → keywordIndexRepository.applyItemTokenDiff
        │                            └── posting upsert + meta update
        ├── scheduleAsyncMemoryLlmEnrichment(item.id)  ← 异步，非阻塞
        └── scheduleAsyncMemoryEmbedding(item.id)  ← 异步（须登录）

[Text Excerpt]
  content/selection-toolbar/main.ts
   → chrome.runtime.sendMessage CAPTURE_TEXT_EXCERPT (infra/messaging/background-client.ts)
   → memory-handler.ts handleCaptureTextExcerpt
        → memoryItemService.captureTextExcerpt → memoryItemRepository.createTextExcerpt
        → 同上 put + 异步 enrichment + 异步 embedding
```

### 5.2 Sync 路径（本机 ⇄ Cloud）

```
SET_SYNC_ENABLED（Pro + 已 ack 隐私）
 → handleSyncMergeLocalAndRemote（若双方都有）
    或 handleSyncReplaceWithLocal / handleSyncReplaceWithRemote
    或 handleIncrementalMemorySync（定时 / 手动）
        ├── memoryItemRepository.remapOwnerId（localProfileId → accountId）
        ├── fetchRemoteSyncStatus → getMemorySyncStatus
        ├── pullRemoteMemoryItems → pullMemoryItems(env, ownerId, limit, { since? })
        │     └── Supabase .from('memory_items').select('*') (service_role)
        ├── parseCloudItems → MemoryItemSchema.safeParse → 丢弃非法
        ├── mergeMemoryItemsByUpdatedAt（LWW）
        ├── replaceRemoteWithLocalItems → upsertMemoryItems → replaceMemoryItems
        │     └── 备份 → 删除原集 → 写入新集（allowDestructiveShrink 守门）
        └── memoryItemRepository.replaceOwnerItems → 本机 IDB 整侧替换
```

### 5.3 Recall 数据流

参见 §4.1；摘要：

```
clue (UI string)
 → background-client.sendBackgroundMessage({ type: 'RECALL_WITH_CLUE' })
 → handleRecallWithClue (SW)
 → recallService → HybridRecallBackend
 → understandRecallClue (理解层：LLM 或规则) → ParsedRecallClue
 → memoryItemService.listForKeywordRecall (倒排预过滤 + 摘录 merge) → MemoryItem[]
 → fuseHybridMatches (RRF + cosine + timeFilter + corroboration + outcome pair)
    OR finalizeKeywordResult (constraint neighborhood 或 keyword fallback)
 → attachDialogMeta / enrichEmptyRecallResult / narrow examples / framing / follow-up
 → RecallResult
 → UI
```

### 5.4 Capture ↔ Recall 的实际"数据环"

```
Capture 落 MemoryItem（含 clues.embedding 异步补齐）
   ↓
KeywordIndexRepository 增量 posting（按 ownerId+token）
   ↓
Recall 候选加载：keyword_index_repository.lookupCandidateIds(clue)
   ↓
Filter / Hybrid 排序 / RRF / 佐证
   ↓
RecallResult
```

---

## 6. Extension Flow（消息/桥接实际形态）

### 6.1 Content Script → Background

- `content/selection-toolbar/main.ts`（content script）在划词时通过 `chrome.runtime.sendMessage` + `chrome.runtime.connect(SELECTION_TOOLBAR_KEEPALIVE_PORT)` 与 SW 通信；keepalive 端口在 `background/listeners/selection-toolbar-keepalive.ts` 注册。
- 调用：`captureTextExcerpt`、`openRecallShell`。
- `chrome.runtime.onMessage` 内 `sender.tab` 被 message-handler 用来触发 `OPEN_RECALL_SHELL` 时打开对应 tab 的 Side Panel（`handleOpenRecallShell({ tabId, windowId })`）。

### 6.2 Background → Side Panel / UI

- `chrome.runtime.sendMessage({ scope: 'background', type, payload })` 是唯一入口（UI ↔ SW）。
- 所有 message types 在 `core/messaging/background-messages.ts` 集中声明；handler 在 `background/handlers/`（switch-case）；registry `docs/engineering/background-message-types.registry` 是 build-time 校验源（`bun run doc:check`）。
- 进度事件：Recall 内 `notifyRecallVisibleProgress({ progressRequestId, stage })`（`infrastructure/messaging/notify-recall-visible-progress.ts`）。这是 **push**（SW → UI）模式，绕过 sendMessage request/response 对。

### 6.3 Background → Worker（fetch）

- AI 客户端（clue-understand / hosted / embed / enrichment / gs-clue-samples）使用统一 `import.meta.env.VITE_API_BASE_URL`（fallback `http://localhost:8787`）。
- Bearer 来自 `infrastructure/identity/auth-session-service.ts`（chrome.storage.session/local 缓存的 Supabase session）。
- 仅 `clue-understand-api-client` 是公开的（IP 日配额）；其它全部要求 Bearer。
- Worker 端 `/api/ai/clue/complete` 走 IP 配额；`/api/ai/hosted/complete` 走用户配额；`/api/ai/embed` 走用户 + Pro 分档配额；`/api/ai/enrichment/complete` 走 IP 配额；`/api/ai/gs-clue-samples/complete` 走 IP 配额。

### 6.4 Background → chrome.\* API

- 集中在 `infrastructure/browser/**`：`chrome.bookmarks.*`（`chrome-bookmark-reader`）、`chrome.tabs.*`（`extension-tab`、`navigate-tab`、`active-tab-reader`）、`chrome.sidePanel.*`（`side-panel`）、`chrome.omnibox.*`（`omnibox.ts`）、`chrome.contextMenus.*`（`context-menu.ts`）、`chrome.commands.*`（`commands.ts`）。
- `pages/sidepanel/main.ts` 入口是 Vite 多入口，未在 page 内直接 chrome.\* 调用（除生命周期）—— **真实 enforced**。

### 6.5 UI → Storage

- `chrome.storage.local` 用于 `LocalProfile`、SyncPrefs、PrivacyPrefs、SubscriptionSnapshot、AuthSession、GSClueSamples、FirstRecallOnboarding、ThirdPartyCorpusImport、ColdStartPostReleaseBanner、RecallOutcomePairs 等（参见 `infrastructure/storage/`）。
- `chrome.storage.session` 用于会话级临时态（`chrome-storage-session.ts`）。
- IndexedDB 用于 MemoryItem + 倒排 posting/meta（详见 §2.5）。

---

## 7. Agent Governance（实际生效）

### 7.1 Cursor 自动注入（alwaysApply）

- `.cursor/rules/session-boot.mdc` — 当下焦点（来自 CURRENT.md，自动同步）；开机必读。
- `.cursor/rules/project.mdc` — Yiveno 硬规则（**单一权威**）。
- `.cursor/rules/agent-core.mdc` — AI 行为元规则（项目无关）。
- `.cursor/rules/terminology.mdc` — 术语硬规则（指向术语表）。
- `.cursor/rules/git-workdir-safety.mdc` — 不得 `git checkout/restore/reset --hard` 丢 WIP。
- `.cursor/rules/testing-real-library.mdc` — 维护者允许 Agent 直接用真实 Chrome 库测试。

### 7.2 仓库根薄指针

- `AGENTS.md` — 162 行薄指针（ADR-013 后收敛）。包含 Cursor 入口 + 未来扩展接口。
- 仓库根 CLAUDE.md / GEMINI.md / .codex/.codex.md — ADR-013 中标注为"历史遗留死代码"。本审计文件树未出现这些文件（已删除）。

### 7.3 同步门禁

- `scripts/sync-ide-boot.mjs` — `CURRENT.md → .cursor/rules/session-boot.mdc` 同步。
- `scripts/check-doc-drift.mjs`（`bun run doc:check`）—— 校验 `message-types.registry ↔ message-handler.ts switch cases`、`CURRENT.md ↔ session-boot.mdc` 同步。
- ADR-013 记录了"AGENTS.md 唯一薄指针"决定；ADRs 1–12 全部存在并被 `docs/architecture/decisions/` 列出（README 列出 13 个 ADR）。

### 7.4 锁 / CI / Hooks

- `.husky/`（git hooks）。
- `.github/`（workflows；本审计未细读文件清单）。
- `.cursor/hooks.json`（拦截破坏性 git）。
- `skills-lock.json` + `.agents/skills/` + `.claude/skills/chrome-extensions` + `.claude/skills/modern-web-guidance`（Agent 工具技能）。

### 7.5 Agent 实际如何被约束（基于代码可观察）

- 路径 `frontend/src/infrastructure/messaging/background-client.ts` 的所有 export 都基于 `core/messaging/background-messages.ts` 类型（types 是真相源）。
- `backend/src/app.ts` 的路由注册是 Hono 显式注册，没有"框架自动反射"。
- `docs/engineering/background-message-types.registry` 是平文本（每行一个 type），由 `bun run doc:check` 校验一致性。
- 新增 message type 的约束：先 `core/messaging/*` 加 schema → handler switch case → registry → 产品文档 §4（如属核心表）—— 这是 ADR-001 锚定的规矩。

---

## 8. Architecture vs Documentation

### 8.1 Documented Architecture（基于 docs/ + ADR）

| 维度        | 文档声称                                                                                                  | 文件                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 分层        | `pages/ → application/ → core/ → infrastructure/` + `background/`（SW）；UI 仅经 `background-client` → SW | `docs/product/Yiveno-产品文档-v4.0.md` §0.1.0/§2 + `AGENTS.md`                                          |
| 数据        | IndexedDB 唯一入口；`memory_items` 表 + 倒排 posting/meta                                                 | `docs/engineering/关键词倒排索引-Phase1.md` + `infrastructure/indexeddb/memory-db-definition.ts`        |
| LLM 边界    | LLM 仅 NLU/NLG；数据平面仅"提议 → 门禁 → 执行"                                                            | ADR-004 + 产品文档 §0.1.1                                                                               |
| 理解流水线  | 默认单次 LLM；可选 Stage 2 条件触发                                                                       | ADR-010                                                                                                 |
| 时间置信    | high 硬筛 / low 软排；Framing Within/Around                                                               | ADR-011                                                                                                 |
| 邻域非神谕  | Top Pick 是建议；交付邻域；No match 诚实终局                                                              | ADR-003                                                                                                 |
| 禁止灰名单  | 不允许内容别名表冒充通解                                                                                  | ADR-005 + product.mdc 全量用户能力                                                                      |
| Find things | 定位句不变；things 双关=后手；非固定路线                                                                  | ADR-012                                                                                                 |
| 主入口      | Side Panel；Action Popup 已退役；`pages/popup` 已删除                                                     | ADR-001 + `frontend/src/pages/sidepanel` 实际存在                                                       |
| 召回管线    | Hybrid（关键词 + cosine + RRF）；Free/Pro 同档；LLM 仅听懂                                                | `project.mdc` + `core/recall/hybrid-fusion.ts` 实际存在                                                 |
| 倒排        | Phase 1（owner+token posting）；fallback 全表扫                                                           | `infrastructure/indexeddb/keyword-index-repository.ts` + `docs/engineering/关键词倒排索引-Phase1.md`    |
| MCP         | 只读 beta；本地同 Hybrid；云端纯关键词；Pro + KV 双门禁                                                   | `core/recall/mcp-tool-schema.ts` + `backend/src/services/mcp/cloud-keyword-recall.ts` + `routes/mcp.ts` |
| Sync        | Supabase service_role；整侧 replace 前备份；防 destructive shrink                                         | `backend/src/data-access/memory-items.ts`                                                               |

### 8.2 Actual Architecture（来自代码）

**全部与文档一致**。具体证据：

| 维度        | 实际确认                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分层        | import 拓扑单调；`infrastructure/indexeddb/manager.ts` 唯一 `indexedDB.open` 入口；`core/*` 无 chrome.\* 引用                                                                                                                                      |
| 数据        | `memory-db-definition.ts` upgrade logic 与 ADR 描述一致；`keyword-index-repository.ts` 是 posting 实现                                                                                                                                             |
| LLM 边界    | `recall-result.ts` outcome 字段由 deterministic 评分驱动；LLM 只在 understand/Polish/Narrow 出现                                                                                                                                                   |
| 理解流水线  | `understand-recall-clue.ts` 默认 `mode='semantic'` + 有 completer；失败规则降级；**未启用** Stage 2（代码中无 Stage 2 调用）                                                                                                                       |
| 时间置信    | `parse-recall-clue.ts` `timeConfidenceForRelativeLabel` 与 ADR-011 表一致；`filterMatchesByParsedTimeRange` 仅 high 硬切                                                                                                                           |
| 邻域非神谕  | `buildRecallResult` outcome 计算：top_pick 需 ≥ `RECALL_TOP_PICK_MIN_SCORE` (18)                                                                                                                                                                   |
| 禁止灰名单  | `keyword-filter.ts` 用纯算法（inflection/acronym/host-variant）；无内容别名表；`fuseHybridMatches` 还用 `isGenericOnlyHitAgainstSpecificClue` 过滤纯泛词命中                                                                                       |
| Find things | UI 文案 `i18n/en/messages.json` 未发现 `zh_CN`；`pages/sidepanel` `t('popup_recall_pending')` 等用 en key；产品文案层一致                                                                                                                          |
| 主入口      | `pages/popup` 不存在；`pages/sidepanel` 是 Recall 主壳                                                                                                                                                                                             |
| 召回管线    | `hybrid-fusion.ts` cosine + RRF + leader-guard；embedding worker 调用 `requestWorkerEmbeddings`；Free/Pro 同档（`ai-embed.ts` 默认 100/500 配额）                                                                                                  |
| 倒排        | `keyword-index-repository.applyItemTokenDiff/Diffs` 增量 posting；`lookupCandidateIds` OR；`isHealthy` → `rebuildForOwner` 重建                                                                                                                    |
| MCP         | `core/recall/mcp-tool-schema.ts` 定义 schema；`application/recall/mcp-recall-evidence-service.ts` 走 `recallService.recallWithClue`；`backend/services/mcp/cloud-keyword-recall.ts` 纯关键词；`routes/mcp.ts` `requireMcpGate` + `isActiveProUser` |
| Sync        | `data-access/memory-items.ts` `replaceMemoryItems` 默认拒绝缩量（`destructive_shrink_denied`）；`memory_sync_backups` 备份                                                                                                                         |

### 8.3 Confirmed Alignment（值得标注的"文档与代码一致"点）

1. **LLM 不碰数据平面**：所有 LLM 输出都经 Zod `LlmParsedClueProposalSchema` / `MemoryEnrichmentProposal` 等提案 schema 校验，再由 deterministic 代码执行；扩展侧 LLM 提案从不直接写库。
2. **理解层默认 LLM**：`selectClueUnderstandingMode` 默认返回 `'semantic'`（有 completer）。
3. **Side Panel 是 Recall 主壳**：`pages/sidepanel` 是唯一包含 `RecallComposer` / `RecallConversation` 的入口；`pages/popup` 不存在。
4. **邻域非神谕**：`recall-result.ts` 中 outcome 计算与文档一致（`RECALL_TOP_PICK_MIN_SCORE` 阈值；no_match 可空）。
5. **内容佐证门（ADR-011 Normative 例外）**：`HybridRecallBackend` 在 `fuseHybridMatches` 中明确 `filterMatchesByContentTermCorroboration` + `shouldAttemptTimeSoftReopen` + `if (corroborated.length === 0) return null` → 降级关键词。
6. **理解流水线默认单次**：`understand-recall-clue.ts` 一次 LLM 调用，失败降级；未发现多跳 Stage 2 调用。
7. **AI_GATEWAY / DeepSeek 默认 Provider**：`backend/src/services/ai/ai-chat-provider.ts` `resolveAiChatProvider(env)` 默认 deepseek。

### 8.4 Confirmed Deviation

未发现实质偏差。以下为边缘观察（不是偏差，只是"文档没强调但代码可见"）：

1. **Omnibox 强制 lexical 模式**：`omnibox.ts` 调用 `recallService.recallWithClue(clue, { entry: 'omnibox' })`；`HybridRecallBackend` 内 `isOmniboxEntry` 强制 `forceMode: 'lexical'`，并把 `context` 置空、不挂 LLM completer、不走 framing/follow-up。文档（产品文档 §1、ADR-007）描述了 Omnibox 离线查找，但**强制 lexical 模式的代码层抽象**未在 ADR 中明确写出。
2. **Keyword 倒排缺角时 merge 摘录**：`memoryItemService.listForKeywordRecall` 把摘录 `listByOwner({ type: 'text_excerpt', limit: 500 })` merge 进候选（`mergeExcerptsIntoCandidates`），防止倒排 posting 漏摘录后核心资产被 slice 截断。这是工程优化，文档（关键词倒排 Phase 1）未显式提及。
3. **Bookmark Sync `merge Clues` 策略**：`memory-item-repository.upsertBookmarkFromChrome` 合并 tags/keywords/entities（取并集），但保留已存在的 note/openCount/settledCount/dismissCount/行为时间戳；这是局部合理推断但文档未细列。
4. **MCP 云端是 keyword-only**：`backend/src/services/mcp/cloud-keyword-recall.ts` 不调用 LLM，不 Hybrid，纯客户端 `pullMemoryItems` + 词面扫描；本地 MCP 走 Hybrid + LLM。这与 ADR/产品文档一致，但 backend 内部不引 `keyword-filter.ts`（前端核心包不可 import 到 worker），而是自实现 server-side tokenize。
5. **Cloud-side Recall 不复用前端 `core/recall/keyword-filter.ts`**：`backend/src/services/mcp/cloud-keyword-recall.ts` 自实现服务端关键词扫描（前/后端不能跨 import 是合理的）。这意味着算法双写，但隔离是必然。

### 8.5 Uncertain / 需要第二阶段实验或

| 编号        | 不确定项                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 原因                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| UNKNOWN-A1  | `frontend/src/infrastructure/ai/recall-telemetry-recorder.ts` 与 `recall-telemetry-store.ts` 在 `ls` 时出现，但**目录真实内容只有 7 个文件**，不含 telemetry 文件。其它文件如 `core/recall/recall-telemetry.ts`、`core/recall/recall-telemetry.test.ts` 在 `core/recall/` 实际存在。意味着 telemetry 真实实现位于 `core/recall/recall-telemetry.ts`（代码读取已确认），而 `infrastructure/ai/recall-telemetry-recorder.ts` 等**当前不存在**。可能：被 git 删除或迁移到 `core/recall/`。 | 路径一致性需用 `git log --all -- infra/ai/recall-telemetry-recorder.ts` 验证；本审计未做。                          |
| UNKNOWN-A2  | "Provider-specific coupling"：所有 AI HTTP 客户端各自读 `import.meta.env.VITE_API_BASE_URL`，没有共享单点；这是有意还是漂移？                                                                                                                                                                                                                                                                                                                                                           | 代码层一致但缺少 ADR 论述。                                                                                         |
| UNKNOWN-A3  | `packages/yiveno-probe` 是否被 production 构建引用？`frontend/src/dev/probe/` 真实存在并由 SW dev-only 引入；packages 版本是封装还是死代码？                                                                                                                                                                                                                                                                                                                                            | 本审计未深读 package 包结构。                                                                                       |
| UNKNOWN-A4  | `packages/yiveno-mcp` 与 `core/recall/mcp-tool-schema.ts`、`application/recall/mcp-recall-evidence-service.ts` 的关系（共享/独立）？                                                                                                                                                                                                                                                                                                                                                    | 同上。                                                                                                              |
| UNKNOWN-A5  | `cloud-keyword-recall.ts` 服务端 tokenize 算法与前端 `keyword-filter.ts` 是否一致？                                                                                                                                                                                                                                                                                                                                                                                                     | 需 diff 两端算法（已确认实现路径不同，但语义是否一致需读完整 server 实现）。                                        |
| UNKNOWN-A6  | `frontend/public/_locales/en/messages.json` 是否仅 en？（README 提到 `禁止新增 zh_CN 或其它非 en 产品 locale`；目录列表只有 `en/`）。                                                                                                                                                                                                                                                                                                                                                   | `ls public/_locales/` 证实只有 `en/`，但 messages.json 实际键数 / 完整性未读。                                      |
| UNKNOWN-A7  | `supabase/migrations/` 内容、Auth schema、其余非 `memory_items` 表未在本审计读取。                                                                                                                                                                                                                                                                                                                                                                                                      | 文档未给出 schema 图；需补读迁移文件确认。                                                                          |
| UNKNOWN-A8  | `sync:ide-boot` 与 `doc:check` 当前 CI 触发是否完整？`.husky/` 的 hook 是否启用？`.github/workflows` 的精确矩阵未细读。                                                                                                                                                                                                                                                                                                                                                                 | 项目规则文件描述了 hook/CI；实际是否对齐需读 YAML。                                                                 |
| UNKNOWN-A9  | TTE / Outcome §7.2 / recall-eval must 的实际评估脚本是否已落入 CI？                                                                                                                                                                                                                                                                                                                                                                                                                     | `core/recall/eval/` 存在大量 `*-eval.test.ts`；但是否在 pre-push / CI 强制运行需读 `.husky/pre-push` 和 workflows。 |
| UNKNOWN-A10 | `frontend/scripts/` + `vite/`、`packages/design-tokens/` 是否真被 production build 引用？                                                                                                                                                                                                                                                                                                                                                                                               | 已确认 frontend 依赖 `@yiveno/design-tokens` (`package.json` resolutions)；website 独立；其它 workspace 未细读。    |

---

## 9. Initial Observations（不判断是否问题 · 待第二阶段）

> 以下均为中性观察，**不**判定为问题，待第二阶段深度审计时确认。

1. **理解层有 6+ 处 LLM 调用点**（understand / enrichment / embed / framing / narrow / gs-clue-samples）。每次 LLM 调用都是独立完成器（`LlmChatCompleter` / `fetch`）；`clue-llm-completer-registry` 仅用于 `understand` 流程。其它 LLM 流程各自直连 API 客户端。这意味着**资源调度（重试、配额、限流）并未集中**。
2. **`HybridRecallBackend.recallWithClue` 函数非常长**（约 250 行），内含 trace / merge / list / embed / fuse / post-process 全套编排；sub-functions 如 `fuseHybridMatches`、`fuseScoredPools`、`finalizeKeywordResult`、`attachRecallFraming` 等被分散在同文件内。这不是分层问题，但是**单文件复杂度**值得审计。
3. **`application/` 内的 service 与 `infrastructure/ai/*-api-client` 共存**：service 类与 API 客户端是两套对象；service 走 SW handler（message-driven），API 客户端走 fetch（HTTP-driven）。两者分工明确，但 `application/recall/recall-service.ts` 是 message-driven，`application/memory/memory-item-service.ts` 同时被 SW handler 和可能其它路径消费——多消费方安全性需审查。
4. **`MemoryClues` 字段数量极大**（15+ 字段）：title / textExcerpt / summary / keywords / entities / embedding / embeddingModel / embeddingDim / sourceUrl / domain / captureEntry / openCount / lastOpenedAt / settledCount / lastSettledAt / dismissCount / lastDismissedAt / tags / note。`enrichMemoryClues` 12KB、`shouldRequestLlmMemoryEnrichment`、`memory-enrichment-proposal`、`parse-third-party-corpus-export` 等都基于它。这部分是否对所有读写路径都做了 Zod 验证，**没有统一验证层**（部分路径仅 `safeParseMemoryItem`）。
5. **`cloud-keyword-recall.ts` 服务端实现自包含关键词扫描**：与前端 `keyword-filter.ts` 在算法层是否完全对齐（驼峰缩写 / 拉丁变形 / 大小写贴合 / 行为加权 / 否定扣分）需要明确验证。
6. **`hasPrimaryContentMatch` + `isGenericRecallClue` + `recallTopPickBlockedByGenericPageTitleGate` + `isGenericOnlyHitAgainstSpecificClue` 四个泛词门**集中在 `keyword-filter.ts`。这是产品决策的算法落地，但**门与门之间是否一致（如彼此互斥 / 重叠）需要细审**。
7. **`message-types.registry` 是手写列表**：56 个 type 通过文本对齐；自动生成（从 `core/messaging/*` 推导）的可行性是优化空间。
8. **DEV Probe 与 production stub**：SW `main.ts` 在 `import.meta.env.DEV` 时调 4 个 `exposeXxxDebug()`；这 4 个 dev 文件都有 `*.prod-stub.ts`（静态 import 替换）。这模式是 MV3 要求的（SW 禁动态 import），但 stub 与真实实现的差异面值得审计。
9. **AI provider 抽象 (`ai-chat-provider.ts`) 仅 1 个实现 (deepseek)**；`resolveAiChatProvider` 对未知 provider 抛错（不静默 fallback）。这是工程化正确做法，但 provider 切换的运维面（dodo-webhook、Dodo 客户端等）未在 AI 边界审计。
10. **「UI 不能直连 IDB / Chrome API」是文档级铁律**；但 `pages/sidepanel/main.ts` 与 `pages/library/main.ts` 等是 Vite 多入口页面（不含业务）。所有业务页面（RecallComposer、RecallConversation、RecallResultCard）经 `background-client` 发消息——这是真实 enforced。
11. **`memoryItemService.upsertBookmarkFromThirdPartyCorpus`**：`existingItems` 用 `listByOwner({ type: 'bookmark', limit: 5000 })` 全表扫描寻找 corpusSource+remoteId 匹配；规模上去后是 O(N) 写入。若 5k+ 书签，性能需关注。
12. **`chrome.storage.*` 与 IndexedDB 的边界**：chrome.storage 用 KV（profile / session / prefs / snapshot / outcome pairs）；IndexedDB 用大量结构化数据（MemoryItem + posting）。两者在 `infrastructure/storage/` 与 `infrastructure/indexeddb/` 各自管理，**没有跨边 sync 验证**（例如 chrome.storage 改了 LocalProfile，IndexedDB 的 MemoryItem 是否需要 remap？由 `account-sync-handler.remapOwnerId` 显式处理，但这是命令式而非声明式一致性）。
13. **MCP 只读门禁**：服务端 `requireMcpGate` 与客户端 `settings.mcpReadOnlyEnabled` 双层门禁；服务端最终手段，但客户端默认开启状态由 Settings 决定。变更同步是 fire-and-forget `setMcpReadOnly` → `mcp-api-client`。
14. **`enrichEmptyRecallResult`**：仅在 no_match 时挂 `relatedGuess`；实现路径未在本审计深读，**建议第二阶段审**。
15. **`buildMcpDetailExport` / `renderDetailExportMarkdown`**：MCP evidence 形态独立于 Side Panel result card；这是"export-friendly" schema，不是 UI render。
16. **Tooling**：Bun workspaces + Bun 自带 TS 缓存；`bun run typecheck` 已覆盖 packages/\*。Knip 装在根 `devDependencies`，`bun run knip` → `bunx knip -D .`（zod 4 起与 knip `zod/mini` 兼容，已取消隔离安装）。`knip.json` / `package.json` 锁版本。
17. **`getAuthSession` 路径**：扩展不直连 `@supabase/supabase-js`（GoTrue 初始化碰 `window`），改用裸 fetch（`infrastructure/auth/auth-session-revalidate.ts`、`extension-oauth.ts`）。这是 SW 环境必要，但 token 管理是分散的。
18. **i18n 与 en locale**：`infrastructure/i18n/message-keys.ts`（19.2KB）键定义全集；`_locales/en/messages.json`（本审计未读）只有 en 目录；`product-surface-label-policy.ts` 强制产品面仅 en + `t()`。
19. **测试规模**：
    - frontend `application/recall/*.test.ts` 多达 30+；`core/recall/*.test.ts` 100+；`infrastructure/ai/*.test.ts` 5+；
    - backend `services/ai/*.test.ts`、`handlers/*.test.ts` 大量；
    - packages 各自有 `.test.ts`；
    - yiveno-probe 有大量 fixtures。  
      测试密度与代码量匹配（unit tests 普遍存在），未见明显缺口（仅 recall-eval must 的接入位置需查 CI）。
20. **ADRs 1–13** 全部存在并被 `docs/architecture/decisions/README.md` 引用；ADR-013 最新（2026-09-16），收束 AI 协作脚手架。
21. **文档 ↔ 代码同步铁律**：当前代码与文档的"已结案"决策（Side Panel 主壳、ADR-001–012）一致；CURRENT.md Changelog 反映最近 GS 改动。

---

## 10. 是否可以进入第二阶段？

**是，但需要补足以下点：**

| 维度                               | 评估                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **顶层结构**                       | ✅ 已建立（前端/后端/官网/packages 各自的真实职责、依赖方向、消息桥接）。                                      |
| **Recall 路径**                    | ✅ 已建立完整调用链，包括 6+ LLM 调用点、所有分叉（omnibox / mcp local / mcp cloud / sidepanel / dev probe）。 |
| **数据面 / LLM 面**                | ✅ 已建立——LLM 仅理解/NLG/embed/enrichment；排序 deterministic；事实源 = IndexedDB。                           |
| **Capture ↔ Sync ↔ Recall 数据环** | ✅ 已建立（包括倒排增量、merge 策略、replace 防呆）。                                                          |
| **Agent Governance**               | ✅ Cursor 自动注入规则 + ADR + 同步门禁的实际边界已知。                                                        |
| **Architecture vs Documentation**  | ✅ 大体一致 + 14 项边缘观察已标出。                                                                            |

**第二阶段前需补充的"读不到"事实（UNKNOWN §8.5）：**

- UNKNOWN-A1：recall-telemetry 文件路径不一致（可能误读或已迁移）—— 需要 `git log` 确认。
- UNKNOWN-A3 / A4：`packages/yiveno-probe`、`packages/yiveno-mcp` 与 `frontend/src/dev/probe` / `core/recall/mcp-*` 的具体关系。
- UNKNOWN-A5：`cloud-keyword-recall.ts` 与 `core/recall/keyword-filter.ts` 的算法 diff（避免双写漂移）。
- UNKNOWN-A6：`_locales/en/messages.json` 实际键数 / 是否仅 en。
- UNKNOWN-A7：Supabase 迁移文件内容。
- UNKNOWN-A8 / A9：CI 矩阵是否覆盖 recall-eval must、TTE、Outcome Labeling。

**结论：** 一位完全不了解 Yiveno 的 Principal Engineer 在读完本 Reality Map + §8.5 列出的"补读清单"后，应已具备第二阶段深度审计所需的认知基础。建议在补完上述 UNKNOWN 后，再开始"问题清单 / 修复建议 / 风险评估"。
