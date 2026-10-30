---
created: 2026-10-31T00:17:12+08:00
updated: 2026-10-31T00:19:36+08:00
author: agent:cursor
scope: Mermaid 第四阶段 · Capture / Open 登记图逐边语义复审（改图 + 报告；不新增图、不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/content/selection-toolbar/main.ts
  - extension/src/background/listeners/context-menu.ts
  - extension/src/background/handlers/memory-handler.ts
  - extension/src/application/memory/memory-item-service.ts
  - extension/src/pages/sidepanel/SidePanel.vue
  - extension/src/pages/detail/Detail.vue
  - extension/src/pages/library/Library.vue
  - extension/src/background/listeners/omnibox.ts
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（codePaths / notes）
---

# Capture / Open 图表语义复审（2026-10-31）

> **本轮约束：** 只审 `runtime.capture-excerpt-sequence` / `runtime.open-record-sequence`；有证据才改 Mermaid；**不**新增图、**不**改业务代码、**不**开下一阶段补图。  
> **口径：** 代码事实与 Normative 预期分列；不确定处标明，不猜边。

---

## 0. 一句话结论

两张图主路径（UI messaging → handler → `memoryItemService` → IDB）原先基本正确，但相对现行代码有可证实漂移：**Capture 漏画 `scheduleAsyncMemoryEmbedding` 与不可存页早退**；**Open 漏画 Side Panel 进 Detail 时延记 open**，且易被读成「所有入口都走 `RECORD_MEMORY_OPEN`」。已按代码改图并钉范围注记；书签 Chrome→IDB、Outcome settled **未**混入本图。

---

## 1. 审阅对象

### 1.1 登记图

| id                                 | kind     | status      | 本轮处置                                        |
| ---------------------------------- | -------- | ----------- | ----------------------------------------------- |
| `runtime.capture-excerpt-sequence` | sequence | implemented | **改图**（embedding / 早退 / 范围 Note）        |
| `runtime.open-record-sequence`     | sequence | implemented | **改图**（Detail 延记 alt / open≠settled Note） |

**未改、未新增：** Recall / dismiss / system-overview / Turnstile；书签 ingest 图、Outcome 全通道图（盘点序 2+，本轮停止）。

### 1.2 文档

