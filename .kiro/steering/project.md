---
inclusion: always
---

# Yiveno 项目规则（Kiro 入口）

用中文回复。

> **执行口径（唯一）：** 仓库 `.cursor/rules/project.mdc`  
> **产品/架构真相：** `docs/product/Yiveno-产品文档-v4.0.md`（§0 Quick Contract）  
> **工程门禁与命令：** `AGENTS.md`  
> 本文不再维护长文副本；与上列冲突时以上列为准。

## 摘要

- 不擅自 commit / push / 写总结文档或 Spec（除非用户明确要求）。
- 验证默认最小范围；禁止每次小改全仓 `typecheck:force`。
- 数据流：Chrome API → Background → IndexedDB（`indexedDBManager`）→ UI；UI 只经 `background-client`，消息带 `scope: 'background'`。
- 对外文案：筛选 / 找回；禁止 Search；交互态禁止几何变换。
- Phase A 优先：Omnibox 找回（共用 `recallService`）。
