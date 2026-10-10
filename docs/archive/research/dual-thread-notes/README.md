---
created: 2026-10-09T18:53:46+08:00
updated: 2026-10-10T15:51:57+08:00
author: agent:cursor
scope: 双线程暗线研究笔记目录说明
status: active-research
upstream:
  - docs/product/Yiveno-双线程发展原则.md §4
downstream:
  - docs/archive/research/dual-thread-notes/_TEMPLATE.md
---

# 双线程暗线 · 研究笔记

> **权威：** [`Yiveno-双线程发展原则.md`](../../../product/Yiveno-双线程发展原则.md)  
> **用途：** 暗线正式载体——保留假设、数据来源、替代解释、验证结果与置信度。  
> **本目录在 `archive/research/`：** 与 TTE 研究包同层；**工作中的研究笔记可在此维护**（非「已废弃产品文档」）。

## 索引

| 笔记                                                                                 | 状态                   | 一句话                                            |
| ------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------- |
| [`2026-10-10-clue-memory-anchor-types.md`](./2026-10-10-clue-memory-anchor-types.md) | in-progress · 首批汇总 | H1 方向支持（n&lt;10）；H2/H3 不足；无原文入仓    |
| [`2026-10-10-补采检查清单-NS至10.md`](./2026-10-10-补采检查清单-NS至10.md)           | active                 | 再采 ≥4–5 独立首句；miss 必 clue₂；进度板 NS08–12 |

## 纪律

- 复制 `_TEMPLATE.md` → `YYYY-MM-DD-<短题>.md`（或主题子目录）。
- **禁止** commit：私人遥测 JSON 全文、完整库导出、可识别私人内容。需要数字时写汇总表或匿名化摘要。
- 假设写在验证**之前**；禁止事后编造冒充事先假设。
- 产品数据 = 特定环境下的行为证据，**≠** 人脑机制定律。

## 基建口子

- 工程说明：[`暗线基建-失败归因与受控适应.md`](../../engineering/暗线基建-失败归因与受控适应.md)
- 填卡归因：`RecallFailureStage`（见模板 §3.1）
- DEV 匿名草图：`await yiveno.exportDualThreadAggregateSketch()`

## 与明线的关系

笔记结论若要改产品行为 → 先过产品文档 / must 或 §5，再改代码；不得用「暗线有趣」绕过明线验收。
