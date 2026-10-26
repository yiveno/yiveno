# `.cursor/rules/` — Agent 规则分层

> **Cursor 每会话自动加载** `alwaysApply: true` 的 `.mdc` 文件。  
> **仓库：** GitHub Org [`yiveno/yiveno`](https://github.com/yiveno/yiveno) · 品牌 [`yiveno.com`](https://yiveno.com)。

| 文件                       | 角色                                                    | 何时改                                    |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| **`session-boot.mdc`**     | **Cursor 开机层**（当下块由 CURRENT 同步）              | 改 `CURRENT.md` → `bun run sync:ide-boot` |
| `terminology.mdc`          | 术语硬规则（clue、禁止 Search 等）                      | 改术语表后同步                            |
| `dev-chinese-plain.mdc`    | 开发者面沟通：清晰优先、术语释义、解释结构 + 正规词表   | 沟通风格 / 黑话清单变更时                 |
| `project.mdc`              | **Yiveno 项目硬规则的单一权威**（分层、MCP、文档↔代码） | 架构/验证策略变更（详 ADR-013）           |
| `agent-core.mdc`           | AI **行为元规则**（项目无关；AI 怎么思考与交付）        | 极小改动；可移植                          |
| `git-workdir-safety.mdc`   | 禁止破坏性 git 还原 WIP                                 | 极少改                                    |
| `testing-real-library.mdc` | 测试默认个人真实库；数据操作无需逐次询问                | 维护者偏好变更时                          |

> **当前 AI 工具 = Cursor**（唯一激活 IDE 入口；`alwaysApply: true` 自动注入）。其它 IDE 薄指针历史文件已删，未来新增/切换按 ADR-013 §7 路径走。

**用户每会话：** 复制 [`docs/product/AGENT-TASK-BRIEF.template.md`](../docs/product/AGENT-TASK-BRIEF.template.md) 填 scope（开机层已注入，Brief 只补本任务）。**长会话收尾：** 同模板「会话收尾 · Handoff」→ 新会话首条粘贴 Handoff 块（不绑定 commit/push）。

**校验：** `bun run doc:check`（含 `sync:ide-boot --check`）· message registry

**跨 IDE：** 根目录 [`AGENTS.md`](../AGENTS.md)（仓库根薄指针；当前 AI 工具 = Cursor） · [`ADR-013`](../../architecture/decisions/ADR-013-ai-collaboration-scaffolding.md)（脚手架收敛决策）
