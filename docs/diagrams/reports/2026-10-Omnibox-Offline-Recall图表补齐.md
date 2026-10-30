---
created: 2026-10-31T01:03:06+08:00
updated: 2026-10-31T01:03:13+08:00
author: agent:cursor
scope: Mermaid 第十阶段 · 补登记图 runtime.omnibox-offline-recall（只改运行时宿主 / registry / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-Omnibox-Bookmark双链路盘点.md
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/Yiveno-运行时架构流程-v1.md
  - docs/architecture/decisions/ADR-007-omnibox-offline-lookup.md
  - extension/src/background/listeners/omnibox.ts
  - extension/src/application/recall/backends/hybrid-recall-backend.ts
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（新增 runtime.omnibox-offline-recall）
---

# Omnibox Offline Recall 图表补齐（2026-10-31）

> **本轮约束：** 按双链路盘点 **P1-1** 优先补 `runtime.omnibox-offline-recall`；**不**改业务代码 / ADR / 同步脚本；**不**顺手开 Bookmark Ingest / Billing / GS。  
> **口径：** 钉 `entry: omnibox` 天花板与 CTA 接力；禁止把 Side Panel Hybrid 画进本轨。

---

## 0. 一句话结论

在运行时宿主 **§3.5** 登记 `sequenceDiagram`：`onInputChanged` → `recallWithClue({ entry: 'omnibox' })` → lexical 关键词轨 → `suggest`；`onInputEntered` 分 CTA 接力 / 打开命中 / 默认行忽略。与 `runtime.recall-sidepanel-sequence` **分图**；「离线」文案明确为无 LLM/无向量融合 + 仍依赖本机 IDB。

---

## 1. 对照源码的图边界

| 图画了                                                                   | 证据                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `entry=omnibox` → lexical / 无 LLM completer                             | `hybrid-recall-backend` + `omnibox-recall-entry.test.ts` |
| `finalizeKeywordResult` + `skipOutcomePairs` + `behaviorProfile:omnibox` | 同 backend `isOmniboxEntry` 支                           |
| 禁止 Hybrid embed / RRF                                                  | ADR-007 §6；单测 `requestWorkerEmbeddings` 次数 = 0      |
| `suggest` one-shot + requestId 过期丢弃                                  | `omnibox.ts` 注释与实现                                  |
| CTA：先 `openRecallSidePanel` 再 prefill                                 | `handoffOmniboxClueToSidePanel`                          |
| 默认行无 Top Pick → 忽略（不接力）                                       | `handleOmniboxInputEntered`                              |
| 书签 open 直调；摘录交 Detail                                            | 同 listener + §3.3                                       |

| 图**故意不画**               | 原因                                       |
| ---------------------------- | ------------------------------------------ |
| suggest XML / ECS 五要素排版 | 壳层细节，散文 + `omnibox-suggest.ts` 足够 |
| soft rank / 字段权重公式     | 算法层；ADR-007 表即可                     |
| Side Panel Hybrid 内部       | 已有 `runtime.recall-sidepanel-sequence`   |
| 快捷键 TTL 缓存              | 文案旁路                                   |

---

## 2. 变更清单

| 路径                                                              | 动作                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------- |
| `docs/architecture/Yiveno-运行时架构流程-v1.md`                   | §3.5 插入锚点 + Mermaid；文首索引行；「离线」边界一句 |
| `docs/diagrams/registry.json`                                     | 新增 `runtime.omnibox-offline-recall`                 |
| `docs/diagrams/reports/2026-10-Omnibox-Offline-Recall图表补齐.md` | 本报告                                                |

**未改：** 业务代码、测试、ADR-007 正文、Bookmark 图、Registry 其它条目语义。

---

## 3. 验证

```text
bun run docs:check-diagrams
→ ✅ diagrams 校验通过（14 张）
```

---

## 4. 与盘点结论对齐

| 盘点项               | 本轮                 |
| -------------------- | -------------------- |
| Omnibox 值得独立图   | **已落地**           |
| 先做 Omnibox         | **已执行**           |
| Bookmark Ingest 次之 | **未做**（下一阶段） |
| 不合并两条链路       | **遵守**             |

---

## 5. 未解决问题 / 下一阶段

| 项                                           | 状态                                                     |
| -------------------------------------------- | -------------------------------------------------------- |
| `runtime.bookmark-chrome-ingest`             | 待下一阶段（盘点 P1-2）                                  |
| Omnibox 约束邻域 early-return 是否另分支进图 | 本图折叠进「finalizeKeywordResult」；若反复误读再拆 Note |
| MCP 预览渲染                                 | 未跑（结构门禁已绿）                                     |

### 停止线

本阶段仅 Omnibox 补图。**停止**；Bookmark Ingest 图待明示继续。
