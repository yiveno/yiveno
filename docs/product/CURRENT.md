# Yiveno Current Focus

> **用途：** 每个新 Agent 会话的「开机页」——对齐**当下**事实，避免多会话决策漂移。  
> **维护：** 换波次、合入显著功能时**只改本文**，再运行 `bun run sync:ide-boot`（同步 `.cursor/rules/session-boot.mdc`；`doc:check` 校验）。  
> **Agent 自动注入：** `session-boot.mdc`（alwaysApply）的「当下」块由本文生成。  
> **权威链：** [`Yiveno-术语表.md`](./Yiveno-术语表.md) → 本文 → [`Yiveno-产品文档-v4.0.md`](./Yiveno-产品文档-v4.0.md) §0 → [`Yiveno-改版计划-v1.md`](./Yiveno-改版计划-v1.md) 对应波次。  
> **架构决策（不可重议）：** [`../architecture/decisions/`](../architecture/decisions/)

**最后更新：** 2026-09-10

---

## 当前波次

| 项         | 状态                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **主线**   | **§5.9 种子验证 + Recall 质量闭环**（自然 clue 采样决策 + `recall-eval` / TTE / Outcome §7.2）         |
| **并行**   | **ADR-011 时间置信度分层**（糊时间软排，禁止硬空）；CWS 软上架包装；Side Panel / Capture **仅 bugfix** |
| **已结案** | frontend Skills 复查（`Skills-复查-Issues.md` P0–P2 全关）；popup 主壳已退役；见 ADR-001               |

## 本周做 / 不做

**做（按优先级）：**

1. **自然 clue 采样协议**（真实目标 · 「还记得什么都行」· 首句标注 · 1/2 clue TTE）— 决策 must 扩面；见 `research/tte-beta-2026-09/`
2. **ADR-011 时间置信度**落地与回归（high 硬筛 / low 软排；Framing Around；must + MCP）— `time-confidence-plan.md`
3. **`recall-eval` must** 增补与校准——失败 case 驱动可复用机制，禁止内容别名灰名单通解
4. **Outcome Labeling §7.2** P0→P1；TTE 种子研究按 checklist 开跑
5. 行为变更同批：文档↔代码、`must` 或 §5 手动步骤、扩展用户可感路径 MCP UI 抽测

**并行（低优 · 不抢主线）：**

- CWS 产品 UI 截图 3–5（母本 `docs/design/brand-assets/chrome-web-store/`）
- Recall 壳空态 / onboarding 文案薄维护（`recall-shell-empty-copy`）

**不做：**

- 把 Skills 复查当主任务（已结案）
- 新连接器 / Agent / history 抓取 / 知识图谱 UI
- 未达 §5.9 门槛前扩 MCP 对外宣传
- 内容别名灰名单冒充全库通解；为糊时间堆开放同义词表
- Side Panel 持久多会话 / 分支 /tokenize 等 Chat 产品化
- 用 CWS 上架或功能堆砌替代命题验收（§0.1 命题先验）

## 已冻结决策（勿重议）

见 [`docs/architecture/decisions/`](../architecture/decisions/)：Side Panel 主壳、clue 术语、邻域非神谕、LLM 数据平面边界、禁止灰名单通解、**ADR-010 理解流水线**、**ADR-011 时间置信度分层**。

## 能力真相（速查）

**已上线（§1）：** Side Panel Recall、Hybrid、倒排 Phase 1、ECS 卡面、detail export、只读 MCP beta、Raindrop/Pocket 导入、TTE 本机埋点、Dodo Pro 门禁等——**完整表见产品文档 §1**。

**工程卫生：** frontend Skills 复查 backlog **已结案**（2026-09-01）；CWS 最低物料母本已落盘。

**未达对外门槛：** §5.9 **Beta**（种子用户真实库：TTE-V P50≤12s / Success@180≥75% / ECS≥92% 等）；**无种子 study 数据前不得对外宣称 Beta 达标**；MCP **不对用户主宣传**。

**进行中：** 自然 clue 采样；ADR-011 时间置信度；`recall-eval` must；Outcome Labeling §7.2；TTE 种子研究。

## 新会话建议开场

1. **复制** [`AGENT-TASK-BRIEF.template.md`](./AGENT-TASK-BRIEF.template.md) 填空，作为首条消息（scope / 验收 / 禁止）
2. 开机层 `session-boot.mdc` 已自动注入，**通常不必** `@CURRENT`

```text
（粘贴填好的 Task Brief）
```

## 报完成前必过

1. 相关单测；Recall/Capture 用户可感 → `recall-eval` **must** 或 §5 手动步骤
2. 文档↔代码已同批对齐（含本文若换焦点）
3. 扩展用户可感 → MCP 真机 UI 路径抽测 ≥1 条

---

## Changelog

| 日期       | 变更                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 2026-09-10 | ADR-011 时间置信度分层；主线并列自然 clue 采样；见 `time-confidence-plan.md`                   |
| 2026-09-08 | 接受 ADR-010；相对时间闭集增 `last_month` / `few_months_ago`（P0 · 对齐 NA 口语 / T13）        |
| 2026-09-01 | 换焦点：Skills 复查结案 → §5.9 种子验证 + recall-eval / Outcome Labeling 主线；CWS 并行降优    |
| 2026-08-28 | Task Brief 模板；hooks 移除 sessionStart（避免与 session-boot 重复）                           |
| 2026-08-28 | `sync:ide-boot`：CURRENT → session-boot「当下」块；`doc:check` 校验同步；根 `CLAUDE.md` 薄指针 |
| 2026-08-28 | 新增 `.cursor/rules/session-boot.mdc`（alwaysApply 开机层）                                    |
| 2026-08-28 | Phase 2：`doc:check`（message registry + CURRENT）· §5.8 冷启动壳 must 单测                    |
| 2026-08-28 | Phase 1：PR 模板、pre-push FE test:run、Cursor hooks（sessionStart + 拦截破坏性 git）          |
| 2026-08-28 | 初版：CURRENT + ADR 索引；对齐改版计划 R4 已落地表述                                           |
