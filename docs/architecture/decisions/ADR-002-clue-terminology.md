# ADR-002: 用户 Recall 输入称 clue（线索）

- **状态：** 已接受
- **日期：** 2026-08（术语表制度化）
- **决策者：** 产品 Normative + 维护者

## 背景

「query / search / prompt / question」易与搜索引擎、聊天机器人、LLM 工程术语混淆；`MemoryItem.clues` 字段又与用户输入同名异义，跨会话沟通成本高。

## 决定

1. **用户向 Recall composer 输入**的产品名词 = **clue**（开发者讨论：**线索**）。
2. **MemoryItem 字段** `clues` 为条目元数据；其中 `clues.note` = **附注**（非「笔记」类型）。
3. 对外 UI / i18n **禁止 Search**；对内实现名 `filterClue` 等不得当产品名词。
4. **唯一术语权威：** `docs/product/Yiveno-术语表.md`。

## 后果

**必须：**

- 新文案、文档、遥测说明、PR 描述使用 clue / Recall / 邻域 / 附注。
- 改叫法先改术语表，再同步产品文档、rules、代码、i18n。

**禁止：**

- 产品面向用户文案使用 query/search 作主术语。
- 新增 `zh_CN` 或其它非 en 产品 locale。

## 相关

- `docs/product/Yiveno-术语表.md`、`.cursor/rules/terminology.mdc`
- 消息：`RECALL_WITH_CLUE`；`extension/src/core/messaging/`
