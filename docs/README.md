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
- [`product/Yiveno-改版计划-v1.md`](./product/Yiveno-改版计划-v1.md) — 执行计划（R0–R∞ / R5）；与正文冲突时先改产品文档
- [`product/Yiveno-双线程发展原则.md`](./product/Yiveno-双线程发展原则.md) — **长期权威**：明线找 + 暗线记忆探索；五问 / 四边界 / 研究记录；产品文档 §0.1.2 短锚；ADR-016
- [`product/Yiveno-可见与契约分面-体验原则.md`](./product/Yiveno-可见与契约分面-体验原则.md) — **长期权威**：用户可见展示 vs 契约/传输字面；产品文档 §0.1.3 短锚；Recall 核心首波核查表
- [`product/Yiveno-国际化-CN-NA.md`](./product/Yiveno-国际化-CN-NA.md) — **Normative**：中国 + 北美双市场 i18n 八项轴、冻结与残差（en / zh_CN）
- [`product/Yiveno-环境反馈驱动进化-原则.md`](./product/Yiveno-环境反馈驱动进化-原则.md) — **工程子集**：证据 → 受控手段适应与 R5 分期（服从双线程正文）
- [`product/Yiveno-数据授权与本机反馈链路.md`](./product/Yiveno-数据授权与本机反馈链路.md) — **细节权威**：A/B/C 用途授权 + 本机链路；短锚在产品文档 §5.5.1；清除适应信号已接线
- [`archive/research/dual-thread-notes/`](./archive/research/dual-thread-notes/) — 暗线研究笔记（模板；私人数据不入仓）
- [`engineering/暗线基建-失败归因与受控适应.md`](./engineering/暗线基建-失败归因与受控适应.md) — 失败归因 / 适应旋钮登记 / 匿名草图 / 门禁（脚手架）
- [`product/Recall-Request-模型与Discovery边界.md`](./product/Recall-Request-模型与Discovery边界.md) — **Normative（2026-10-06 晋升 · D1 已裁决）**：Recall 必要条件 / Topic 两种来源 / Discovery 边界；完整正文在本文件；产品文档 §7.05 为摘要引用
- [`architecture/decisions/ADR-014-recall-request-topic-two-sources.md`](./architecture/decisions/ADR-014-recall-request-topic-two-sources.md) — 上述草案的 ADR 落档（D1-B 退化弱 Topic 模型化）
- [`architecture/decisions/ADR-016-environment-feedback-evolution.md`](./architecture/decisions/ADR-016-environment-feedback-evolution.md) — 环境反馈驱动进化：目标稳定、手段适应、反馈非真理
- [`architecture/decisions/ADR-017-cloud-sync-excerpt-only.md`](./architecture/decisions/ADR-017-cloud-sync-excerpt-only.md) — 云同步仅摘录；书签 Memory 本机化
- [`architecture/decisions/ADR-018-account-profile-data-isolation.md`](./architecture/decisions/ADR-018-account-profile-data-isolation.md) — Account vs Profile 隔离 · 未登录≟Free · 登录迁移门闸
- [`architecture/decisions/ADR-019-website-extension-ui-bridge.md`](./architecture/decisions/ADR-019-website-extension-ui-bridge.md) — 同浏览器官网 ↔ 扩展 UI Port 桥（登录/资料；可见才刷）
- [`architecture/decisions/ADR-020-chromium-dual-store-edge.md`](./architecture/decisions/ADR-020-chromium-dual-store-edge.md) — Chromium 双店同包（CWS + Edge Add-ons）；大陆主路径 Edge
- [`architecture/2026-10-任务级模型路由方案.md`](./architecture/2026-10-任务级模型路由方案.md) — **phase0-1-landed**：taskKind 观测 + 同模路由插座（非 Agent 集群）；未配分档 env = 行为同今日

**运维 / 工程（非规格，与正文冲突时以正文为准）**：

- [`engineering/DEV-调试API.md`](./engineering/DEV-调试API.md) — SW `yiveno.*` 调试 API 总索引与维护约定（探针种库、Omnibox 冒烟、TTE 读取等）
- [`engineering/语料适配器契约.md`](./engineering/语料适配器契约.md) — Corpus Adapter 边界、差距清单、第三方准入 checklist（R2）
- [`engineering/background-message-types.registry`](./engineering/background-message-types.registry) — Background `message type` 登记册（`bun run doc:check`）
- [`engineering/关键词倒排索引-Phase1.md`](./engineering/关键词倒排索引-Phase1.md) — 倒排预过滤设计（R3）
- [`engineering/业务日志与注释约定.md`](./engineering/业务日志与注释约定.md) — 中文注释与 flow log
- [`AUTH_GUIDE.md`](./AUTH_GUIDE.md) — OAuth / Email OTP 使用说明
- [`engineering/Turnstile-Email-OTP-防刷生命周期.md`](./engineering/Turnstile-Email-OTP-防刷生命周期.md) — Turnstile token 生命周期、发码流程图、china 区域约束
- [`engineering/Yiveno-Mermaid图表规范.md`](./engineering/Yiveno-Mermaid图表规范.md) — Mermaid 五类图适用场景与 Agent 同步纪律
- [`engineering/Yiveno-官网GEO.md`](./engineering/Yiveno-官网GEO.md) — 官网生成式引擎优化（JSON-LD / FAQ / llms.txt；≠ 地区域名 soft-redirect）
- [`engineering/org-agent-rules/`](./engineering/org-agent-rules/README.md) — Org Agent Rules 分层（L0 权威仓 [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules) + sync；本仓盘点与新仓接入）
- [`diagrams/`](./diagrams/) — 业务逻辑图清单（`registry.json`）· `bun run docs:sync-diagrams`
- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — 环境变量分层、同步与校验规则
- [`../EDGEADDONS.md`](../EDGEADDONS.md) — Edge Add-ons 上架元数据（与根目录 `CHROMEWEBSTORE.md` 对位）
- [`engineering/Edge-真机验收清单.md`](./engineering/Edge-真机验收清单.md) — Edge 稳定版加载仓库根 `dist/` 验收（ADR-020）

