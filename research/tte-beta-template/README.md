# TTE Beta 研究包 · 模板目录

> **用途：** 复制本目录启动一次种子用户 TTE study；**不要**直接在模板里填真实用户数据后 commit。  
> **流程：** [`docs/engineering/TTE-种子用户研究-checklist.md`](../docs/engineering/TTE-种子用户研究-checklist.md)  
> **Normative 门槛：** [`Yiveno-产品文档-v4.0.md`](../docs/product/Yiveno-产品文档-v4.0.md) §5.9

## 如何使用

```bash
# 1. 复制为当次研究目录（勿改模板原目录）
cp -R research/tte-beta-template research/tte-beta-2026-09

# 2. 在副本里工作；录屏 / 含 PII 的 jsonl 勿提交 git
cd research/tte-beta-2026-09

# 3. 按 checklist §2 勾选推进
```

## 目录说明

| 路径                  | 说明                                                      |
| --------------------- | --------------------------------------------------------- |
| `consent-template.md` | 知情同意要点（发参与者前改写）                            |
| `screener.md`         | 入组筛选问卷                                              |
| `gold-cards/`         | 每任务一张 gold card；见 `P001-T01.md` 示例               |
| `sessions/`           | 录屏 + `*-events.jsonl`（**本地 only**，见 `.gitignore`） |
| `annotations/`        | ECS 双标注 CSV                                            |
| `report-vX.Y-beta.md` | 版本报告（填 §8 表 + taxonomy）                           |

## 文件命名

- 参与者：`P001` … `P030`（三位编号）
- 任务：`P001-T01` … `P001-T10`
- 事件日志：`sessions/P001-events.jsonl`
- 标注：`annotations/P001-T01-ecs.csv`

## 与埋点 schema

` sessions/*-events.jsonl` 每行一条 JSON，字段对齐产品文档 §5.9 与 `sessions/events.schema.json`（JSON Schema 示意，非运行时代码）。
