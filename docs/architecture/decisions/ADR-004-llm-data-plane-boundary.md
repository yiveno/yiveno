# ADR-004: LLM 不直接执行数据平面读写

- **状态：** 已接受
- **日期：** 2026-08（产品文档 §0.1.1 / §0.3）
- **决策者：** 产品 Normative

## 背景

概率生成不保证真实性。若 LLM 直接查/插/改/删 IndexedDB 或云端 Memory，幻觉会变成数据事实，不可测试、难回滚。

## 决定

1. LLM **只做** NLU / 意图 / NLG（及候选上重排解释）。
2. 数据平面唯一允许形态：**结构化提议 → Zod / 业务门禁 → 确定性代码执行**。
3. 事实源 = IndexedDB `MemoryItem`（及未来经门禁的同步投影）。
4. 有托管 completer 时理解层**默认走 LLM**；规则 `parseRecallClue` 仅无 completer / LLM 失败时降级。

## 后果

**必须：**

- 新「AI 能力」先问：是否仍走提议→校验→执行？
- Filter / Hybrid / 索引 / sync 由确定性代码执行。

**禁止：**

- 模型输出未校验的 id 列表直接当召回结果写库。
- 用规则词典无限扩 surface 冒充「懂用户」（见 ADR-005）。

## 相关

- 产品文档 §0.1.0、§0.1.1、§0.3、§2
- `extension/src/core/recall/understand/`、`application/recall/`
