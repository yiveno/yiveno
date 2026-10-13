# ADR-001: Recall 主壳 = Chrome Side Panel

- **状态：** 已接受
- **日期：** 2026-08-21
- **决策者：** 产品 + 维护者（R-shell 波次）

## 背景

Action Popup 失焦即关，不适合持续对话式 Recall。Chrome Side Panel 提供稳定找回主战场，且与「找东西」心智一致，非通用 Chat 工作台。

## 决定

1. **Recall 主壳**迁至 `extension/src/pages/sidepanel/`。
2. 移除 `default_popup`；工具栏图标与 `_execute_action`（`Alt+Shift+Y`）一律打开 Side Panel。
3. **`pages/popup` 已删除**；不得恢复 Popup 作对话主壳。
4. P0：关 Side Panel 即丢会话；**New find** 显式清线程。
5. Omnibox P0 仍单次无会话。

## 后果

**必须：**

- 新 Recall UI 默认在 Side Panel 实现或复用其组件。
- `OPEN_RECALL_SHELL`（划词等 content → SW）/ Getting Started（**扩展页本页直调** `sidePanel.open`，因经 SW 会丢失用户手势）打开主壳。

**禁止：**

- 借 Side Panel 做书签树/整理中心。
- 持久多会话历史侧栏、分支、编辑消息、regenerate（除非先改产品文档 §7.0 与本 ADR）。

## 相关

- 产品文档 §0.4、§7.0；改版计划 R-shell / R-shell-session / R-shell-chat
- 代码：`extension/src/pages/sidepanel/`、`extension/public/manifest.json`
