---
created: 2026-10-31T01:36:37+08:00
updated: 2026-10-31T01:36:37+08:00
author: agent:cursor
scope: Mermaid 第十四阶段 · Registry codePaths 映射质量审计（只报告；不改 registry / 图 / 业务代码 / impact 脚本）
status: done
upstream:
  - docs/diagrams/registry.json
  - docs/diagrams/README.md
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/diagrams/reports/2026-10-图表变更感知机制.md
  - scripts/diagram-change-impact.mjs
  - scripts/lib/mermaid-diagrams.mjs
downstream:
  - docs/diagrams/reports/（后续若收窄 codePaths 须新 Brief）
---

# Registry codePaths 映射质量审计（2026-10-31）

> **本轮约束：** 只审计；**不**改 `registry.json`、Mermaid、业务代码、impact 脚本。  
> **口径：** 实测 `docs:diagram-impact --paths` + 路径存在性；推测标 **待验证**；命中≠过时。

---

## 0. 一句话结论

15 图 **无缺失路径**、Auth/Sync/Outcome/Omnibox/Bookmark 主链 **文件级登记质量高**。主要问题是 **`runtime.dismiss-feedback-sequence` 的目录 `application/memory`（~17 文件）过宽**，以及 **`pages/sidepanel` 目录**被 Recall/Open/Dismiss 三图共用导致 UI 杂项误报。另有两处**可证实漏报**：`capture-text-excerpt-service.ts`、`chrome-bookmark-sync-pending.ts` 未登记。无 P0「路径指向已删文件」。

---

## 1. 映射质量总表（15 张）

图例：**优** = 入口准、宽度可控；**良** = 主入口齐、有可接受宽匹配或小漏；**中** = 明显误报或漏报需下阶段改；**概览** = 故意稀疏。

| id                                    | cps | 文件 | 目录 | 质量     | 主要漏报风险                                           | 主要误报风险                                             | 建议                                                             |
| ------------------------------------- | --- | ---- | ---- | -------- | ------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `turnstile.captcha-token-lifecycle`   | 3   | 3    | 0    | **优**   | 低                                                     | 与 Turnstile 兄弟图同命中（合理）                        | 保留                                                             |
| `turnstile.captcha-token-state`       | 2   | 2    | 0    | **优**   | 低                                                     | 同上                                                     | 保留                                                             |
| `turnstile.email-otp-e2e`             | 3   | 3    | 0    | **优**   | 低                                                     | 同上                                                     | 保留                                                             |
| `turnstile.secrets-split`             | 1   | 1    | 0    | **优**   | 低                                                     | 改 `turnstile.ts` 会连带其它 Turnstile 图                | 保留                                                             |
| `turnstile.china-dual-region-target`  | 2   | 2    | 0    | **优**   | planned 本就未接线                                     | 与 world 路径共享（notes 已声明）                        | 保留                                                             |
| `runtime.system-overview`             | 3   | 3    | 0    | **概览** | 域细节本就不挂                                         | 低                                                       | 保留稀疏；靠跨图导航                                             |
| `runtime.capture-excerpt-sequence`    | 7   | 6    | 1    | **良**   | **漏** `capture-text-excerpt-service.ts`（右键真入口） | `selection-toolbar/` ~9 文件（样式/滚动亦命中）          | 补 service 文件；目录可保留或收窄到 `main.ts`                    |
| `runtime.recall-sidepanel-sequence`   | 5   | 4    | 1    | **良**   | Hybrid 内算法文件故意不挂（可接受）                    | `pages/sidepanel/` ~22 文件                              | 长期可收为 `SidePanel.vue`+关键卡面；暂可留                      |
| `runtime.open-record-sequence`        | 6   | 3    | 3    | **良**   | repository 未单挂（经 service）                        | sidepanel/library/detail 三目录；sidepanel 杂项命中 open | 可保留目录；sidepanel 与 dismiss/recall 重叠需知悉               |
| `runtime.dismiss-feedback-sequence`   | 4   | 2    | 2    | **中**   | repository 仅靠宽目录                                  | **`application/memory` 整目录**；sidepanel 整目录        | **优先收窄** memory → `memory-item-service`（+ 可选 repository） |
| `auth.extension-session-mint-handoff` | 15  | 15   | 0    | **优**   | 登录迁移未挂（图范围故意排除）                         | `LoginForm` 与 Turnstile 同命中（合理）                  | 保留                                                             |
| `sync.excerpt-cloud-pro-gate`         | 12  | 12   | 0    | **优**   | 低                                                     | `account-sync-handler` 与 Auth 同命中（合理）            | 保留                                                             |
| `recall.outcome-settlement-channels`  | 8   | 8    | 0    | **优**   | 低                                                     | `memory-handler` / `background-client` 多图共享          | **范例**：`SidePanel.vue` 用文件非整目录                         |
| `runtime.omnibox-offline-recall`      | 6   | 6    | 0    | **优**   | 低                                                     | 与 open 共享 `omnibox.ts`（对照合理）                    | 保留                                                             |
| `runtime.bookmark-chrome-ingest`      | 10  | 10   | 0    | **良**   | **漏** `chrome-bookmark-sync-pending.ts`               | `memory-item-service` 多图命中（合理）                   | 补 pending；保留其余                                             |