**设计 / 品牌（发版）：**

- [`design/Yiveno-设计标准-v1.md`](./design/Yiveno-设计标准-v1.md) — 视觉规范 Normative（含 §9 品牌核 + Roles）
- [`design/DESIGN.md`](./design/DESIGN.md) — 设计系统机器可读摘要（YAML tokens）
- [`design/brand-assets/README.md`](./design/brand-assets/README.md) — 仓内母本
- [`design/brand-asset-release-checklist.md`](./design/brand-asset-release-checklist.md) — 母本 → `public/` → 商店/官网
- [`design/figma-index.md`](./design/figma-index.md) — Figma Design 库 URL 索引（意图/comps；发版母本仍为 brand-assets）
- [`audits/2026-10-UI资产与Figma职责分配.md`](./audits/2026-10-UI资产与Figma职责分配.md) — UI 资产职责分配（P0 已落地）

**审计（工作区活跃）：**

- [`audits/`](./audits/) — 现行审计落盘；例：[`2026-10-国内化与多市场准备审计.md`](./audits/2026-10-国内化与多市场准备审计.md)、[`2026-10-多模型架构第一阶段准备工作.md`](./audits/2026-10-多模型架构第一阶段准备工作.md)、[`2026-10-多模型N1N2基线与N3对比准备.md`](./audits/2026-10-多模型N1N2基线与N3对比准备.md)、[`2026-10-多模型N3候选选型报告.md`](./audits/2026-10-多模型N3候选选型报告.md)、[`2026-10-多模型N3第二厂商桌面选型.md`](./audits/2026-10-多模型N3第二厂商桌面选型.md)、[`2026-10-多模型N3-OpenAI离线接入方案.md`](./audits/2026-10-多模型N3-OpenAI离线接入方案.md)、[`2026-10-多模型N3国内第二厂商桌面选型.md`](./audits/2026-10-多模型N3国内第二厂商桌面选型.md)、[`2026-10-三类模型独立评测与归因方案.md`](./audits/2026-10-三类模型独立评测与归因方案.md)、[`2026-10-L2召回消融实验报告.md`](./audits/2026-10-L2召回消融实验报告.md)、[`2026-10-L2召回消融-样本设计与实现差异.md`](./audits/2026-10-L2召回消融-样本设计与实现差异.md)、[`2026-10-L2召回消融-指标与金标审计.md`](./audits/2026-10-L2召回消融-指标与金标审计.md)、[`2026-10-B2否定约束生产链路审计.md`](./audits/2026-10-B2否定约束生产链路审计.md)、[`2026-10-B2否定约束最小闭环落地.md`](./audits/2026-10-B2否定约束最小闭环落地.md)、[`2026-10-B2否定约束生产回归审计.md`](./audits/2026-10-B2否定约束生产回归审计.md)、[`2026-10-B2排除匹配收紧落地.md`](./audits/2026-10-B2排除匹配收紧落地.md)、[`2026-10-运行时架构文档与实现漂移.md`](./audits/2026-10-运行时架构文档与实现漂移.md)（早期运行时架构文 ≠ HEAD 快照）

**归档（参考 · 非权威）：**

- [`archive/README.md`](./archive/README.md) — 历史文档入口（TTE 研究、市场调研、过时工程文档、审计快照等）
- [`archive/audits/`](./archive/audits/) — 2026-09 Reality Map / Phase1–2（已过期；勿当现行真相）

`extension/docs/` 已清空；i18n 方案定稿前不在此目录维护占位文档。

**合入与门禁：**

- [`.github/pull_request_template.md`](../.github/pull_request_template.md) — PR 勾选清单（§1.1 验收归属）
- [`.cursor/hooks.json`](../.cursor/hooks.json) — Agent `sessionStart` / 破坏性 git 拦截（见 [`.cursor/hooks/README.md`](../.cursor/hooks/README.md)）
- [`engineering/background-message-types.registry`](./engineering/background-message-types.registry) + `bun run doc:check` — message type / CURRENT 漂移门禁
- `bun run doc:check:consistency` — 代码 ↔ 文档一致性门禁（验证 ADR-001/004/005/007/012 等关键架构约束在代码中可被验证）
- `bun run docs:check-diagrams` — Mermaid 清单 / 锚点 / 结构语法（含于 `doc:check:all`）
