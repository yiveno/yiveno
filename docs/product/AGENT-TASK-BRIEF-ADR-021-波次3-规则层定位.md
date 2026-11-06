# Task Brief · ADR-021 波次 3 · 规则层定位对齐

> **状态：** 已完成（2026-11-06）  
> **前置：** 波次 1–2；规则层价值重估（契约接地 + 快跳 + 降级垫片）

---

```text
## Task Brief

### Scope
- **In：**
  - `selectClueUnderstandingMode`：无 completer 时 mode 一律 `lexical`（删「口语→伪 semantic」启发式）
  - `parse-recall-clue*` / `nlu:try` 头注释钉三角色
  - 产品文档 §0.1.4 + M1：规则层角色表（是/否）
- **Out：**
  - 不删/不大改 lexicon 条目内容（闭集词表另 Brief 审计）
  - 不合并 Omnibox 与 Side Panel 检索轨
  - 不改 LLM 主路径 prompt / 不扩 surface 冒充听懂
  - 不改用户可见 i18n

### 双线程五问
- **出口：** 仅明线（防规则层再被当听懂引擎排期）

### 验收
- `select-clue-understanding-mode` + 相关 understand 单测绿
- `doc:check` 绿
- 无 completer 时口语 clue 的 `mode` 不再报 `semantic`

### 禁止
- 灰名单内容别名
- 借机扩规则口语词典
```
