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
```

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
