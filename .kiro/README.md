# `.kiro/` — Kiro 工具配置（非 AI 规则权威）

> **Cursor / 通用 Agent 规则唯一权威：** `.cursor/rules/` + `AGENTS.md` + `docs/product/CURRENT.md`  
> 本目录仅保留 Kiro 专用 hooks / skills；**勿**在此维护与 `.cursor/rules` 重复的长文规则。

| 路径                        | 用途                              |
| --------------------------- | --------------------------------- |
| `.kiro/steering/project.md` | 指向 `.cursor/rules` 的短摘要入口 |
| `.kiro/hooks/*`             | Kiro 质量检查 hook                |
| `.kiro/skills/*`            | Kiro 技能（扩展架构等）           |

冲突时以 `.cursor/rules/project.mdc` 与 `docs/product/Yiveno-产品文档-v4.0.md` 为准。
