---
created: 2026-10-31T01:54:58+08:00
updated: 2026-10-31T01:54:58+08:00
author: agent:cursor
scope: Mermaid 第十六阶段 · Omnibox Offline Recall 语义复核（不新建重复图；只改宿主 §3.5 Notes / registry 精确路径 / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-Omnibox-Offline-Recall图表补齐.md
  - docs/diagrams/reports/2026-10-Omnibox-Bookmark双链路盘点.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/architecture/decisions/ADR-007-omnibox-offline-lookup.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/background/listeners/omnibox.ts
  - extension/src/application/recall/backends/hybrid-recall-backend.ts
  - extension/src/application/recall/backends/omnibox-recall-entry.test.ts
downstream:
  - bun run docs:check-diagrams
  - bun run docs:diagram-impact
  - docs/diagrams/registry.json（codePaths / docPaths / notes 校准）
---

# Omnibox Offline Recall 语义复核（2026-10-31 · 第十六阶段）

> **本轮约束：** 从真实入口重追调用链；证据充分才保留 `implemented`；**禁止**为完整感虚构边；**禁止**把 planned 画成 implemented；**不**重复登记第二张 Omnibox 图；**不**改业务代码 / 测试；**不**处理 Registry P2。

---

## 0. 一句话结论

`runtime.omnibox-offline-recall`（宿主 §3.5）**已存在且与现行源码一致**——本阶段**不新建图**，只做语义复核 + 宿主 Notes 补齐 + registry `codePaths`/`docPaths` 精确化。证据覆盖入口、共享/分轨、离线边界、无结果/异常降级，以及与 Capture / Bookmark ingest / Outcome 的真实关系（只读 / 无关写路径）。

---

## 1. 源码证据（入口 → 结束）

### 1.1 入口 / 解析 / 触发

| 事实                                                                        | 证据                                    |
| --------------------------------------------------------------------------- | --------------------------------------- |
| 注册 `onInputChanged` / `onInputEntered`                                    | `omnibox.ts` `registerOmniboxListeners` |
| 空 clue → `suggest([])` + Tip，**不**跑 Recall                              | `handleOmniboxInputChanged` 开头        |
| 非空 → `recallService.recallWithClue(clue, { entry: 'omnibox' })`           | 同文件 ~184                             |
| `suggest` one-shot；禁止异步前 `suggest([])`；`requestId` 丢过期            | 注释 + stale 检查                       |
| 异常 catch → `suggest([])`                                                  | listener `.catch`                       |
| 无 Memory 建议时仍出无命中 CTA 行（handoff content）                        | `suggests.length === 0` 分支            |
| 确认：handoff → 先 `openRecallSidePanel` 再 `writeRecallPrefill`            | `handoffOmniboxClueToSidePanel`         |
| 确认：占位 id → `recordOpen` + 打开；默认行无 Top Pick → **忽略**（不接力） | `handleOmniboxInputEntered`             |

### 1.2 与 Side Panel 的共享 / 独立

| 共享                                                                      | 独立（Omnibox）                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `recallService` 门面                                                      | `entry: 'omnibox'` 强制                                            |
| `HybridRecallBackend.recallWithClue`                                      | `context` 丢弃；无可见进展                                         |
| `understandRecallClue` + `listForKeywordRecall` + `finalizeKeywordResult` | `forceMode: 'lexical'`；`complete=undefined`（不注入 LLM）         |
| MemoryItem / IDB 读路径                                                   | **禁止** Topic embed 注入、`fuseHybrid`、`requestWorkerEmbeddings` |
| Open 落点可走 `memoryItemService.recordOpen`（书签）                      | `skipOutcomePairs` + 主锚 `behaviorProfile: 'omnibox'`；无追问会话 |

Normative：产品文档 §1 / §5.3 / §5.10.8 + ADR-007 §6（已上线分轨；本图 `status=implemented` 与之对齐）。

### 1.3 理解 / 过滤 / 排序 / 索引 / Embedding

