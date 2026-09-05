# Yiveno Current Focus

> **用途：** 每个新 Agent 会话的「开机页」——对齐**当下**事实，避免多会话决策漂移。  
> **维护：** 换波次、合入显著功能时**只改本文**，再运行 `bun run sync:ide-boot`（同步 `.cursor/rules/session-boot.mdc`；`doc:check` 校验）。  
> **Agent 自动注入：** `session-boot.mdc`（alwaysApply）的「当下」块由本文生成。  
> **权威链：** [`Yiveno-术语表.md`](./Yiveno-术语表.md) → 本文 → [`Yiveno-产品文档-v4.0.md`](./Yiveno-产品文档-v4.0.md) §0 → [`Yiveno-改版计划-v1.md`](./Yiveno-改版计划-v1.md) 对应波次。  
> **架构决策（不可重议）：** [`../architecture/decisions/`](../architecture/decisions/)

**最后更新：** 2026-09-01

---

## 当前波次

| 项         | 状态                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------- |
| **主线**   | **§5.9 种子验证 + Recall 质量闭环**（`recall-eval` must 校准、Outcome Labeling §7.2、TTE 研究） |
| **并行**   | CWS 软上架包装（真实产品 UI 截图、商店文案）；Side Panel / Capture **仅 bugfix**                |
| **已结案** | frontend Skills 复查（`Skills-复查-Issues.md` P0–P2 全关）；popup 主壳已退役；见 ADR-001        |

## 本周做 / 不做

**做（按优先级）：**

1. **`recall-eval` must** 增补与校准——失败 case 驱动可复用机制（分词 / 索引 / Hybrid / Explain），禁止内容别名灰名单通解（见 `R4-Phase-E-验收与eval.md`、产品文档 §5.11）
2. **Outcome Labeling §7.2** P0→P1——诚实结算 `target` / `none_in_results` / verified retrieval（见 `R4-Outcome-Labeling-P2-校准.md`）
3. **TTE 种子用户研究**——按 `docs/engineering/TTE-种子用户研究-checklist.md` 准备/开跑；量 §5.9 Beta 行（TTE-V / Success@180 / ECS 合格率）
4. 行为变更同批：文档↔代码、`must` 或 §5 手动步骤、扩展用户可感路径 MCP UI 抽测

**并行（低优 · 不抢主线）：**

- CWS 产品 UI 截图 3–5（母本 `docs/design/brand-assets/chrome-web-store/`）
- Recall 壳空态 / onboarding 文案薄维护（`recall-shell-empty-copy`）

**不做：**

- 把 Skills 复查当主任务（已结案）
- 新连接器 / Agent / history 抓取 / 知识图谱 UI
- 未达 §5.9 门槛前扩 MCP 对外宣传
- 内容别名灰名单冒充全库通解
- Side Panel 持久多会话 / 分支 / regenerate 等 Chat 产品化
- 用 CWS 上架或功能堆砌替代命题验收（§0.1 命题先验）

## 已冻结决策（勿重议）

见 [`docs/architecture/decisions/`](../architecture/decisions/)：Side Panel 主壳、clue 术语、邻域非神谕、LLM 数据平面边界、禁止灰名单通解。

## 能力真相（速查）

**已上线（§1）：** Side Panel Recall、Hybrid、倒排 Phase 1、ECS 卡面、detail export、只读 MCP beta、Raindrop/Pocket 导入、TTE 本机埋点、Dodo Pro 门禁等——**完整表见产品文档 §1**。

**工程卫生：** frontend Skills 复查 backlog **已结案**（2026-09-01）；CWS 最低物料母本已落盘。

**未达对外门槛：** §5.9 **Beta**（种子用户真实库：TTE-V P50≤12s / Success@180≥75% / ECS≥92% 等）；**无种子 study 数据前不得对外宣称 Beta 达标**；MCP **不对用户主宣传**。

**进行中：** `recall-eval` must 校准；Outcome Labeling §7.2（P0+）；TTE 种子研究启动。

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
| 2026-09-01 | 换焦点：Skills 复查结案 → §5.9 种子验证 + recall-eval / Outcome Labeling 主线；CWS 并行降优    |
| 2026-08-28 | Task Brief 模板；hooks 移除 sessionStart（避免与 session-boot 重复）                           |
| 2026-08-28 | `sync:ide-boot`：CURRENT → session-boot「当下」块；`doc:check` 校验同步；根 `CLAUDE.md` 薄指针 |
| 2026-08-28 | 新增 `.cursor/rules/session-boot.mdc`（alwaysApply 开机层）                                    |
| 2026-08-28 | Phase 2：`doc:check`（message registry + CURRENT）· §5.8 冷启动壳 must 单测                    |
| 2026-08-28 | Phase 1：PR 模板、pre-push FE test:run、Cursor hooks（sessionStart + 拦截破坏性 git）          |
| 2026-08-28 | 初版：CURRENT + ADR 索引；对齐改版计划 R4 已落地表述                                           |
