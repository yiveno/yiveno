# NA Clue Morphology（北美口语线索形态调研）

> **性质：** Non-normative 研究草稿 · **不是**产品文档 / 术语表权威。  
> **目的：** 弄清美式英语用户在「找自己存过的东西」时，**怎么开口**——服务 Recall 理解层、TTE fuzzy clue、placeholder 举例、must eval 口径。  
> **启动：** 2026-09-08 · 与 TTE P001「专业 clue → 口语 v2」发现对齐。

## 状态

| 项                  | 状态                                                 |
| ------------------- | ---------------------------------------------------- |
| 形态分类表          | ✅ `morphology.md` v0                                |
| 公开源草稿语料      | ✅ `corpus-draft.md`（~50 条 · 偏营销/竞品，见偏差） |
| 理解流水线 ADR（B） | ✅ ADR-010 **已接受**                                |
| Schema 缺口（A）    | ✅ `schema-gap-analysis.md`（P0 时间闭集已落地）     |
| 真人日记 / 访谈     | ❌ 未做                                              |
| 本机遥测标注        | ❌ 未做                                              |
| 回写产品文档示例    | ❌ 禁止，等样本够 + 人工审                           |

## 读什么

| 文件                                                 | 说明                                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`morphology.md`](./morphology.md)                   | **形态 ID 表**（主锚 / 辅锚 / 理解层应对）                                                                       |
| [`corpus-draft.md`](./corpus-draft.md)               | 标注例句 + 来源标签                                                                                              |
| [`sources.md`](./sources.md)                         | 出处、偏差、下一步采法                                                                                           |
| [`schema-gap-analysis.md`](./schema-gap-analysis.md) | **A：** 形态 × `ParsedRecallClue` / LLM schema 缺口                                                              |
| 架构讨论                                             | [`ADR-010`](../../docs/architecture/decisions/ADR-010-clue-understanding-pipeline.md)（**讨论中** · 理解流水线） |

## 与 TTE / Normative 的关系

- TTE fuzzy clue 口语标准：`research/tte-beta-2026-09/solo-researcher-sop.md` §2.1（可继续用；本包提供**形态依据**）。
- 产品「真实口语需求」：`docs/product/Yiveno-产品文档-v4.0.md`（记忆点维度仍有效；**句式示例待本包成熟后再改**）。
- **禁止：** 把本包例句直接塞进 must eval / i18n / 灰名单同义表；禁止用营销例句冒充 §5.9 用户话。

一句话结论（v0）

北美再找口语 ≈ **指示代词糊名词 + about gist**，常夹 **来源感觉 / 存取行为 / 糊时间 / hedge**；少见完整标题与检索式堆叠。

## 真机 / TTE 用法

- **口语 clue 由 AI 按本包形态生成**；维护者只做 `yes`/`miss`/`no` 裁决（见 `research/tte-beta-2026-09/solo-researcher-sop.md` §2.2）。
- **禁止**维护者个体枚举「用户可能会说什么」当正式试跑主源。
