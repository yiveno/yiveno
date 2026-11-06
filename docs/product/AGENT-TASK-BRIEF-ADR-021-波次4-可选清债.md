# Task Brief · ADR-021 波次 4 · 可选清债（原清单 B）

> **状态：** 已完成（2026-11-06）  
> **前置：** 波次 1–3 已完成

---

```text
## Task Brief

### Scope
- **In：**
  1. lexicon 审计：删除越界 surface（错槽 / 内容体裁冒充类型）；保留闭集口语 + 旁注审计结论；**不扩面**
  2. Side Panel 离线壳：注释/CSS 注释对齐「断网薄适配」；确认无加深产品（不改 i18n key / 不改可见文案）
  3. `shouldOmitClueLlmCompleterWhenOffline` → `shouldOmitClueLlmCompleterWhenBrowserOffline`（及调用处局部变量）
- **Out：**
  - 不改 diagram id / ADR-007 文件名
  - 不合并 Omnibox↔Hybrid
  - 不改用户可见 `_locales` 文案与 message key
  - 不扩 lexicon

### 双线程五问
- **出口：** 仅明线

### 验收
- `parse-recall-clue` / `browser-online` / `omnibox-recall-entry` / `select-clue-understanding-mode` 单测绿
- `doc:check` 绿
- changelog 一行

### 禁止
- 灰名单内容别名冒充通解
- 借机大重构 UI
```
