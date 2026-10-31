# 业务逻辑图表（Mermaid · Git 单源）

> **权威格式：** Mermaid 嵌在 Markdown 内。**不**引入 Figma / FigJam / draw.io / Excalidraw / tldraw。  
> **规范正文：** [`../engineering/Yiveno-Mermaid图表规范.md`](../engineering/Yiveno-Mermaid图表规范.md)（含图面用词 §3.1）  
> **用词标准：** 专业准确 + 低歧义；本仓专有词白话释义（`.cursor/rules/dev-chinese-plain.mdc`）  
> **清单：** [`registry.json`](./registry.json)  
> **同步：** `bun run docs:sync-diagrams`

## 目录职责

| 路径            | 用途                                                           |
| --------------- | -------------------------------------------------------------- |
| `registry.json` | 已登记图表清单（id · kind · status · 宿主 MD · 关联代码/文档） |
| `README.md`     | 本入口（组织约定）                                             |
| `.cache/`       | 同步命令生成的 Agent Brief（**gitignore** · 勿提交）           |
| `reports/`      | 人工/Agent 完成一次同步后的审阅报告（可提交）                  |

**图表正文不单独拆 `.mmd` 文件。** 默认写在业务/工程 Markdown 宿主内（与说明同 diff），用注释锚点绑定 registry。

## 命名

- **id：** `域.主题`，小写 + 点分，例：`turnstile.captcha-token-lifecycle`、`runtime.capture-excerpt-sequence`
- **域：** 产品/工程短名（`turnstile` / `runtime` / `recall` / `auth` …），与宿主文档主题一致
- **宿主 MD：** 图表所在权威说明文；禁止把审计草稿当唯一宿主

## 宿主内锚点（必填）

每个已登记 ```mermaid 块**正上方**写：

```markdown
<!-- diagram: id=turnstile.captcha-token-lifecycle kind=sequence status=implemented -->
```

| 字段     | 含义                                                                       |
| -------- | -------------------------------------------------------------------------- |
| `id`     | 与 `registry.json` 一致                                                    |
| `kind`   | `flowchart` / `sequence` / `state` / `mindmap` / `er`                      |
| `status` | `implemented`（已实现）· `designed`（已确认设计未接线）· `planned`（规划） |

## 何时画图

见规范 §适用场景。一句话：**图要能回答「谁在何时如何」**；纯列表/表更清楚时不要硬画。

## 日常维护

1. 改行为 / Normative / ADR → 查 `registry.json` 里 `codePaths` / `docPaths` 命中的图。
2. **可选先跑变更感知：** `bun run docs:diagram-impact --base HEAD`（或相对 `main`）→ 看命中哪些 id。
3. 有命中 → `bun run docs:sync-diagrams --id <id>`（或整表）→ 按 Brief 审代码后改 Mermaid → `--check`。
4. 新业务域需要长期图 → 先补 registry + 锚点，再画图。

## 命令

```bash
bun run docs:sync-diagrams           # 校验 + 写 Agent Brief 到 .cache/
bun run docs:sync-diagrams --check   # 仅门禁（registry / 锚点 / 结构语法 / 路径）
bun run docs:sync-diagrams --id turnstile.captcha-token-lifecycle
bun run docs:check-diagrams          # = --check

# 变更感知（Git → 图 id；不改图、不做语义判定）
bun run docs:diagram-impact --base HEAD
bun run docs:diagram-impact --base origin/main --write-brief
bun run docs:diagram-impact --paths extension/src/background/listeners/omnibox.ts
bun run docs:diagram-impact --base HEAD --id runtime.omnibox-offline-recall --json
```

**同步 / 变更感知均不调用外部 LLM API**；语义审阅由 Cursor Agent 在会话内完成（见 Brief）。

### 变更感知口径

| 结论             | 含义                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| **命中**         | 变更路径落在某图 `codePaths` / `doc` / `docPaths` → **建议复核**该图 |
| **未匹配**       | 未列入 registry → **不**等于无影响（无 import 依赖图）               |
| **tooling meta** | registry / sync 脚本等 → 非业务图语义                                |

详：[`reports/2026-10-图表变更感知机制.md`](./reports/2026-10-图表变更感知机制.md)
