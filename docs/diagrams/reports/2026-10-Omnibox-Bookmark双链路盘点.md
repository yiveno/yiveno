---
created: 2026-10-31T00:59:14+08:00
updated: 2026-10-31T00:59:14+08:00
author: agent:cursor
scope: Mermaid 第九阶段 · Omnibox Offline Recall vs Bookmark Chrome→IDB Ingest 双链路对比盘点（只报告、不新增图、不改 Registry/业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/reports/2026-10-Normative文档引用路径校准.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/decisions/ADR-007-omnibox-offline-lookup.md
  - docs/architecture/decisions/ADR-017-cloud-sync-excerpt-only.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/background/listeners/omnibox.ts
  - extension/src/application/recall/backends/hybrid-recall-backend.ts
  - extension/src/application/capture/chrome-bookmark-sync-service.ts
  - extension/src/background/listeners/chrome-bookmark-sync.ts
downstream:
  - docs/diagrams/reports/（后续若补图：runtime.omnibox-offline-recall / runtime.bookmark-chrome-ingest）
---

# Omnibox / Bookmark Ingest 双链路盘点（2026-10-31）

> **本轮约束：** 只调查、对比、排优先级；**不**新增/改 Mermaid、**不**改 Registry、**不**改业务代码/测试/ADR、**不**扩 sync 脚本。  
> **口径：** 已实现 / 已设计未实现 / 证据不足 分列；不以盘点草案分数代替源码。

---

## 0. 一句话结论

两条链路**都已实现**且**散文/ADR 覆盖偏深**，但**均无独立登记图**。Omnibox 与 Side Panel 共用 `HybridRecallBackend`，靠 `entry: 'omnibox'` 钉天花板——**改 Hybrid 时最易漂**。书签灌库是 Capture 划词图的**旁路主库存路径**，体量大、门禁多，易与云 sync / `CAPTURE_BOOKMARK` 混淆。  
**建议优先补图：Omnibox（P1-1）**；其次 Bookmark Ingest（P1-2）。**不**合并成一张图。

---

## 1. 链路 A：Omnibox Offline Recall（实际流程）

### 1.1 入口与触发

| 项       | 证据                                                                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 注册     | `registerOmniboxListeners()` · `omnibox.ts`                                                                                                              |
| 输入变化 | `chrome.omnibox.onInputChanged` → `recallService.recallWithClue(clue, { entry: 'omnibox' })` → `recallResultToOmniboxSuggests` → **单次** `suggest(...)` |
| 确认     | `onInputEntered`：handoff CTA / 占位 id 打开 / 直链 URL / 默认行 Top Pick 快跳                                                                           |
| 过期     | `inputChangedRequestId` 丢弃过期结果；**禁止**异步前 `suggest([])`（注释：会吞后续真实结果）                                                             |

### 1.2 处理链路（相对 Side Panel）

```text
Omnibox text
 → recallService（mode 标 omnibox_local；旧称 omnibox_offline）
 → HybridRecallBackend(entry=omnibox)
      · 无 dialog context / 无可见进展
      · understand：forceMode lexical，不注入 LLM completer
      · 检索：finalizeKeywordResult（skipOutcomePairs + behaviorProfile omnibox）
      · 禁止 fuseHybridMatches / requestWorkerEmbeddings（单测钉死）
 → SuggestResult ≤ OMNIBOX_SUGGEST_LIMIT(6)
 →（CTA）openRecallSidePanel 先于 await storage → writeRecallPrefill → Panel 完整 Hybrid
```

### 1.3 「离线」边界（勿夸大）

| 含义       | 事实                                                                                    |
| ---------- | --------------------------------------------------------------------------------------- |
| **是**     | 本路径**不**调线索 LLM；**不**做 clue/Topic embed 融合 / RRF；**不**读 Outcome 对       |
| **是**     | 依赖本机 IndexedDB Memory（倒排/扫表）——无库则无快跳                                    |
| **不是**   | 「完全不碰网络」：CTA 开 Panel 后走完整 Hybrid（可 LLM）；增量书签 embedding 等是别链路 |
| **已拆除** | Omnibox 查询侧 fuzzy 灰名单（2026-10-30 · ADR-005）                                     |

### 1.4 异常 / 降级 / 取消

- 空 clue：default Tip + `suggest([])`
- 处理失败：log + `suggest([])`
- 无命中：default Tip + 可点 handoff CTA（非 default 行误触接力）
- 默认行确认且无导航 Top Pick：**忽略**（须点 CTA）
- SW 休眠丢 `lastOmniboxLookup` → 回车可再跑一轮 offline lookup

### 1.5 共享 vs 独立

