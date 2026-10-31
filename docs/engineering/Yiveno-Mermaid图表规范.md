---
created: 2026-10-30T23:35:00+08:00
updated: 2026-10-31T20:35:00+08:00
author: agent:cursor
scope: Mermaid + Markdown + Git 业务逻辑可视化；图表类型适用场景与 Agent 同步纪律；图面用词标准
status: active
upstream:
  - docs/diagrams/README.md
  - docs/diagrams/registry.json
  - docs/product/Yiveno-术语表.md
  - .cursor/rules/dev-chinese-plain.mdc
downstream:
  - scripts/sync-diagrams.mjs
  - scripts/diagram-change-impact.mjs
  - bun run docs:sync-diagrams
  - bun run docs:diagram-impact
  - docs/diagrams/reports/
---

# Yiveno Mermaid 图表规范

> **单源：** Git 内 Markdown + Mermaid。不引入外部画布平台。  
> **清单与命令：** [`docs/diagrams/`](../diagrams/README.md)  
> **用词：** 与开发者面规则一致——**专业准确优先，其次降低理解成本、避免歧义**（`.cursor/rules/dev-chinese-plain.mdc`）。

## 1. 权威优先级

对照业务图时：

1. 现行代码
2. 产品文档 Normative / 术语表 / ADR
3. 宿主工程文档（含本图）
4. 旧图 / 旧审计

**禁止**用旧图反推「实现一定如此」。区分：`implemented` / `designed` / `planned`（锚点与 registry 的 `status`）。

## 2. 五种图 · 适用场景

| kind          | Mermaid 起始      | 适合                                    | 不适合                                        |
| ------------- | ----------------- | --------------------------------------- | --------------------------------------------- |
| **flowchart** | `flowchart TD/LR` | 业务流程、判断分支、配额/门禁分层       | 细到每个函数参数；纯配置表                    |
| **sequence**  | `sequenceDiagram` | 模块/进程间消息与时序                   | 无时间顺序的概念分层（用 flowchart 或 prose） |
| **state**     | `stateDiagram-v2` | 显式状态机、token/会话生命周期          | 无稳定状态名的临时 UI 布尔拼盘                |
| **mindmap**   | `mindmap`         | 领域/模块层级鸟瞰、术语分区             | 当流程或时序用；不可替代 Normative 列表       |
| **er**        | `erDiagram`       | 持久实体与关系（MemoryItem 字段级可选） | 临时 DTO、消息 payload 每次变化的结构         |

**默认不要画：** 一次性审计结论、与代码无锚点的脑暴、仅装饰性的「架构全景」重复图。

## 3. 写法约定（减噪 Diff）

1. **稳定节点 id：** flowchart 用短 id（`A`/`B1` 或 `Capture`），改文案尽量不动 id。
2. **participant 短名：** sequence 左侧 id 稳定（`UI`/`BC`/`MH`），`as` 后的显示名可改。
3. **禁止**无意义重排整图；只改变化的边/节点。
4. **中文说明 OK**（开发者面）；产品术语遵循术语表（clue / Recall / 附注，禁止用户面 Search）。
5. **规划内容**必须 `status=planned` 或文内标明「未接线」，不得画成现行路径。
6. 不确定 → 在宿主 MD 写「不确定：…」，**不要**编节点补全。

### 3.1 图面用词（专业 · 低歧义）

1. **节点 / 边标签**优先写清行为（「探测扩展是否已登录」），不要只贴未释义的消息字面量（裸 `STATUS_PROBE`）。
2. **业内通用词**（session、OTP、Bearer、409、幂等）可直接用；**本仓专有词**须白话 + 首次/名词表括注代码名（铸造 mint、交接 handoff、作废票等）。
3. **鉴权 / 同步 / Outcome** 等 dense 域：宿主在图前放**名词表**或凭证/通道分工表。
4. 改标签**不改语义**；同一概念全图一词一义（鉴权 handoff ≠ Omnibox 换赛道交接）。
5. 需要对代码时：入口对照表或括号保留 `message type` / 路径，**主路径仍可读**。

## 4. 与代码 / 文档关联

每张登记图在 `registry.json` 声明：

- `doc`：宿主 Markdown
- `codePaths[]`：应对齐的实现路径（可 glob 目录）
- `docPaths[]`：应对齐的权威文档 / ADR
- `status`：与锚点一致

改 `codePaths` 下行为而未改图 → 合入前应跑同步或在 PR 说明「图未变原因」。

## 5. 校验与预览

| 层            | 做法                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| **结构/清单** | `bun run docs:check-diagrams`（registry ↔ 锚点 ↔ fence、kind 关键字、关联路径存在） |
| **渲染预览**  | Cursor / VS Code Markdown 预览（内置 Mermaid）；或 GitHub 网页预览宿主 MD           |
| **Git**       | 图与宿主 MD 同 PR；`doc:check:all` 含 diagrams 门禁                                 |

不做独立 Puppeteer/CLI 截图门禁（成本高、非本阶段必需）。

## 6. Agent 同步纪律（`docs:sync-diagrams`）

命令**只**做：读清单、结构校验、生成 Brief、（可选）提示 mtime 陈旧。  
**语义更新**由 Cursor Agent 按 Brief 执行，且：

- 不以旧图为真相
- 不改业务代码、不改产品行为
- 不覆盖无关正文；只改确需调整的 Mermaid / 锚点 / registry
- 无法确认标不确定
- 完成后 `--check` + 在 `docs/diagrams/reports/` 留报告（试点与重大同步）

## 6.1 变更感知（`docs:diagram-impact`）

Git（或 `--paths`）变更 → 对照 registry `codePaths` / `doc` / `docPaths` → 列出建议复核的图 id。

| 规则          | 说明                                                             |
| ------------- | ---------------------------------------------------------------- |
| 命中          | **建议**打开对应宿主 Mermaid 复核；**不等于**图已过时            |
| 未命中        | **不等于**无图表影响（registry 无闭包 import 图）                |
| 间接依赖      | **禁止**脚本伪装成确定性结论；留给 Agent 结合 unmatched 列表判断 |
| 与 check 关系 | **不**替代、**不**改写 `docs:check-diagrams`                     |

详见 `docs/diagrams/README.md` · `docs/diagrams/reports/2026-10-图表变更感知机制.md`。

## 7. 修订

| 日期       | 说明                                         |
| ---------- | -------------------------------------------- |
| 2026-10-31 | §3.1 图面用词；对齐 `dev-chinese-plain`      |
| 2026-10-31 | §6.1 变更感知 `docs:diagram-impact`          |
| 2026-10-30 | 初版：五类图场景、锚点、同步纪律、无外部画布 |
