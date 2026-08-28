# GEMINI.md（Gemini CLI · 薄指针）

> **纪律与真相以仓库权威文件为准**；本文件只做 Gemini 开机索引。冲突时：`docs/product/Yiveno-术语表.md` > 产品文档 §0–§7 > `AGENTS.md` > 本文件。

## 开机必读（按序）

1. [`AGENTS.md`](./AGENTS.md) — 工程纪律、验证、分层
2. [`.cursor/rules/session-boot.mdc`](./.cursor/rules/session-boot.mdc) — **当下焦点 + 冻结决策**（由 [`docs/product/CURRENT.md`](./docs/product/CURRENT.md) 同步）
3. [`.cursor/rules/project.mdc`](./.cursor/rules/project.mdc) + [`.cursor/rules/terminology.mdc`](./.cursor/rules/terminology.mdc) — 完整硬规则

## 每会话首条

复制填写 [`docs/product/AGENT-TASK-BRIEF.template.md`](./docs/product/AGENT-TASK-BRIEF.template.md)（In / Out / 验收 / 禁止）。

## 深读（仅任务需要时）

- 术语：`docs/product/Yiveno-术语表.md`
- 行为契约：`docs/product/Yiveno-产品文档-v4.0.md` §0
- ADR：`docs/architecture/decisions/`

## 维护

- 换波次：**只改** `docs/product/CURRENT.md` → `bun run sync:ide-boot`
- 跨 IDE 索引：`.cursor/rules/README.md` · `docs/README.md` · [`CLAUDE.md`](./CLAUDE.md)
