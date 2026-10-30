---
created: 2026-10-31T01:40:06+08:00
updated: 2026-10-31T01:40:06+08:00
author: agent:cursor
scope: Mermaid 第十五阶段 · Registry P1-1/P1-2/P1-3 codePaths 校准（只改 registry.json + 本报告）
status: done
upstream:
  - docs/diagrams/reports/2026-10-Registry-CodePaths映射质量审计.md
  - docs/diagrams/reports/2026-10-图表变更感知机制.md
  - docs/diagrams/registry.json
  - extension/src/application/memory/memory-item-service.ts
  - extension/src/infrastructure/indexeddb/memory-item-repository.ts
  - extension/src/application/capture/capture-text-excerpt-service.ts
  - extension/src/background/listeners/context-menu.ts
  - extension/src/core/memory/chrome-bookmark-sync-pending.ts
  - extension/src/application/capture/chrome-bookmark-sync-service.ts
downstream:
  - bun run docs:check-diagrams
  - bun run docs:diagram-impact
---

# Registry P1 映射校准（2026-10-31）

> **本轮约束：** 只改 `docs/diagrams/registry.json`；**不**改 Mermaid / 业务代码 / impact 脚本；**不**处理 P2（sidepanel 目录等）。

---

## 0. 一句话结论

三项 P1 已校准：dismiss 去掉 `application/memory` 整目录并改为 service + repository 文件；Capture 补 `capture-text-excerpt-service.ts`；Bookmark 补 `chrome-bookmark-sync-pending.ts`。七项 impact 验收全过；`docs:check-diagrams` 15 张通过。

---

## 1. P1-1 · dismiss 收窄

### 修改前 → 后

|          | 路径                                                               |
| -------- | ------------------------------------------------------------------ |
| **删**   | `extension/src/application/memory`（目录）                         |
| **加**   | `extension/src/application/memory/memory-item-service.ts`          |
| **加**   | `extension/src/infrastructure/indexeddb/memory-item-repository.ts` |
| **保留** | `pages/sidepanel`、`memory-handler.ts`、`commit-recall-outcome.ts` |

### 源码依据

- `memory-handler` → `memoryItemService.recordDismiss`
- `memory-item-service.ts`：`recordDismiss` → `this.repository.recordDismiss(ids)`（薄封装）
- `memory-item-repository.ts`：`recordDismiss` 写 `dismissCount` / `lastDismissedAt`

→ repository **需要**独立映射：持久化行为在 repo，仅挂 service 会漏「只改 repo」的 diff。

`notes`：写明禁止再挂 `application/memory` 整目录。

---

## 2. P1-2 · Capture 补入口

|        | 路径                                                                |
| ------ | ------------------------------------------------------------------- |
| **加** | `extension/src/application/capture/capture-text-excerpt-service.ts` |

### 源码依据

- `listeners/context-menu.ts` import 并调用 `captureTextExcerptFromContextMenu`
- 该函数定义于 `capture-text-excerpt-service.ts`（再调 `memoryItemService.captureTextExcerpt`）

`notes`：改为「右键 listener→capture-text-excerpt-service 直调对照」。

---

## 3. P1-3 · Bookmark pending

|        | 路径                                                        |
| ------ | ----------------------------------------------------------- |
| **加** | `extension/src/core/memory/chrome-bookmark-sync-pending.ts` |

### 源码依据

- 定义 `CHROME_BOOKMARK_SYNC_PENDING_STORAGE_KEY` + `ChromeBookmarkSyncPendingSchema`
- `chrome-bookmark-sync-service.ts`：enqueue / hydrate / `flushPendingChromeBookmarkSync` 读写该 schema

属导入未完成期间增量积压与冲刷主链。

---

## 4. 七项验证（实测）

```text
$ bun run docs:check-diagrams
✅ diagrams 校验通过（15 张）· missing codePaths = []

$ bun run docs:diagram-impact --paths <七路径> --json
```

| #   | 路径                                      | 期望                           | 实际                                   |
| --- | ----------------------------------------- | ------------------------------ | -------------------------------------- |
| 1   | `memory-item-service.ts`                  | 仍命中相关图（含 dismiss）     | → bookmark, capture, **dismiss**, open |
| 2   | `indexeddb-write-quota.ts`                | **不再**因 dismiss 宽目录命中  | → **unmatched**（dismiss=false）       |
| 3   | `schedule-async-memory-llm-enrichment.ts` | 可中 capture；**不**中 dismiss | → **仅** capture（dismiss=false）      |
| 4   | `capture-text-excerpt-service.ts`         | 命中 Capture                   | → capture                              |
| 5   | `chrome-bookmark-sync-pending.ts`         | 命中 Bookmark                  | → bookmark                             |
| 6   | `turnstile.ts`                            | 五张 Turnstile 图              | → lifecycle/state/e2e/secrets/china    |
| 7   | `package.json`                            | 无关                           | → unmatched                            |

图数量仍为 **15**；未改任何 Mermaid 正文。

---

## 5. 尚存 P2（本轮不处理）

| 项                                              | 说明                                                   |
| ----------------------------------------------- | ------------------------------------------------------ |
| `pages/sidepanel` 目录                          | recall / open / dismiss 仍共用；改壳层杂项可能三图齐中 |
| `selection-toolbar` / `library` / `detail` 目录 | Capture/Open 可接受宽匹配                              |
| docPaths 含 reports                             | 卫生项，非本轮                                         |

---

## 6. 变更清单

| 路径                                                   | 动作                   |
| ------------------------------------------------------ | ---------------------- |
| `docs/diagrams/registry.json`                          | 三图 codePaths + notes |
| `docs/diagrams/reports/2026-10-Registry-P1映射校准.md` | 本报告                 |

### 停止线

P1 校准完成。**停止**，等待下一阶段指示。
