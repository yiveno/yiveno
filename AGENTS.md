# AGENTS.md（Yiveno AI 协作脚手架 · 仓库根薄指针）

> **薄指针**——所有权威硬规则集中在 `.cursor/rules/`（Cursor alwaysApply 自动注入）与 `docs/product/`（Normative 文档）。  
> 本文件只做：**仓库归属 + 入口索引 + 当前 AI 工具说明 + 未来扩展接口**。

**仓库归属（勿误判）：** GitHub **Org** `yiveno` · 主仓 [`yiveno/yiveno`](https://github.com/yiveno/yiveno)；对应品牌 [`yiveno.com`](https://yiveno.com)，**不是**维护者个人名下的实验仓。Issue/PR 作者显示个人 GitHub 账号属正常，**不以作者判断仓库归属**。

## 当前 AI 工具

Yiveno 维护者当前 AI 编程工具 = **Cursor**（唯一激活的 IDE 入口）。Cursor 自动加载 `.cursor/rules/*.mdc`，无需任何额外启动文件。

其它 IDE（Claude Code / Gemini CLI / Codex CLI 等）的历史薄指针已删除（见 ADR-013）。

**外部协作 Agent（非 IDE 入口）：** Muse —— 不走 IDE 启动文件，不复述项目硬规则；与 Cursor 的分工、交接与审查协议见 [`docs/engineering/Muse-Cursor-协作分工协议.md`](./docs/engineering/Muse-Cursor-协作分工协议.md)。Muse 对本仓的写入只走分支 + PR，由维护者合并。

## 权威入口（开机必读，按序）

1. **Cursor 开机层**（alwaysApply · 自动注入）：`.cursor/rules/session-boot.mdc`
2. **Yiveno 硬规则（单一权威）**：`.cursor/rules/project.mdc`
3. **术语（唯一权威）**：`docs/product/Yiveno-术语表.md`
4. **当下焦点（唯一手写源）**：`docs/product/CURRENT.md` → `bun run sync:ide-boot`
5. **产品行为契约**：`docs/product/Yiveno-产品文档-v4.0.md` §0–§7
6. **架构决策（ADR）**：`docs/architecture/decisions/`
7. **视觉/品牌（Normative）**：`docs/design/Yiveno-设计标准-v1.md`

冲突时遵循权威优先级（见 `project.mdc`）。

## 未来扩展接口（新增 AI 工具时怎么加）

维护者**切换或新增 AI 工具**时（如 Claude Code、Gemini CLI、Codex CLI、Windsurf 等），按 ADR-013 §7：

1. **新增工具启动文件**：`.<tool>/.<tool>.md`（或工具约定的位置）。
2. **只放工具特有偏好**：caveman 强度、commit 风格、本地路径差异等；**不复述**项目硬规则。
3. **追加入口行**：在本文件"权威入口"上添加一行指向新文件。
4. **必要时扩展同步门禁**：参考现有 `scripts/sync-ide-boot.mjs`（当前仅同步 `session-boot.mdc`）。

**原则：** Yiveno 项目准则永远是同一份（产品文档 / 术语表 / 当前焦点 / 架构铁律 / 代码约定）。AI 工具差异只发生在格式层，**不发生在内容层**。

## 维护

- **新增/改 Yiveno 项目规则**：先改 `.cursor/rules/project.mdc`（单一权威）。
- **换波次**：只改 `docs/product/CURRENT.md` → `bun run sync:ide-boot`。
- **不可逆架构决策**：补 ADR 到 `docs/architecture/decisions/`。
- **每会话首条**：复制 [`docs/product/AGENT-TASK-BRIEF.template.md`](./docs/product/AGENT-TASK-BRIEF.template.md) 填 scope。
- **CI 门禁**：`bun run doc:check`（含 `sync:ide-boot --check`）。

详细索引：[`.cursor/rules/README.md`](./.cursor/rules/README.md) · [`docs/README.md`](./docs/README.md) · [`CHROMEWEBSTORE.md`](./CHROMEWEBSTORE.md)（Chrome 上架）· [`EDGEADDONS.md`](./EDGEADDONS.md)（Edge Add-ons · ADR-020）· [`ADR-013`](./docs/architecture/decisions/ADR-013-ai-collaboration-scaffolding.md)（脚手架收敛决策）· Org 共用规则 [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules)（L0 sync；说明见 [`docs/engineering/org-agent-rules/`](./docs/engineering/org-agent-rules/README.md)）。
