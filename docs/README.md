# `docs/` 目录入口

**规格唯一正文**（产品、架构、数据流、交互与开发约定）：

- [`product/Yiveno-产品文档-v4.0.md`](./product/Yiveno-产品文档-v4.0.md) — AI 先读 **§0 Quick Contract**；附录 A 为背景非规范
- [`product/Yiveno-改版计划-v1.md`](./product/Yiveno-改版计划-v1.md) — 执行计划（R0–R∞）；与正文冲突时先改产品文档
- [`product/Yiveno-市场调研-v1.md`](./product/Yiveno-市场调研-v1.md) — **Non-normative**；语言/区域/竞品/待验证假设；重大方向调整前先读 §8–§11

**运维 / 工程（非规格，与正文冲突时以正文为准）**：

- [`engineering/语料适配器契约.md`](./engineering/语料适配器契约.md) — Corpus Adapter 边界、差距清单、第三方准入 checklist（R2）
- [`engineering/业务日志与注释约定.md`](./engineering/业务日志与注释约定.md) — 中文注释与 flow log
- [`AUTH_GUIDE.md`](./AUTH_GUIDE.md) — OAuth 使用说明
- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — 环境变量分层、同步与校验规则

`frontend/docs/` 已清空；i18n 方案定稿前不在此目录维护占位文档。
