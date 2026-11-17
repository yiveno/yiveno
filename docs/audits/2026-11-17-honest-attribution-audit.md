---
created: 2026-11-17T20:57:40+08:00
updated: 2026-11-17T22:40:28+08:00
author: agent:cursor
scope: docs/audits · 用户可见失败/空态/降级诚实归因
status: 本批结案
upstream: ADR-026；Yiveno-产品文档-v4.0.md §7 诚实归因军规
downstream: extension i18n / background-error / Side Panel miss / deeper-reading tip
---

# 诚实归因审计（2026-11-17）

## 1. Stage 0 定锚（实测）

| 项                    | 实测                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| HEAD                  | `19d92919`（提示词预期 `d0bd4ebc` 已前移；Decider 评测已合入，工作区初态干净）       |
| test:must             | 127 passed                                                                           |
| test:run              | 1649 passed（改前基线）                                                              |
| i18n:check            | 747 → 本批后 766 keys                                                                |
| typecheck:ci          | 0 errors                                                                             |
| lint:check            | 基线红：7 errors / 1 warning（sidepanel template key、hybrid shadow 等；与本批无关） |
| doc:check:all         | ok                                                                                   |
| knip                  | exit 0                                                                               |
| worker test           | 199 pass                                                                             |
| live INTENT_EVAL_MUST | 38/38                                                                                |
| pressure:try          | 23/24（仅 p22）                                                                      |

§1–§6 背景核实：全部通过（`youtube`→video；miss 空库才给导入引导；hosted 抛无类型 Error；Worker 429/503 字段稳定；`RecallErrorCode` 仅 `RECALL_FAILED`；`listMemoryItems` 支持 type 过滤；`understandSource` 链完整）。

## 2. Stage 2–3 改动摘要（本批已修）

| 面                | 新 code / 字段                                                                          | 新/改 i18n                                                               |
| ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 线索 LLM 失败     | `ClueLlmFailureKind` + `HostedCompleteError`；`understandErrorKind` / `understandQuota` | tip 8 kind + 配额无数字退回 2 + unknown 沿用旧 key                       |
| 库非空·书签语料 0 | cold-start `bookmarkCount`；miss 追加段                                                 | `popup_miss_bookmarks_not_imported_*` / `popup_miss_bookmarks_importing` |
| 整轮 Recall 失败  | UI 离线分流（未扩 RecallErrorCode 枚举）                                                | `popup_recall_failed_offline`；收紧 `popup_recall_failed`                |
| 书签导入          | `BOOKMARK_IMPORT_READ_FAILED` / `WRITE_FAILED`                                          | `error_bookmark_import_*`；GS 失败正文走映射                             |
| 增量同步          | `SYNC_INCREMENTAL_OFFLINE`                                                              | `settings_error_sync_incremental_offline`                                |
| 配额加载          | `AI_HOSTED_QUOTA_OFFLINE`；`AI_HOSTED_QUOTA_FAILED`→server 文案                         | `settings_ai_quota_failed_offline` / `_server`                           |

## 3. 全量 key 清单（失败/空态相关 focus）

判定：

- **已具体**：文案已报可行动原因，本批不动。
- **本批已修**：见上表。
- **暂缓**：调用点缺结构化原因，或改它需动行为/另批领域。

### 3.1 本批已修

| key                                                   | verdict                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| `sidepanel_recall_deeper_reading_*`（除 unavailable） | 本批已修                                                   |
| `sidepanel_recall_deeper_reading_unavailable`         | 保留作 `unknown` 兜底（须日志）                            |
| `popup_miss_bookmarks_*`                              | 本批已修                                                   |
| `popup_recall_failed` / `popup_recall_failed_offline` | 本批已修                                                   |
| `error_bookmark_import_read_failed` / `write_failed`  | 本批已修                                                   |
| `popup_import_failed_fallback`                        | 仍作 BOOKMARK_IMPORT_FAILED 兜底；文案已够行动（重载扩展） |
| `settings_error_sync_incremental_offline`             | 本批已修                                                   |
| `settings_ai_quota_failed_offline` / `_server`        | 本批已修                                                   |
| `settings_ai_quota_failed`                            | UI catch 在线未知兜底；须日志                              |

