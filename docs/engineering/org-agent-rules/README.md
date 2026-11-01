---
created: 2026-10-31T23:01:41+08:00
updated: 2026-10-31T23:30:00+08:00
author: agent:cursor
scope: Yiveno Org Agent Rules 分层规范（L0/L1/L2）与主仓入口
status: active
upstream:
  - docs/architecture/decisions/ADR-013-ai-collaboration-scaffolding.md
  - https://github.com/yiveno/agent-rules
  - .cursor/rules/
downstream:
  - docs/engineering/org-agent-rules/2026-10-本仓Rules盘点.md
  - docs/engineering/org-agent-rules/新仓接入清单.md
---

# Yiveno Org Agent Rules

> **L0 权威源（已上线）：** [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules)（`rules/` + `scripts/sync-to-repo.sh`）。  
> **本目录** = 主产品仓内的分层说明、盘点归档与新仓接入入口。  
> **主产品仓已 flat sync：** L0 平铺在 [`.cursor/rules/`](../../../.cursor/rules/)（与 L2 共存）；`commit-message` / `dev-chinese-plain` / `project` 已收薄为附录或路径表。Cursor **勿**用 `shared/` 子目录当主路径（加载不可靠）。

## 1. 为何分层

GitHub Org `yiveno` 会有多种仓（主产品、运营 agent、客服 agent 等），技术栈与语言各异。规则必须拆成：

| 层     | 名称           | 判定题                               | 放什么                                                                           |
| ------ | -------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| **L0** | Org 共用       | 「换技术栈后这条还成立吗？」         | 见 [`agent-rules/rules/`](https://github.com/yiveno/agent-rules/tree/main/rules) |
| **L1** | 产品族（可选） | 「换栈不成立，但同品牌多仓仍共享？」 | 术语模式、产品面/开发者面语言分离等（尚未独立成包）                              |
| **L2** | 单仓           | 「依赖本仓路径、工具、栈、验收？」   | 各仓 `project.mdc`、术语词条、开机层、CI、MCP/Chrome 等                          |

```
L0（栈无关 · agent-rules） → L1（可选） → L2（本仓硬路径）
冲突时：工程安全与专业标准（agent-core §0.1）≥ 各仓已编码的工程约束；产品语义以该仓 Normative / project 为准。
```

## 2. 与 ADR-013 的关系

[ADR-013](../../architecture/decisions/ADR-013-ai-collaboration-scaffolding.md) 钉死：`agent-core` 可移植、`project.mdc` 为本仓权威、`AGENTS.md` 薄指针。  
Org 多仓分发由 **`yiveno/agent-rules` + sync 拷贝** 落地（见 ADR-013 变更记录 2026-10-31）。

## 3. 分发约定

| 项           | 约定                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| **权威源**   | [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules)                     |
| **进各仓**   | `./scripts/sync-to-repo.sh <目标仓路径>` → **平铺** `.cursor/rules/`（默认 flat） |
| **不用**     | Cursor User Rules 当权威；git submodule；npm 包；`shared/` 子目录当主路径         |
| **主产品仓** | 已 sync；L2 附录与 `project.mdc` 手写维护；改 L0 → agent-rules → 再 sync          |

## 4. 本目录文件

| 路径                                                   | 作用                          |
| ------------------------------------------------------ | ----------------------------- |
| [2026-10-本仓Rules盘点.md](./2026-10-本仓Rules盘点.md) | 主仓逐文件审视与归属（归档）  |
| [新仓接入清单.md](./新仓接入清单.md)                   | 运营/客服等新仓勾选步骤       |
| [drafts/](./drafts/)                                   | **已迁出**；仅保留指针 README |

## 5. 新仓落位（flat）

```text
.cursor/rules/                 # 全部平铺
  agent-core.mdc               # L0 sync · 只读
  …（其余 5 个 L0）
  ORG_L0_SYNC.md
  project.mdc                  # L2 手写
  commit-message.mdc           # L2 附录（可选）
  terminology.mdc / session-boot.mdc  # L2 按需
```

```bash
git clone git@github.com:yiveno/agent-rules.git
cd agent-rules
./scripts/sync-to-repo.sh /path/to/new-repo --templates
# 写 project.mdc；删掉与 L0 重复的旧全文
```

细节见 [新仓接入清单.md](./新仓接入清单.md)。

## 6. 维护

- 改 L0 → **只改** `yiveno/agent-rules` → 各业务仓重新 sync。
- 改主产品 L2 → 改本仓 `project.mdc` / 附录 / terminology / session-boot。
- 索引：[`.cursor/rules/README.md`](../../../.cursor/rules/README.md)。
