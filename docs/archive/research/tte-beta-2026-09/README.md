# TTE Beta 研究包 · 2026-09（维护者单人 · 真实库）

> **参与者：** P001 = 维护者本人 · **库：** 个人真实 Chrome Memory（禁止探针 `replace` 清库）。  
> **流程：** [`solo-researcher-sop.md`](./solo-researcher-sop.md)（无团队精简版）  
> **完整 checklist：** [`docs/engineering/TTE-种子用户研究-checklist.md`](../docs/engineering/TTE-种子用户研究-checklist.md)

## 当前状态

| 项                   | 状态                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 研究包目录           | ✅                                                                                                                                        |
| 探针清库（A+B1）     | ✅ 74 条保留（精选 + 2 条真实 example.com）                                                                                               |
| Gold cards（10 条）  | ✅ 草稿齐；MCP batch **9/10 top-3** · **7/10 Top1**（T01 miss）                                                                           |
| AI 口语批 T12–T29    | ✅ 多批已确认（见 `sessions/P001-T*-batch-confirm.md`）                                                                                   |
| **ADR-011 时间分层** | ✅ high 硬筛 / low 软排（`time-confidence-plan.md`）                                                                                      |
| **自然 clue 采样**   | ▶️ **决策主线** — [`natural-clue-sampling.md`](./natural-clue-sampling.md) · 下一维 C：[`gist-sampling-plan.md`](./gist-sampling-plan.md) |
| §5.9 Beta 宣称       | ❌ 禁止（无种子 study 达标数据前）                                                                                                        |

## 快速开始

```bash
cd extension && bun run build
# chrome://extensions 重新加载 Yiveno

# 跑完任务后导出遥测 → sessions/P001-telemetry-export.json（勿 commit）
bun run tte:summarize -- research/tte-beta-2026-09/sessions/P001-telemetry-export.json
```

**本周优先：** 按 [`natural-clue-sampling.md`](./natural-clue-sampling.md) 开 ≥5 个真实目标采样（模板 `sessions/_TEMPLATE-natural-sample.md`）。

## 目录说明

| 路径                       | 说明                                         |
| -------------------------- | -------------------------------------------- |
| `solo-researcher-sop.md`   | **主流程**（单人）                           |
| `natural-clue-sampling.md` | **自然 clue 采样**（must / 优先级决策）      |
| `gist-sampling-plan.md`    | **C / gist** 采样门禁与下一刀候选（Phase A） |
| `time-confidence-plan.md`  | ADR-011 时间置信度（已落地）                 |
| `gold-cards/`              | 每任务一张；填真实 MemoryItem id             |
| `sessions/`                | 录屏 + 遥测 + batch-confirm + 采样卡         |
| `report-vX.Y-beta.md`      | 版本报告；n=1 须标内部试跑                   |

## 勿 commit

含真实 MemoryItem id、clue 原文、录屏、遥测导出的文件 — 见 `.gitignore`。