### 3.2 已具体（不动 · 抽样代表）

`error_capture_empty_selection`、`error_capture_unsavable_page`、`error_bookmark_ingest_disabled`、`error_third_party_import_*`、`error_local_import_*`、`popup_reply_miss_missing_topic`、`popup_reply_miss_rejected_noise`、`popup_followup_miss_constrained_empty*`、空库燃料 `popup_empty_*`（含导入链）、`settings_error_sync_not_authenticated` / `sync_pro_required`、`sidepanel_voice_error_*` 等。

### 3.3 暂缓（须保留泛泛 + 说明）

| key                                                                       | 调用点                    | 缺什么                              | 下一步                                               |
| ------------------------------------------------------------------------- | ------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `error_memory_operation_failed`                                           | memory-handler 多处 catch | 捕获层多为统一兜底，未分 IDB/权限   | 按 handler 分支拆 MEMORY_* code（另批）              |
| `settings_error_load` / `settings_error_update`                           | Settings 读写             | 无离线/校验细分                     | 可选：离线 + Zod 校验失败 code                       |
| `settings_error_auth_*`（sign_in/out/state…）                             | account-sync              | 多为「无法…」无 HTTP/原因           | 接 Auth API 稳定 error 字段                          |
| `settings_error_sync_*`（merge/replace/status…）                          | account-sync              | 除 incremental 外未拆离线           | 同模式加 OFFLINE 或网络 kind                         |
| `settings_error_cloud_delete` / `account_delete` / `local_*`              | Settings 数据分区         | 服务端/本机失败未分                 | 按响应 status 拆                                     |
| `error_open_settings` / `library` / `account`                             | 打开页失败                | 仅 chrome.tabs 失败                 | 低优：权限拒绝 vs 其它                               |
| `popup_navigate_tab_failed`                                               | 打开原文                  | 同左                                | 低优                                                 |
| `getting_started_consent_failed`                                          | 写同意失败                | 非导入树失败                        | 可映射 SETTINGS_UPDATE                               |
| `getting_started_recall_failed` / `open_result_failed`                    | GS 页内 Recall            | 同 RECALL_FAILED 粗粒度             | 复用离线分流                                         |
| `error_gs_clue_samples_failed`                                            | GS 示意 clue              | Worker 失败未透传 kind              | 可复用 ClueLlmFailureKind                            |
| `error_cold_start_status_read_failed` / `error_import_status_read_failed` | 读状态                    | storage 失败无细分                  | 低优                                                 |
| `error_detail_export_operation_failed`                                    | detail export             | 剪贴板/下载未分                     | 低优                                                 |
| `sidepanel_website_connect_failed`                                        | 官网接通                  | 无 handoff 细分                     | 鉴权批次                                             |
| `popup_reply_miss` / `popup_reply_miss_after_simpler_pass`                | 库有书签仍 miss           | 真·检索空邻域；原因就是「不够接近」 | **保留**：再叠假原因会骗人；书签未导入已由追加段覆盖 |

**Chrome 书签持续同步（`chrome-bookmark-sync-service`）单条 flush 失败：** 仅打日志、不向用户 toast——属静默 fail-open / 可恢复队列；本批不强制 UI 打断。若日后要可见，需先定产品是否打扰。

## 4. 与触发案例对照

导入关 + 库有摘录非空 → 旧文案只说「试试另一个细节」→ 本批 ready+bookmarkCount=0+ingest_off 追加导入段；`rules_fallback` tip 按 kind。检索逻辑本身在书签入库后对 `youtube`→video 约束邻域可出结果（Stage 0 探针已证）。

## 5. 附录 Stage 2d（2026-11-17 · in-Recall 降级信号）

同一条诚实归因军规的应用：通用 miss 时可见「能力边界」——AI 关 / 未登录导致规则理解+无语义，或书签同步关导致新书签未进库。

### 5.1 新增摘要