| 层                 | Omnibox 实际                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 理解               | `understandRecallClue(..., { forceMode: 'lexical' })`；规则 parse，无 hosted LLM                                                                                             |
| 候选               | `memoryItemService.listForKeywordRecall`（本机 IDB）                                                                                                                         |
| 检索               | 零锚点 → `no_match`；约束邻域 early → `finalizeKeywordResult`（**可不带** omnibox profile）；主锚 → `finalizeKeywordResult({ skipOutcomePairs, behaviorProfile:'omnibox' })` |
| Embedding / Hybrid | **不参与**本轨融合；`usedHybrid` 对 omnibox 早退路径恒为 false                                                                                                               |
| 索引缺失           | 无单独「缺倒排」UI；候选空 → `no_match` + CTA（listener）                                                                                                                    |

### 1.4 本地执行 vs 网络 / AI

- **本轨：** 无 LLM completer、无 Topic embed 联网、无 Worker embeddings / RRF。
- **仍依赖：** 本机 IndexedDB Memory（「离线」≠ 无存储）。
- **CTA 后：** Side Panel 完整 Hybrid（可联网）——与 Omnibox 天花板**分计**（图中 `SP` 边仅标接力，不展开内部）。

### 1.5 与 Capture / Bookmark / Outcome

| 链路                   | 关系                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Capture（划词）        | **无调用**；Omnibox 只读已存 Memory                             |
| Bookmark Chrome ingest | **无调用**；书签可出现在候选（灌库产物）                        |
| Outcome pair / settle  | Omnibox 主锚 `skipOutcomePairs: true`；listener **不**写 settle |

---

## 2. 图表变更

| 项                        | 动作                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| 是否新建 `implemented` 图 | **否**（第十阶段已登记；重复会违反「不重复绘制」）                        |
| §3.5 Mermaid Notes        | **改**：空 clue/catch；`complete=undefined`；约束邻域 early；context 丢弃 |
| §3.5 散文                 | **增**：相邻链路只读边界；降级；backend 分支折叠说明                      |
| 文首 changelog            | 链到本报告                                                                |

**故意仍不画：** suggest XML、soft rank 公式、Side Panel Hybrid 内部、Capture/ingest 写入边。

---

## 3. Registry 变更

`runtime.omnibox-offline-recall`：

- **codePaths 新增（调用链核实）：**
  - `extension/src/core/recall/understand/understand-recall-clue.ts`
  - `extension/src/application/memory/memory-item-service.ts`
- **docPaths 新增：** 第十阶段补齐报告 + 本报告
- **notes：** 约束邻域 early；只读 IDB≠Capture/ingest

未扩目录级通配；未改其它图的 P2 映射。

---

## 4. 验证

```text
bun run docs:check-diagrams
→ ✅ diagrams 校验通过（15 张）

bun run docs:diagram-impact --paths \
  extension/src/background/listeners/omnibox.ts \
  extension/src/core/recall/omnibox-suggest.ts \
  extension/src/application/recall/backends/hybrid-recall-backend.ts \
  extension/src/application/memory/memory-item-service.ts \
  package.json
→ runtime.omnibox-offline-recall 命中 omnibox / omnibox-suggest / hybrid / memory-item-service
→ package.json UNMATCHED（预期；非本图路径）
```

---

## 5. 已实现 / 设计预期 / 未实现（对照 Normative）

| 表述                                           | 归类                                       |
| ---------------------------------------------- | ------------------------------------------ |
| `entry:omnibox` 离线 lexical 快跳 + CTA 接力   | **已实现**（图 / ADR-007 / §5.10.8）       |
| 与 Side Panel 共用 `recallService`、分轨天花板 | **已实现**                                 |
| Omnibox 会话追问 / 本轨 Hybrid·LLM·Outcome     | **未实现且禁止**（勿画）                   |
| 约束邻域 early 与主锚 `behaviorProfile` 差异   | **已实现细节**；图用 Note 折叠，不另开支图 |

---

## 6. 未解决问题

| 项                        | 说明                            |
| ------------------------- | ------------------------------- |
| 约束邻域是否单独 alt 节点 | 仍折叠；若评审反复误读再拆      |
| Registry P2               | 本阶段明确不做                  |
| MCP 真机预览              | 未跑（文档-only；结构门禁已绿） |

### 停止线

第十六阶段完成。**停止**；等待下一阶段指示。
