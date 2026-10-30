---
created: 2026-10-31T00:50:17+08:00
updated: 2026-10-31T00:50:17+08:00
author: agent:cursor
scope: Mermaid 第八阶段 · Normative/交叉引用失效路径校准（只改确认失效的文档链接；不改业务代码/图/脚本）
status: done
upstream:
  - docs/diagrams/reports/2026-10-Outcome-Settlement图表补齐.md
  - docs/archive/README.md
  - docs/diagrams/registry.json
  - docs/product/Yiveno-产品文档-v4.0.md
downstream:
  - bun run docs:check-diagrams
---

# Normative 文档引用路径校准（2026-10-31）

> **本轮约束：** 只修失效引用路径；**不**改 ADR/Normative 语义、业务代码、Mermaid、同步脚本；**不**批量搬迁文件；**不**为清旧路径而改历史审计/变更日志叙事。

---

## 0. 一句话结论

产品文档 **5 处**仍指向已不存在的 `docs/engineering/R4-*`；真实文件在 `docs/archive/engineering/`。已全部改为归档相对路径（并标注「已归档」）。Registry `docPaths` 此前已正确。变更日志中的**裸文件名**历史行未改。

---

## 1. 归档事实（仓库确认）

| 文件                             | 现行路径                                                  | `docs/engineering/` 下 |
| -------------------------------- | --------------------------------------------------------- | ---------------------- |
| `R4-Phase-E-验收与eval.md`       | `docs/archive/engineering/R4-Phase-E-验收与eval.md`       | **不存在**             |
| `R4-Outcome-Labeling-P2-校准.md` | `docs/archive/engineering/R4-Outcome-Labeling-P2-校准.md` | **不存在**             |

依据：`docs/archive/README.md` 目录树 · `ls docs/archive/engineering/`。

同类已正确：`Yiveno-改版计划-v1.md`、`DEV-调试API.md`、`TTE-种子用户研究-checklist.md` 已链 `../archive/engineering/…`。

---

## 2. 失效引用清单

### 2.1 已修复（产品文档 Normative 现行引用）

| #   | 位置                   | 旧路径                                               | 新路径                                                              |
| --- | ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | §0.5 权威路径速查表    | `` `docs/engineering/R4-Phase-E-验收与eval.md` ``    | `` `docs/archive/engineering/R4-Phase-E-验收与eval.md`（已归档） `` |
| 2   | §5 波次条 Phase E / R4 | 同上裸路径                                           | 同上归档路径                                                        |
| 3   | §5.10 工程旁挂链接     | `[…](../engineering/R4-Phase-E-验收与eval.md)`       | `[…](../archive/engineering/R4-Phase-E-验收与eval.md)`              |
| 4   | §5.11 旁挂链接         | 同 #3                                                | 同 #3                                                               |
| 5   | §7.2 P2 实现切片       | `[…](../engineering/R4-Outcome-Labeling-P2-校准.md)` | `[…](../archive/engineering/R4-Outcome-Labeling-P2-校准.md)`        |

从 `docs/product/` 解析：`../archive/engineering/…` → 文件存在（本轮脚本校验 OK）。

**未改语义：** 仍指向同一旁挂；仅路径与「已归档」标注；Normative 正文仍以 §5.10 / §5.11 / §7.2 为准。

### 2.2 未修复（有意保留）

| 引用                                                                                                           | 原因                                                     |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 产品文档变更日志 `2026-08-24` 行：裸 `` `R4-Outcome-Labeling-P2-校准.md` `` / `` `R4-Phase-E-验收与eval.md` `` | **历史记录**；Brief 禁止为消旧路径改历史叙事；非可点链接 |
| `docs/diagrams/reports/2026-10-Outcome-Settlement图表补齐.md`「产品文档仍链旧路径」                            | **历史审计报告**；不改写；本阶段报告承接结案             |
| `extension/.../recall-outcome-calibration.ts` JSDoc `@see docs/engineering/R4-…`                               | **业务源码注释**；Brief 禁止改业务代码；记入残余         |
| `docs/archive/engineering/R4-Phase-E-…` 表内裸文件名 `R4-Outcome-…`                                            | 同目录 basename；非失效 `docs/engineering/` 链           |

### 2.3 数量

| 口径                   | 数                                                     |
| ---------------------- | ------------------------------------------------------ |
| 确认失效且本轮修复     | **5**（均在 `Yiveno-产品文档-v4.0.md`）                |
| 有意未修               | **4 类**（上表）                                       |
| Registry 失效 docPaths | **0**（`recall.outcome-settlement-channels` 已指归档） |

---

## 3. Registry 检查

`bun` 结构校验：全部 `docPaths` / `codePaths` 存在。  
`sync.excerpt-cloud-pro-gate` / `auth.*` / `recall.outcome-settlement-channels` 等 **无需**本轮改 registry。

---

## 4. 验证结果

```bash
bun run docs:check-diagrams
```

**结果（2026-10-31）：** `✅ diagrams 校验通过（13 张）· docs/diagrams/registry.json`

产品文档 R4 可解析引用：脚本复核 **全部 OK**（无残留 `docs/engineering/R4` / `../engineering/R4` 可点链）。

---

## 5. Git Diff 范围

| 路径                                                         | 变更                            |
| ------------------------------------------------------------ | ------------------------------- |
| `docs/product/Yiveno-产品文档-v4.0.md`                       | 5 处路径校准（+「已归档」标注） |
| `docs/diagrams/reports/2026-10-Normative文档引用路径校准.md` | 本文件                          |

**未改：** 业务代码、ADR 正文决策、Mermaid、registry、同步脚本、历史报告正文、变更日志历史行。

### 停止线

按 Brief：**完成后停止**；不进入下一业务图阶段。