| 面      | 内容                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 透传    | `RecallResult.understandMode`；`pickUnderstandAttributionFields` 附带 `understood.mode`                                                                                                    |
| 纯函数  | `resolveRecallDegradedReason`（非 rules → null；ai_off 优先于 not_signed_in；**lexical 后置**：无 completer 时 mode 恒 lexical，先挡会令降级段永不出现；有能力且 lexical 的纯 URL 仍不叠） |
| 探针    | cold-start：`signedIn`（复用 `loadGreetingIdentity`）、`aiFeaturesEnabled`、`unsyncedBookmarkCount`                                                                                        |
| 消息    | `GET_BOOKMARK_SYNC_STALENESS`（只计数不 upsert）                                                                                                                                           |
| miss 段 | `popup_miss_degraded_*` + `popup_miss_bookmarks_stale_prefix`；segment kind `open_ai_settings` / `open_account_settings`                                                                   |
| 深链    | `focusOrOpenSettingsTab({ section })` → `?section=ai` / `account_sync`                                                                                                                     |

### 5.2 #4 stale 检测与 tombstone

- 同步开或导入未完成 → `unsyncedCount: 0`（后台门控）。
- 否则：`readChromeBookmarkLeaves` − `listBookmarkSyncAlignment.byChromeBookmarkId`，**排除** `readChromeBookmarkDeleteTombstoneIds()`（alignment 不含软删，用户删过的 Chrome 叶子否则会误报为「未同步」）。
- 成本：全量书签对齐扫表；仅面板打开探针一次，不每轮 miss 重算。
- **#4 已上线**（未暂缓）。

### 5.3 本附录无新增暂缓项

与 §3.3 既有暂缓无关；本附录未引入新的「无法归因」泛泛文案。

## 6. 附录：代理路径 kind 归因修复（2026-11-17）

> 兑现 ADR-026 / 诚实归因军规已有决定：DEV IP 代理与 hosted 一样抛 typed `HostedCompleteError`。不改分类器、不新设 kind、不改 ADR-026 / 产品文档 §7。

### 6.1 根因

实测验证批 Stage 1 B：停本地 worker 后 tip 为 `sidepanel_recall_deeper_reading_unavailable`（kind=`unknown`），非 network 文案。

链：`clue-understand-api-client` fetch 失败原样抛 `TypeError` → understand `resolveClueLlmFailureKindFromError` 非 `HostedCompleteError` → `classifyClueLlmFailure({ errorName: 'TypeError' })` 无 status → `unknown`。分类器注释假设「网络失败由 hosted client 显式抛 network」——代理路径未履约。

### 6.2 修复点

仅 `extension/src/infrastructure/ai/clue-understand-api-client.ts`（`requestClueCompleteDetailed` 一处覆盖 plain/detailed）：

| 失败                      | 抛出                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TimeoutError / AbortError | `HostedCompleteError('timeout', 'clue_complete_timeout')`                                                                                                                                    |
| 其它 fetch 失败           | `HostedCompleteError('network', message \|\| 'clue_complete_network')`                                                                                                                       |
| 429 + `quota_exceeded`    | **直接** `quota_daily`（绕过 classify：clue 端点配额按 IP **按天**；classify 同字段会误判 `quota_monthly`）；**不带** quota 快照（无 `dailyUsed`/`dailyLimit`）→ UI `quota_daily_no_numbers` |
| 其它非 2xx                | `classifyClueLlmFailure({ status, workerError })` → typed；403 `clue_proxy_disabled` / 503 `ai_provider_unsupported` / 400 等诚实 `unknown`                                                  |
| 200 空 text               | `empty_response` / `clue_complete_empty`                                                                                                                                                     |

### 6.3 活测（A/B/A · clue `yesterday poem`）

| 轮                                  | 结果                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| A1 worker 开                        | 理解成「诗」「昨天」；无 tip                                                 |
| B worker 停 + 重载扩展清 parse 缓存 | tip 逐字：**「连不上云端理解服务，已改用本机规则理解。请检查网络后重试。」** |
| A2 worker 重启                      | tip 消失；理解恢复                                                           |

单测：`clue-understand-api-client.test.ts` 增 11 条 kind 映射（含 429→quota_daily 无快照、unsupported/proxy_disabled→unknown）。
