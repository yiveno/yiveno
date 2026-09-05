# Agent Task Brief（复制到会话首条）

> **用途：** 每开一个新 Agent 会话，复制本模板填空后发第一条消息。  
> **开机层：** `.cursor/rules/session-boot.mdc` 已自动注入；本 Brief 只补充**本任务** scope。  
> **勿删模板文件**；只复制下方「---」之间的内容。

---

```text
## Task Brief

### Scope
- **In：**（本任务只改哪些路径/能力，例：`frontend/src/core/recall/`）
- **Out：**（明确不做，例：不改 backend、不加 message type、不碰 i18n 全量）

### 必读（仅与本任务相关时再 @）
- （例：`@docs/product/Yiveno-术语表.md` · `@docs/engineering/R4-Phase-E-验收与eval.md`）

### 验收（报完成前你必须满足）
- （例：相关 `test:run` 绿 · recall-eval must · `doc:check` · MCP Side Panel 抽测 1 条）

### 禁止
- （例：灰名单 alias · 未上线能力接线 · 跨模块顺手重构）

### 备注（可选）
- （例：延续上次关于划词菜单的讨论；或贴 issue/截图要点）

### Handoff（新会话延续时填写）
- **工作区基线：**分支；是否有未提交 WIP（列路径，**不**为交接而 commit）
- **上一步：**上一会话结果（一句）
- **本步：**本会话目标（一句）
```

---

## 会话收尾（当前会话 · 上下文过长时）

在**当前会话最后一条**粘贴（Agent 只产出 Handoff，**不**默认 commit / push / stash）：

```text
## 会话收尾 · Handoff（不 commit / 不 push）

请在本条回复内完成交接，不要开新代码任务：

1. **工作区快照**：`git status` 结论（仅描述；禁止 restore/checkout 丢 WIP）
2. **交付摘要**：≤10 条 bullet（路径级；test/MCP 过没过）
3. **文档**：改了哪些权威文档；`CURRENT` 是否需 `bun run sync:ide-boot`（只提醒，不替我提交）
4. **未完成**：下一动作 1～3 条 + 禁止项
5. **Handoff 块**：单独一个 fenced 代码块，含完整 Task Brief + Handoff 三行 + 建议 @（≤3）

纪律：未经我明确要求，不要 commit / push / stash。
```

---

## 新会话首条（接续上一会话）

**做法：** 新建 Cursor 会话 → **首条只粘贴**上一会话输出的 **Handoff 代码块**（可再加一句执行指令，见下）。

**最短开场（粘贴 Handoff 后可选加一行）：**

```text
请按上方 Task Brief 执行；开始前先 `git status` 确认 WIP，不要 restore/checkout。
```

**无需**复述旧对话、无需 @CURRENT（`session-boot` 已注入；焦点以 Handoff 与 `docs/product/CURRENT.md` 为准）。

---

## 示例（Recall 壳空态小改）

```text
## Task Brief

### Scope
- **In：**`frontend/src/core/recall/recall-shell-empty-copy.ts` + 相关单测 + 必要 i18n key
- **Out：**不改 Recall 排序/理解层；不加 message type；不动 backend

### 必读
- @docs/product/Yiveno-术语表.md（clue / 邻域 / 附注）

### 验收
- `cd frontend && bun run test:run -- recall-shell-empty-copy cold-start-shell-contract`
- 扩展空态 MCP：空库 Side Panel 一眼扫文案无助理口吻

### 禁止
- Side Panel Chat 大改 · popup 复活 · Search 文案
```