**合计：** codePaths 条目 **87**；其中 **目录 7 处 / 涉及 4 张图**；**缺失路径 0**。

---

## 2. 目录级路径风险

| 登记目录                    | 约文件数 | 挂载图                  | 风险                                                                                      |
| --------------------------- | -------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `content/selection-toolbar` | ~9       | capture                 | **中低**：同域 UI；改 shadow CSS 也会触发 Capture 复核                                    |
| `pages/sidepanel`           | ~22      | recall / open / dismiss | **中高**：改滚动/卡面/测试也会三图齐中；Outcome **刻意**用 `SidePanel.vue` 文件，对照鲜明 |
| `pages/library`             | ~11      | open                    | **中**：库树 UI 非 open messaging 也会中                                                  |
| `pages/detail`              | ~2       | open                    | **低**                                                                                    |
| `application/memory`        | ~17      | **仅 dismiss**          | **高**：embedding / enrichment / quota / alignment cache 等与 dismiss **无关**仍命中      |

### 实测（`docs:diagram-impact --paths`）

| 输入                                                                         | 结果                                       | 判定                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| `…/memory/indexeddb-write-quota.ts`                                          | → **dismiss**                              | **误报（宽目录）**                            |
| `…/memory/schedule-async-memory-llm-enrichment.ts`                           | → capture（文件登记）+ **dismiss（目录）** | dismiss 侧为误报                              |
| `A:…/memory/brand-new-helper.ts`                                             | → **dismiss**                              | **误报**                                      |
| `D:…/memory/gone.ts`                                                         | → **dismiss**                              | **误报**                                      |
| `…/sidepanel/components/RecallProgressStrip.vue`（路径前缀；文件可不必存在） | → recall + open + dismiss                  | **宽目录误报示例**                            |
| `package.json`                                                               | unmatched                                  | **正确无关**                                  |
| `A:…/capture/new-ingest-helper.ts`                                           | unmatched                                  | 新文件未登记 → **漏报类**（预期，除非补路径） |

---

## 3. 共享文件映射合理性

| 共享路径                                   | 图数                       | 判定                                                         |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------ |
| `turnstile.ts`                             | 5                          | **合理**（同模块多图）                                       |
| `LoginForm.vue`                            | 5（Turnstile+Auth）        | **合理**（OTP 与 mint 同页）                                 |
| `memory-handler.ts`                        | 4                          | **合理**（Capture/Open/Dismiss/Settle 分发）                 |
| `memory-item-service.ts`                   | 3（capture/open/bookmark） | **合理**；dismiss **不**直接挂文件，却经 **memory 目录**误伤 |
| `pages/sidepanel` 目录                     | 3                          | **偏宽**；功能相关但粒度粗                                   |
| `omnibox.ts`                               | open + omnibox             | **合理**（open 图 notes：listener 直调对照）                 |
| `hybrid-recall-backend` / `recall-service` | Panel + Omnibox            | **合理**（分轨同 backend）                                   |
| `account-sync-handler`                     | Auth + Sync                | **合理**（同 handler 多职责）                                |
| `commit-recall-outcome`                    | dismiss + outcome          | **合理**                                                     |

**辅助而非核心：** `background-client` 在 overview/outcome — 改 client 形状应复核，但不等于 Outcome 策略变了。

---

## 4. 漏报与误报案例（确定性）

### 4.1 漏报（路径存在且属核心，registry 未覆盖）

| 文件                                                  | 相关图   | 证据                                                    |
| ----------------------------------------------------- | -------- | ------------------------------------------------------- |
| `application/capture/capture-text-excerpt-service.ts` | capture  | context-menu **直调**该 service；impact → **unmatched** |
| `core/memory/chrome-bookmark-sync-pending.ts`         | bookmark | pending 队列 schema/键；impact → **unmatched**          |

**待验证（不升格为确定漏报）：**  
`orchestrate-keyword-recall.ts` — Hybrid/关键词编排核心，但图故意折叠算法；挂 Hybrid 文件已能间接提醒。是否单挂 → 下阶段产品判断。

### 4.2 误报（过宽）

见 §2 表：`application/memory/**` → dismiss；`pages/sidepanel/**` 杂项 → recall/open/dismiss。

### 4.3 正确行为

| 路径                                | 结果                            |
| ----------------------------------- | ------------------------------- |
| `omnibox.ts` / `omnibox-suggest.ts` | omnibox（+ open 对 omnibox.ts） |
| `chrome-bookmark-sync-service.ts`   | bookmark                        |
| `Library.vue` / `Detail.vue`        | open（目录前缀）                |
| `turnstile.ts`                      | 全部 Turnstile 图               |
| `package.json`                      | unmatched                       |

