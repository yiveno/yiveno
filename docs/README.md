# `docs/` 目录入口

**仓库归属：** GitHub Organization [`yiveno`](https://github.com/yiveno) · [`yiveno/yiveno`](https://github.com/yiveno/yiveno) — 品牌产品 [`yiveno.com`](https://yiveno.com) 的主交付仓，非个人 side project。

**新 Agent 会话开机（自动）：**

1. `.cursor/rules/session-boot.mdc` — **alwaysApply** 当下 + 冻结（**当下**由 `CURRENT` + `sync:ide-boot` 生成）
2. 任务需要时再 `@`：术语表 · 产品文档 §0 · ADR
3. **每会话首条：** [`AGENT-TASK-BRIEF.template.md`](./product/AGENT-TASK-BRIEF.template.md)
4. **仓库根薄指针：** [`AGENTS.md`](../AGENTS.md)（当前 AI 工具 = Cursor；未来扩展见 ADR-013 §7）

**开发者阅读顺序：**

- [`product/Yiveno-术语表.md`](./product/Yiveno-术语表.md) — clue、Recall、邻域、附注等概念叫法；**所有文档与沟通以此为准**

**规格正文**（产品行为、架构、数据流、交互与开发约定）：

- [`product/Yiveno-产品文档-v4.0.md`](./product/Yiveno-产品文档-v4.0.md) — AI 先读 **§0 Quick Contract**；附录 A 为背景非规范
- [`product/CURRENT.md`](./product/CURRENT.md) — **当下焦点唯一手写源** → `bun run sync:ide-boot`
- [`product/Yiveno-改版计划-v1.md`](./product/Yiveno-改版计划-v1.md) — 执行计划（R0–R∞）；与正文冲突时先改产品文档
- [`product/Yiveno-市场调研-v1.md`](./product/Yiveno-市场调研-v1.md) — **Non-normative**；语言/区域/竞品/待验证假设；重大方向调整前先读 §8–§11

**运维 / 工程（非规格，与正文冲突时以正文为准）**：

- [`engineering/DEV-调试API.md`](./engineering/DEV-调试API.md) — SW `yiveno.*` 调试 API 总索引与维护约定（探针种库、Omnibox 冒烟、TTE 读取等）
- [`engineering/语料适配器契约.md`](./engineering/语料适配器契约.md) — Corpus Adapter 边界、差距清单、第三方准入 checklist（R2）
- [`engineering/background-message-types.registry`](./engineering/background-message-types.registry) — Background `message type` 登记册（`bun run doc:check`）
- [`engineering/关键词倒排索引-Phase1.md`](./engineering/关键词倒排索引-Phase1.md) — 倒排预过滤设计（R3）
- [`engineering/业务日志与注释约定.md`](./engineering/业务日志与注释约定.md) — 中文注释与 flow log
- [`AUTH_GUIDE.md`](./AUTH_GUIDE.md) — OAuth 使用说明
- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — 环境变量分层、同步与校验规则

**设计 / 品牌（发版）：**

- [`design/brand-asset-release-checklist.md`](./design/brand-asset-release-checklist.md) — 母本 → `public/` → 商店/官网；`bun run sync:brand-assets`
- [`design/brand-assets/README.md`](./design/brand-assets/README.md) — 仓内母本；`yiveno-brand-kit/` 已移除（独有文件已备份至仓外）

`frontend/docs/` 已清空；i18n 方案定稿前不在此目录维护占位文档。

**合入与门禁：**

- [`.github/pull_request_template.md`](../.github/pull_request_template.md) — PR 勾选清单（§1.1 验收归属）
- [`.cursor/hooks.json`](../.cursor/hooks.json) — Agent `sessionStart` / 破坏性 git 拦截（见 [`.cursor/hooks/README.md`](../.cursor/hooks/README.md)）
- [`engineering/background-message-types.registry`](./engineering/background-message-types.registry) + `bun run doc:check` — message type / CURRENT 漂移门禁