| 共享                                                                       | 独立                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `recallService` / `HybridRecallBackend` / 关键词编排 / 约束·佐证·soft rank | `omnibox.ts` listener、`omnibox-suggest.ts`、手势优先 handoff、条数常量、无 Outcome 会话 |
| `memoryItemService.recordOpen`（书签落点）                                 | 与 Side Panel messaging / 可见进展 / 多轮 dialog **无关**                                |

### 1.6 实现状态

| 能力                                   | 状态                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| 离线 lexical 快跳 + suggest + CTA 接力 | **已实现**（ADR-007 · 运行时 §3.5 · 单测 `omnibox-recall-entry` / `omnibox.test`） |
| Omnibox Semantic / LLM / Outcome       | **禁止**（天花板 · 非 planned）                                                    |
| 独立登记 Mermaid                       | **无**（仅 open 图挂 `omnibox.ts` 作对照）                                         |

---

## 2. 链路 B：Bookmark Chrome → IDB Ingest（实际流程）

### 2.1 入口与触发

| 机制            | 证据                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| 门禁            | `chromeBookmarkIngestEnabled`（默认关；GS Import / Settings）                              |
| 增量            | `bookmarks.onCreated/Changed/Removed/Moved` → `chrome-bookmark-sync.ts` → service handlers |
| 导入未完成      | 事件入队 session pending；完成后 `flushPending`                                            |
| bulk            | GS / Settings → `ensureChromeBookmarksImported`（本盘点不展开 UI）                         |
| holes reconcile | 补「Chrome 有、Memory 无」                                                                 |
| full repair     | SW 会话最多一次 + 每日 alarm；upsert 含软删复活；保留 note/行为计数                        |
| 关灌库          | 卸载 `on*`；**不删**已有书签 Memory                                                        |

### 2.2 写入链

```text
Chrome bookmarks API（树权威）
 → listener（须 ingest 开）
 → handleChromeBookmark*（门禁 / pending）
 → syncChromeBookmarkNode
      · http(s) 叶子 → memoryItemService.upsertBookmarkFromChrome
      · 非叶子/无 URL → softDeleteByChromeBookmarkId
 → IndexedDB MemoryItem type=bookmark（chromeBookmarkId 键）
 → 增量可 scheduleAsyncMemoryEmbedding（bulk/reconcile 不刷）
```

**禁止：** 写回/改写/删原生 Chrome 书签；云同步书签（ADR-017）；把 `CAPTURE_BOOKMARK` 当主入口。

### 2.3 字段 / 去重 / 异常

| 主题           | 事实                                         |
| -------------- | -------------------------------------------- |
| 键             | `chromeBookmarkId` upsert；同 id 软删可复活  |
| 附注           | 复活/更新保留 `clues.note`（repository）     |
| 层级           | 文件夹不进 Memory 叶子；树 UI 另读 Chrome    |
| 删除           | Chrome remove → Memory 软删                  |
| 第三方导入书签 | 无 `chromeBookmarkId` → full repair **不动** |
| 配额           | IndexedDB 写配额耗尽：本会话跳过后续灌库     |
| 不上云         | ADR-017；**仍进本机库 → Recall 可检索**      |

### 2.4 与划词 Capture

|            | 划词 Capture                       | 书签 Ingest                     |
| ---------- | ---------------------------------- | ------------------------------- |
| 入口       | messaging / 右键直调               | Chrome `bookmarks.on*` / bulk   |
| 类型       | `text_excerpt`                     | `bookmark`                      |
| 登记图     | `runtime.capture-excerpt-sequence` | **无**                          |
| enrichment | 新建可调度 LLM                     | bulk **不**烧 LLM；增量可 embed |
| 云         | Pro 可同步摘录                     | **不上云**                      |

### 2.5 实现状态

| 能力                                             | 状态                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| 增量 + bulk + reconcile + full repair + 每日闹钟 | **已实现**（产品 §书签对账 · service ~546 行） |
| 双向写回 Chrome / 云并书签林                     | **禁止**（非 planned）                         |
| 独立登记 Mermaid                                 | **无**                                         |

---

## 3. 关键源码与测试

| 域       | 路径                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Omnibox  | `listeners/omnibox.ts` · `omnibox-suggest.ts` · `hybrid-recall-backend.ts` · `omnibox-recall-entry.test.ts` · `omnibox.test.ts` · ADR-007 · 运行时 §3.5                             |
| Bookmark | `listeners/chrome-bookmark-sync.ts` · `chrome-bookmark-sync-service.ts` · `memory-item-repository` upsert/软删 · `chrome-bookmark-repair-alarm` · 产品灌库/对账 Normative · ADR-017 |

---

## 4. 对比评价（有证据）

