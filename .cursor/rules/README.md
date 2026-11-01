# `.cursor/rules/` — Agent 规则分层

> **Cursor** 加载本目录下 `alwaysApply: true` 的 `.mdc`（**平铺**；勿依赖子目录）。  
> **仓库：** GitHub Org [`yiveno/yiveno`](https://github.com/yiveno/yiveno) · 品牌 [`yiveno.com`](https://yiveno.com)。  
> **Org L0 权威：** [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules) → `./scripts/sync-to-repo.sh <本仓>` 平铺回灌。分层说明：[`docs/engineering/org-agent-rules/`](../../docs/engineering/org-agent-rules/README.md)。

## Org L0（sync 生成 · 约定只读）

| 文件                                      | 角色                      |
| ----------------------------------------- | ------------------------- |
| `agent-core.mdc`                          | 行为元规则                |
| `git-workdir-safety.mdc`                  | 禁静默丢 WIP              |
| `commit-message-core.mdc`                 | commit 格式核             |
| `dev-chinese-plain-core.mdc`              | 开发者沟通原则核          |
| `session-discipline.mdc`                  | Brief / 必选可选 / 优先级 |
| `docs-sync-iron.mdc`                      | 文档↔代码同步原则         |
| `ORG_L0_SYNC.md` / `ORG_L0_SYNC_META.txt` | sync 标记（非规则正文）   |

改 L0 → 改 `agent-rules` → 再 sync；**禁止**在本仓改这些文件当权威。

## 本仓 L2（手写）

| 文件                       | 角色                                   | 何时改                                    |
| -------------------------- | -------------------------------------- | ----------------------------------------- |
| **`session-boot.mdc`**     | 开机层（CURRENT 同步）                 | 改 `CURRENT.md` → `bun run sync:ide-boot` |
| `terminology.mdc`          | 产品术语锚点                           | 改术语表后同步                            |
| `project.mdc`              | **本仓硬规则权威**（产品/架构/MCP/栈） | 架构/验证策略变更                         |
| `commit-message.mdc`       | commit **附录**（hook/示例/术语）      | 本仓示例或 hook 变更                      |
| `dev-chinese-plain.mdc`    | 沟通 **附录**（鉴权词表等）            | 本仓对照表变更                            |
| `testing-real-library.mdc` | 维护者真库测试偏好                     | 维护者偏好变更                            |

> **当前 AI 工具 = Cursor**。其它 IDE 薄指针按 ADR-013 §7。

**用户每会话：** 复制 [`docs/product/AGENT-TASK-BRIEF.template.md`](../../docs/product/AGENT-TASK-BRIEF.template.md) 填 scope。**长会话收尾：** Handoff 块（不绑定 commit/push）。

**校验：** `bun run doc:check`（含 `sync:ide-boot --check`）· message registry

**跨 IDE：** [`AGENTS.md`](../../AGENTS.md) · [`ADR-013`](../../docs/architecture/decisions/ADR-013-ai-collaboration-scaffolding.md) · [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules)