---

## 5. P0 / P1 / P2

### P0

| ID  | 问题   | 说明                                                     |
| --- | ------ | -------------------------------------------------------- |
| —   | **无** | 无指向已删路径；无「核心入口零登记」到阻断变更感知的程度 |

### P1

| ID       | 问题                                                   | 建议（下阶段执行）                                                                                           |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **P1-1** | dismiss 的 `extension/src/application/memory` 目录过宽 | 改为 `memory-item-service.ts`；若要覆盖 `recordDismiss` 落库可加 `memory-item-repository.ts`，**不要**整目录 |
| **P1-2** | capture 漏 `capture-text-excerpt-service.ts`           | 补入 capture `codePaths`（与已挂 `context-menu.ts` 对齐）                                                    |
| **P1-3** | bookmark 漏 `chrome-bookmark-sync-pending.ts`          | 补入 bookmark `codePaths`                                                                                    |

### P2

| ID       | 问题                                    | 建议                                                                            |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| **P2-1** | `pages/sidepanel` 三图共用目录          | 可选：对齐 Outcome，改为 `SidePanel.vue` + 少数文件；或接受「壳层变更多图复核」 |
| **P2-2** | `selection-toolbar` 目录                | 可选收为 `main.ts`；收益一般                                                    |
| **P2-3** | `library`/`detail` 目录挂 open          | 可保留；或改为具体 `.vue`                                                       |
| **P2-4** | overview 故意稀疏                       | **不**为覆盖率堆路径                                                            |
| **P2-5** | docPaths 含 reports（Omnibox/Bookmark） | 卫生项；非 codePaths；另案                                                      |

---

## 6. 建议修改的 Registry 路径（仅建议 · 本轮不改）

| 图                                  | 动作                                                                                                                                                 | 证据                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `runtime.dismiss-feedback-sequence` | **移除** `extension/src/application/memory`；**加入** `…/memory-item-service.ts`（已可能间接够用则至少去掉目录）；可选 `…/memory-item-repository.ts` | impact：quota/enrichment/新文件误中 dismiss；`recordDismiss` 在 service/repository |
| `runtime.capture-excerpt-sequence`  | **加入** `…/capture-text-excerpt-service.ts`                                                                                                         | impact unmatched；context-menu 调用链                                              |
| `runtime.bookmark-chrome-ingest`    | **加入** `…/core/memory/chrome-bookmark-sync-pending.ts`                                                                                             | impact unmatched；pending 冲刷属主链                                               |

**不要为数量而加：** Hybrid 内部每个编排文件、selection-toolbar 每个 `*-styles.ts`、sidepanel 每个卡面 helper —— 误报成本 > 收益。

---

## 7. 暂时不应修改的映射

| 映射                                                          | 理由                       |
| ------------------------------------------------------------- | -------------------------- |
| Auth 15 文件 / Sync 12 文件 / Outcome 8 文件 / Omnibox 6 文件 | 文件级、与图范围一致       |
| Outcome 用 `SidePanel.vue` 而非 sidepanel 目录                | **应作其它图收窄范本**     |
| Turnstile 共享 `turnstile.ts`                                 | 同模块多视角图             |
| open 挂 `omnibox.ts`                                          | notes 已说明对照用途       |
| Panel+Omnibox 共享 Hybrid/recall-service                      | 分轨同 backend             |
| system-overview 仅三件套                                      | 全景定位；细节靠导航表     |
| china planned 挂现有 turnstile/LoginForm                      | notes 已限「不得画成现行」 |

---

## 8. 后续实施优先级

| 序  | 动作                                                       | 对应 |
| --- | ---------------------------------------------------------- | ---- |
| 1   | 收窄 dismiss `application/memory` 目录                     | P1-1 |
| 2   | 补 capture `capture-text-excerpt-service.ts`               | P1-2 |
| 3   | 补 bookmark `chrome-bookmark-sync-pending.ts`              | P1-3 |
| 4   | （可选）sidepanel / selection-toolbar / library 目录收文件 | P2   |
| —   | **禁止**本阶段改 registry（Brief 已禁）；实施须新 Brief    | —    |

---

## 9. 验收命令（实测）

```text
$ bun run docs:check-diagrams
✅ diagrams 校验通过（15 张）· docs/diagrams/registry.json

$ bun run docs:diagram-impact --paths <典型路径…> --json
（见 §2 / §4：误报 dismiss←memory/*；漏报 capture-service / pending；无关 package.json unmatched）
```

**本轮 Diff：** 仅本报告；registry / 图 / 脚本 **未改**。

### 停止线

审计完成。**停止**，等待下一阶段指示（若实施 P1 收窄/补路径）。