| 维度           | Omnibox                                                                 | Bookmark Ingest                                                         |
| -------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **业务重要性** | 地址栏快跳入口；接力完整找东西；非主壳但高频                            | 冷启动燃料 / GS 书签首召 / 本机配角库存；无库则 Omnibox/Recall 书签面空 |
| **实现复杂度** | listener+suggest 中等；**语义分叉埋在 Hybrid 大文件**                   | listener+service+bulk+pending+repair+alarm；状态面更大                  |
| **变化频率**   | 近月：soft rank、fuzzy 拆除、CTA 手势；触天花板即改                     | 近月：full repair 闹钟、壳空态燃料；触门禁/对账                         |
| **漂移风险**   | **高**：易把 Side Panel 能力画进 Omnibox；改 Hybrid 漏 `isOmniboxEntry` | **中高**：易画成 Capture / 云 sync；主路径被 `CAPTURE_BOOKMARK` 误导    |
| **文档覆盖**   | ADR-007 + §3.5 散文**强**；**无** registry 图 Brief                     | 产品对账条 + 运行时入口表**强**；Capture 图有警告；**无**独立图         |
| **图表价值**   | **高**：一张薄 sequence 钉 `entry` 天花板 + handoff，防 Hybrid 误接线   | **中高**：钉 Chrome→IDB 与划词分轨；散文已较长，图作 Brief 钩子         |

---

## 5. 优先级决策

1. **Omnibox 值得独立图** — 是（建议 id `runtime.omnibox-offline-recall` · sequence · implemented）。
2. **Bookmark Ingest 值得独立图** — 是（建议 id `runtime.bookmark-chrome-ingest` · sequence · implemented）。
3. **先做** — **Omnibox**：与现行 `recall-sidepanel-sequence` / Hybrid 同文件纠缠，漂移伤害更直接；全局盘点亦把「变更更频繁者」作排序信号。
4. **可否合并** — **否**。共享仅「listener 直调、旁路 UI messaging」层模式；域不同（Recall 入口 vs 库存灌库）。可在 system-overview 用标签互指，不合成一张时序。
5. **不值得画** — Omnibox suggest XML/快捷键缓存细节；书签 bulk 进度 UI；embedding 队列内部；文件夹树只读 UI；已禁止的云书签并集。

### 推荐落地顺序（下一阶段，本轮不执行）

| 序  | 动作                                                                           |
| --- | ------------------------------------------------------------------------------ |
| 1   | 补 `runtime.omnibox-offline-recall`（天花板 + CTA 接力 Note；禁画 LLM/RRF）    |
| 2   | 补 `runtime.bookmark-chrome-ingest`（门禁 + on* + upsert/软删 + ≠ Capture/云） |
| —   | Billing / GS 全图仍按全局盘点 P2，本报告不升格                                 |

---

## 6. 文档缺口与语义风险

| 风险                 | 说明                                                           |
| -------------------- | -------------------------------------------------------------- |
| Omnibox「离线」误解  | 读者以为零网络 / 零本机依赖；实际 = 无 LLM/无向量融合 + 本机库 |
| Omnibox = Side Panel | 共用 backend 类名；须图上钉 `entry` 与禁止项                   |
| 书签 = Capture 图    | Capture Mermaid 不含灌库；仅散文警告                           |
| 书签不上云 = 不入库  | ADR-017 只限云面；本机 Recall **可**命中书签                   |
| Registry             | 无两条独立 id → Brief/`docs:sync-diagrams --id` 钩子缺失       |

---

## 7. 未解决问题

| 项                                   | 状态                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Omnibox 是否偶发仍走某条 hybrid 旁路 | 主路径 `else if (isOmniboxEntry)` 已钉 keyword；约束邻域支路仍共享 `finalizeKeywordResult`——**未**再拆图验证每条 early-return |
| bulk import 与 GS 进度 UI 细节       | **故意不深挖**（属 B9；本链路只钉 Chrome→IDB）                                                                                |
| `CAPTURE_BOOKMARK` 现存调用面        | 产品称非日常主入口；**未**全仓枚举是否仍有 UI 入口                                                                            |
| 本轮是否补图                         | **否**（Brief 禁止）                                                                                                          |

---

## 8. 验证 / Diff 边界

| 项                           | 结果                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| 新增/修改 Mermaid / Registry | **未做**                                                      |
| 业务代码                     | **未改**                                                      |
| 本文件                       | `docs/diagrams/reports/2026-10-Omnibox-Bookmark双链路盘点.md` |
| `docs:check-diagrams`        | 本阶段未改图；未强制重跑（可选）                              |

### 停止线

按 Brief：**完成后停止**，等待下一阶段指示（若开补图，默认先 Omnibox）。
