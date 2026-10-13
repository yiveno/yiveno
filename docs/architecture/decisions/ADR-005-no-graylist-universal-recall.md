# ADR-005: 禁止内容别名灰名单冒充全用户通解

- **状态：** 已接受
- **日期：** 2026-08
- **决策者：** 产品 Normative + `.cursor/rules/project.mdc`

## 背景

为过 demo / eval / 个人库，在 runtime 堆 `js→javascript`、专名 seed、诗人/框架 allowlist 等，对外或对内装作通用召回能力，属于**欺骗**，且多会话 AI 易反复引入此类「捷径」。

## 决定

1. **通解** = 可复用机制（形态、分词、索引契约、产品文档**已明示**的闭合槽位词表）。
2. **禁止**开放内容/实体别名表作主路径召回增强。
3. **允许**闭合产品槽位（`objectType` / behavior / time）、settings 迁移 id、i18n key、高频 host 启发式（若 Normative 已写）。
4. **仅测试/eval 夹具**可出现专名种子；**不得**复制进生产召回主路径。

## 后果

**必须：**

- 新扩词/别名先问：产品文档是否 Normative 明示？是否对全库全用户成立？
- 覆盖不了的残差留给字面 / Hybrid，诚实 `no_match`。

**禁止：**

- 「P0 先写几条以后再扩」式灰名单。
- 未文档化的闭集词表写进召回主路径。

## 相关

- `.cursor/rules/project.mdc`「全量用户能力」
- `RECALL_OBJECT_TYPE_LEXICON` 等产品闭集枚举
- `extension/src/core/recall/eval/`（夹具与 must 分离）