| 路径                                                        | 用途                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md`   | 序 1 触发；风险「中 / 中低」                                  |
| `docs/engineering/Yiveno-Mermaid图表规范.md`                | 代码优先；不确定不编边                                        |
| `docs/architecture/Yiveno-运行时架构流程-v1.md` §3.1 / §3.3 | 宿主 + 散文入口表                                             |
| `docs/product/Yiveno-产品文档-v4.0.md`                      | Capture enrichment 插座；§7.2 open≠settled / 裸 open≠verified |
| `docs/diagrams/registry.json`                               | 锚点 / codePaths                                              |

### 1.3 源码与测试（代码事实）

| 主题            | 路径                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 划词 / 快捷键   | `content/selection-toolbar/main.ts`（`captureTextExcerpt`；`captureEntry` = `selection_toolbar` / `shortcut` / `getting_started`）       |
| 右键            | `listeners/context-menu.ts` → `captureTextExcerptFromContextMenu`（**不经** BC）                                                         |
| 消息分发        | `message-handler.ts` · `memory-handler.ts`（`CAPTURE_UNSAVABLE_PAGE` 早退）                                                              |
| 落库 + 异步     | `memory-item-service.captureTextExcerpt` → `createTextExcerpt` + **双调度** enrichment / embedding                                       |
| enrichment 跳过 | `schedule-async-memory-llm-enrichment.ts`（关 AI / 配额 / `shouldRequestLlmMemoryEnrichment` / 失败降级）                                |
| Open UI         | `SidePanel.vue`（`detail.html` **跳过** record）、`Library.vue`、`Detail.vue`（仅 `text_excerpt`）                                       |
| Open Omnibox    | `omnibox.ts` `recordOpenBestEffort` → **直调** `memoryItemService.recordOpen`                                                            |
| 单测            | `memory-item-service.test.ts`、`capture-text-excerpt-service.test.ts`、`schedule-async-memory-llm-enrichment.test.ts`、`omnibox.test.ts` |

**未改业务代码。**

---

## 2. 是否与当前实现一致

### 2.1 `runtime.capture-excerpt-sequence`

| 判定     | 说明                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| **改前** | messaging 主链顺序正确；**漏** embedding 调度；**未**标不可存页早退；enrichment 一行过扁；范围依赖散文才知「不含右键/书签」 |
| **改后** | 与 `handleCaptureTextExcerpt` + `captureTextExcerpt` 一致；异步双队列与 skip 语义有 Note；明确本图 = 划词 messaging         |

**故意不画进本图（有证据、属范围纪律）：**

- 右键 listener 直调（散文表 + 图前 Note）
- 书签 `chrome-bookmark-sync` / `upsertBookmarkFromChrome`（**不**经 `captureTextExcerpt`；bulk **不**调度 LLM）
- enrichment / embed 队列内部状态机（配额熔断、donor reuse、Worker 路径细节）

### 2.2 `runtime.open-record-sequence`

| 判定     | 说明                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| **改前** | UI→`RECORD_MEMORY_OPEN`→`recordOpen`→IDB 正确；**漏** Side Panel→Detail 延记；**未**在图上钉 Omnibox 旁路与 open≠settled |
| **改后** | messaging 路径 + Detail 延记 alt 与代码一致；旁路/settled 用 Note，避免把散文表误画成单图全入口                          |

**故意不画：** Omnibox 完整时序（listener 直调一行 Note 足够）；`RECORD_RECALL_SETTLE` / Found 通道（属 Outcome 补图候选，非本图）。

---

## 3. 发现的问题与证据

### 3.1 Capture

| #   | 问题                                                         | 证据                                                                                                                        | 处置                                 |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | 落库后只画 enrichment，**漏** `scheduleAsyncMemoryEmbedding` | `memory-item-service.ts` `captureTextExcerpt`：两行 `schedule*` 连续调用                                                    | **改图**补第二行                     |
| C2  | 缺 `CAPTURE_UNSAVABLE_PAGE` 早退                             | `memory-handler.handleCaptureTextExcerpt`：`isSavablePageUrl` 失败直接 `toErrorResponse`，未调 APP                          | **改图** `alt`                       |
| C3  | enrichment 失败/跳过路径不可见                               | `runAsyncMemoryLlmEnrichment`：`aiFeaturesEnabled` / 配额 / summary 门禁 → `skipped`；catch → `failed`；均不挡 Capture `ok` | **Note**（不展开队列）               |
| C4  | 易与书签灌库 / 右键混淆                                      | 盘点 §4 B2；`context-menu` 直调；`upsertBookmarkFromChrome` 不经本 service 调度                                             | **图前范围 Note** + 散文补 embedding |
| C5  | `put` 同步倒排 diff 未提                                     | `memory-item-repository.put` → `keywordIndexRepository.applyItemTokenDiff`                                                  | **IDB 边文案**补一句                 |

### 3.2 Open

| #   | 问题                                               | 证据                                                                                            | 处置                                                                     |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| O1  | Side Panel 进 Detail **不发** `RECORD_MEMORY_OPEN` | `SidePanel.vue`：`if (openUrl.includes('/detail.html')) return`；`Detail.vue` ready 时再 record | **改图** `alt` + 散文落点表                                              |
| O2  | 图像「凡 open 必经 message」                       | Omnibox：`recordOpenBestEffort` → `memoryItemService.recordOpen`                                | **图前 Note**；registry 挂 `omnibox.ts` 作对照路径                       |
| O3  | 与 settled 易混                                    | 产品 §7.2：裸 open ≠ verified；`RECORD_RECALL_SETTLE` 另通道；宿主 §3.3 原则已写                | **图前 Note**；边文案强调不改 `updatedAt`                                |
| O4  | Detail bookmark 不写 open                          | `Detail.vue`：仅 `type === 'text_excerpt'` 时 record；否则 `wrong_type`                         | 散文表已有；图用「Detail 摘录 ready」表述，**未**另画 wrong_type（低频） |

### 3.3 设计（Normative）vs 实现

| 项                                                     | 结论                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Capture 后稀疏 LLM enrichment                          | Normative 与代码一致；图曾漏 **并列** embedding 调度（实现事实，产品 Hybrid 行亦依赖向量） |
| open ≠ settled / 裸 open ≠ Verified                    | Normative §7.2 与代码分计一致；旧图未强调 → 补 Note                                        |
| **未发现**「Normative 写 A、代码做 B」须用图掩盖的冲突 | —                                                                                          |

---

## 4. 修改内容与原因

| 路径                                            | 改动                                                                                                | 原因                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------- |
| `docs/architecture/Yiveno-运行时架构流程-v1.md` | Capture sequence：`alt` 不可存页；双 `schedule*`；enrichment Note；范围 Note；散文补 embedding      | C1–C5                  |
| 同上                                            | Open sequence：Detail 延记 `alt`；`updatedAt` / `MEMORY_NOT_FOUND`；范围 Note；落点表 Side Panel 行 | O1–O3                  |
| 同上                                            | 文首状态条挂本报告链接                                                                              | 可追溯                 |
| `docs/diagrams/registry.json`                   | 两图 `codePaths` / `notes`；`updated: 2026-10-31`                                                   | Brief 锚点对齐实现文件 |

**稳定保留：** 图 id、锚点注释、participant 短 id（`UI`/`BC`/`MH`/`MHB`/`APP`/`REPO`/`IDB`）。

---

## 5. 尚未确认 / 刻意折叠

| 项                                                                | 状态                                                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| enrichment / embed 入队后 Worker 配额与 auth 熔断细节             | **折叠**；以 schedule 模块为准，不进 Capture 时序                                       |
| Side Panel `outcomeSession.opens` 与 IDB `openCount` 的会话内关系 | **未画**；telemetry / Outcome 会话态，非 `RECORD_MEMORY_OPEN` 本体                      |
| Getting Started 页划词是否另有旁路（非 toolbar messaging）        | **已确认**同走 `captureTextExcerpt` + `captureEntry: getting_started`                   |
| 是否存在第二处 UI 打开摘录却既不经 Detail 也不 record             | **本轮未全仓穷尽**；以 Side Panel / Library / Detail / Omnibox 四落点为准；不确定不扩边 |
| 书签 ingest 端到端                                                | **故意不画**（盘点 P1-2 候选）                                                          |

---

## 6. 检查与 Git Diff

### 6.1 命令

```bash
bun run docs:check-diagrams
```

**结果（2026-10-31）：** `✅ diagrams 校验通过（10 张）· docs/diagrams/registry.json`

### 6.2 本轮触及路径（相对工作区）

| 路径                                                        | Git 状态（审阅时）                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/architecture/Yiveno-运行时架构流程-v1.md`             | 已跟踪修改（两张 Mermaid + §3.1/§3.3 散文 + §5 表 enrichment/embedding） |
| `docs/diagrams/registry.json`                               | 未跟踪目录内（扩 codePaths / notes；`updated: 2026-10-31`）              |
| `docs/diagrams/reports/2026-10-Capture-Open图表语义复审.md` | 本文件（新增）                                                           |

**未改：** 业务源码、产品 Normative 契约条文、其它 8 张登记图。

### 6.3 停止线

按 Brief：**本轮完成后停止**，不自动开始盘点序 2（auth mint/handoff 补图）及后续项。
