# ADR-013: AI 协作脚手架收敛（单一权威 + 可复用准则）

- **状态：** 已接受
- **日期：** 2026-09-16
- **决策者：** 维护者 + `.cursor/rules/project.mdc`（单一权威）

## 背景

仓库中存在**职责不清、重复与漂移**的 AI 协作文件：

| 文件                             | 体量   | 性质                                                 |
| -------------------------------- | ------ | ---------------------------------------------------- |
| `.cursor/rules/project.mdc`      | 368 行 | Cursor alwaysApply；Yiveno 行为铁律（**单一权威**）  |
| `.cursor/rules/agent-core.mdc`   | 367 行 | Cursor alwaysApply；AI 行为元规则（项目无关）        |
| `.cursor/rules/session-boot.mdc` | 61 行  | Cursor alwaysApply；当下焦点（sync 自 CURRENT）      |
| 仓库根 `AGENTS.md`               | 162 行 | 仓库根自动注入；**事实是 project.mdc 的镜像 + 漂移** |
| 仓库根 `CLAUDE.md`               | 26 行  | Claude Code 启动钩子                                 |
| 仓库根 `GEMINI.md`               | 25 行  | Gemini CLI 启动钩子                                  |
| `.codex/.codex.md`               | 14 行  | Codex CLI 启动钩子（3 个月未更新）                   |

**问题：**

1. Cursor 启动时同时吃 `project.mdc`（368 行）+ `AGENTS.md`（162 行），**重复内容约 75-80%**，单次会话白白占上下文。
2. `project.mdc` 与 `AGENTS.md` 各自的"权威优先级"措辞互相覆盖（`本文件 ≈ AGENTS.md` vs 不明示），给 AI 阅读带来歧义。
3. `sync:ide-boot` 只同步 `session-boot.mdc` 一处；其它文件全靠手工，**已发生漂移**。
4. `agent-core.mdc` 写死"Yiveno Agent Core"，未来若项目要复用到其它项目无法直接移植。
5. **近期事实：** Yiveno 维护者 AI 编程工具 = Cursor；`CLAUDE.md` / `GEMINI.md` / `.codex.md` 短期无人读，是**死代码**。

## 决定

### 1. 单一权威

`.cursor/rules/project.mdc` 为 Yiveno AI 协作硬规则的**唯一权威**（与产品文档冲突时仍以产品文档为准）。

### 2. 职责分层

| 文件                                                                      | 角色                                             | 项目相关            |
| ------------------------------------------------------------------------- | ------------------------------------------------ | ------------------- |
| `agent-core.mdc`                                                          | **行为元规则**（AI 怎么思考与交付）              | ❌ 项目无关，可移植 |
| `project.mdc`                                                             | **项目硬规则**（Yiveno 怎么做事）                | ✅ 单一权威         |
| `session-boot.mdc`                                                        | **当下焦点**（由 CURRENT 同步）                  | ✅                  |
| `terminology.mdc` / `git-workdir-safety.mdc` / `testing-real-library.mdc` | 专项硬规则                                       | ✅                  |
| 仓库根 `AGENTS.md`                                                        | **薄指针**（仓库归属 + 入口索引 + 未来扩展接口） | ✅ 薄               |

### 3. `AGENTS.md` 改为真·薄指针

只保留：

- 仓库归属
- 权威入口索引（指向 `.cursor/rules/project.mdc` 等）
- 未来扩展接口说明（新增 AI 工具时怎么加）
- 维护约定（哪份文件是源、同步命令）

### 4. `AGENTS.md` 独有内容并入 `project.mdc`

- 三层职责 / CI 矩阵 / 本地命令 / 环境变量段全部并入 `project.mdc` 的「验证」与「环境变量」段。

### 5. `agent-core.mdc` 去项目化

写明"本文件 = 行为元规则；项目特有规则见 project.mdc"。可移植到其它项目。

### 6. 当前 AI 工具策略 = 仅 Cursor

- Yiveno 维护者当前 AI 编程工具 = Cursor，**这是唯一激活的 IDE 入口**。
- 仓库根 `CLAUDE.md` / `GEMINI.md` / `.codex/.codex.md` 是历史遗留薄指针，短期无人读，**本 PR 删除**。

### 7. 未来扩展路径

- 维护者**切换或新增 AI 工具**时（如 Claude Code、Gemini CLI、Codex CLI、Windsurf 等）：
  - **第一步：** 新增 `.<tool>/.<tool>.md`（或工具约定的启动文件）。
  - **第二步：** 内容只放**该工具特有的偏好/格式**（如 caveman 强度、commit 风格、本地路径差异），不复述项目硬规则。
  - **第三步：** `AGENTS.md` 的"未来扩展接口"段追加一行指向新文件。
  - **第四步：** 必要时扩展 `sync:ide-boot` 同步该文件与 `.cursor/rules/` 的漂移（参考现有 `session-boot.mdc` 同步门禁）。
- **不变原则：** Yiveno 项目准则（产品文档 / 术语表 / 当前焦点 / 架构铁律 / 代码约定）**永远是同一份**——AI 工具差异只发生在格式层，不发生在内容层。

## 后果

**必须：**

- 新增 Yiveno 项目特有规则 → **只改 `project.mdc`**。
- 改动 `AGENTS.md` → 手工维护（它本身就是薄指针），但禁止长篇累牍抄硬规则。
- 新增 AI 工具 → 按本 ADR §7 未来扩展路径，**先改 AGENTS.md 入口**，再扩展同步门禁。

**禁止：**

- 在薄指针里**长篇累牍抄硬规则**（薄指针就该 ≤ 几 K）。
- 让 `AGENTS.md` 与 `project.mdc` 同时承载**事实**（造成 1+N 同步）。
- 让 `agent-core.mdc` 再次写死项目名。
- 短期新增 Claude / Gemini / Codex 薄指针，除非真正切换或并存使用。

**风险与缓解：**

- **未来切换 IDE 时需要重新生成薄指针** → 简单（按 §7 走；新工具启动文件 ≤ 50 行）。
- **多 IDE 并存时同步漂移** → 仍由 `sync:ide-boot` 兜底；切换前先评估是否扩展同步门禁。

## 相关

- `.cursor/rules/project.mdc`（单一权威）
- `.cursor/rules/agent-core.mdc`（行为元规则）
- `.cursor/rules/README.md` · `docs/README.md`（索引）
- `scripts/sync-ide-boot.mjs`（同步门禁；当前仅同步 session-boot.mdc）
- `docs/product/CURRENT.md`（当下焦点；`sync:ide-boot` 数据源）
- [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules)（Org L0 权威 + sync；2026-10-31）
- `docs/engineering/org-agent-rules/`（分层说明与新仓接入）

## 变更记录

- **2026-10-31** Org 多仓分发：创建 [`yiveno/agent-rules`](https://github.com/yiveno/agent-rules) 承载 L0 权威（`rules/`）与 `scripts/sync-to-repo.sh`（拷贝至各仓 `.cursor/rules/shared/`）。主产品仓运行时仍为本仓 `.cursor/rules/`（暂不双重注入）。入口说明：`docs/engineering/org-agent-rules/`。与 [`yiveno/yiveno-agent`](https://github.com/yiveno/yiveno-agent)（运行时基建）职责分离。
- **2026-09-16** 初版：删除 `.claude/CLAUDE.md` 与 `AGENTS.original.md`（历史遗留）；`AGENTS.md` 收敛为薄指针；`agent-core.mdc` 去项目化；`project.mdc` 成为单一权威；删除死代码 `CLAUDE.md` / `GEMINI.md` / `.codex/.codex.md`。
