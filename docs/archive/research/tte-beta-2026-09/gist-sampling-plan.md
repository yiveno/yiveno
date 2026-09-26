# 内容大意（C / gist）· 采样与下一刀计划（2026-09-10）

> **状态：** Phase A 进行中（采样收样本；**未**开工程刀）  
> **前置：** ADR-011 时间置信度已落地；自然 clue 采样仍是**决策主线**。  
> **禁止：** 内容别名 / 开放同义表冒充通解；单次 miss（如 NS04）就改排序主路径。

## 为何盯 C

| 信号         | 说明                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 协议维度     | T 之后人最常先说的往往是「大概讲什么」（C）                          |
| NS 粗观察    | NS01/03/04 主锚偏 C；NS04 = 错忆 gist + `science`/`network` 字面抢榜 |
| 与时间刀差别 | T 有闭集 label + 硬/软分流；C 是开放语义，**必须先量失败形态再动刀** |

## Phase A · 采样收够（现在）

**退出门槛：** ≥5–8 个**有效**目标（确认 `yes` / `miss`；`no` 只进频率旁注，不当履约分子）。

| 步骤 | 做法                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------- |
| A1   | 继续 [`natural-clue-sampling.md`](./natural-clue-sampling.md) §1；偏采「只记得大意」的真实条目 |
| A2   | 首句原样 MCP UI；记 Framing `Based on …` 抽词、首屏 Top1–5、展全后是否含 gold                  |
| A3   | 维护者确认 `yes` / `miss` / `no`；落盘 `sessions/P001-NSxx-*.md`                               |
| A4   | 失败勾 taxonomy（见下）— **必填一项主因**                                                      |

**C 相关 taxonomy（可多选，圈一个主因）：**

| 码                   | 含义                                               | NS 例                            |
| -------------------- | -------------------------------------------------- | -------------------------------- |
| `gist_mismatch`      | 人记的主题 ≠ 条目真实主题                          | NS04（协议科普 vs EXPLAIN 文档） |
| `literal_hijack`     | 通用词（science / network / article…）字面抢走邻域 | NS04 首屏 FT / Stripe            |
| `weak_index`         | 库内标题/摘录/附注几乎无对应锚                     | 无附注、摘录离题                 |
| `rank_ok_below_fold` | gold 仅在 Show more 外，首屏认不出                 | （若再出现单独记）               |
| `hybrid_drift`       | 几乎纯语义相关、主题不对                           | NS01/03 噪声邻域                 |

**本阶段不做：** 改 Filter/Hybrid 权重、扩 must、写内容词典。

## Phase B · 小批汇总（有 5–8 有效条后）

半日工作量：

1. 表：各码首现 / 主锚频率；C 作主锚时 Neigh₁ / Empty 率
2. Empty·错邻域 Top taxonomy（上表）
3. **书面三选一**（可组合，须写进本页「决定」节）：

| 选项            | 触发                         | 产出                                                                    |
| --------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **B-lit**       | `literal_hijack` 反复        | 评估「弱内容词降权 / 停用不当作主锚」——机制须对全用户同一规则，非灰名单 |
| **B-src**       | S 高频且加来源后明显升 Neigh | 来源软加权计划（另开页）                                                |
| **B-cap**       | `weak_index` 多              | Capture/附注可观测与引导（不装懂 gist）                                 |
| **B-must-only** | 失败可复现但刀刃不清         | 仅匿名 must + 暂不改行为                                                |

## Phase C · 工程刀（门过了才开）

对齐时间刀模板：本页标「实施中」→ 产品 Normative（若行为变）→ ADR（若不可逆）→ 代码 → must → MCP。

硬约束与 ADR-005 一致：**禁止** `SHORT_LATIN_WORD_ALIASES` 类内容别名通解。

## 与采样 / 时间的关系

```
自然采样（主线）──量 C/S/G 频率与失败形态
    │
    ├─ T：ADR-011 已落地（并行观测即可）
    │
    └─ C：本页 Phase A→B→（可选）C
         未过 B 门禁前禁止 Phase C
```

## 当前 NS 记账（滚动）

| id   | 主锚  | 确认                              | C taxonomy（若有）                                                           |
| ---- | ----- | --------------------------------- | ---------------------------------------------------------------------------- |
| NS01 | C     | 探索 / 无 gold                    | `hybrid_drift` / 库无                                                        |
| NS02 | S+G+T | `yes`                             | —                                                                            |
| NS03 | C     | `no`（探针脏 URL / 未真 Capture） | 不作履约分子                                                                 |
| NS04 | C     | `no`                              | `gist_mismatch` + `literal_hijack`                                           |
| NS05 | C     | `miss`                            | `weak_index`（中文标题 vs 英文 clue）+ `hybrid_drift`                        |
| NS06 | C     | `miss`                            | 英文 Kyodo：字面 gist 鸿沟 + **缺 embedding** → `hybrid_drift`（非语言边界） |
| NS07 | 无    | `no`（无主题 · H-topic 忽略）     | `missing_topic`（首句+追问均无主题；未检索、不幻觉、只问一问）               |

**有效履约分子（截至写本页）：** NS02 `yes` ×1 · NS05/NS06 `miss` ×2 — **未达 Phase B 门槛。**

## 假设 H-topic（2026-09-27 · P001 真人输入）

> 自然召回必由主题驱动：首句必含主题锚（C 或 G）。
> 无主题的查询不计入需求（用户自己也不知道要找什么）。
> miss 的主因不是用户没给主题，而是系统的 gist/主题表示与用户主题表述对不上。

- NS07 起新增必记字段：首句主题短语原样、触发场景（当前在看/在聊什么）。
- Phase B 时统计主题表述 vs gold 标题/摘录的文本距离，判 B-src / B-cap。
- 进 must 的口语用例硬性要求带真实主题短语；无主题合成 clue 不写。
- 边界：触发场景省略主题时（"刚才看到的那个"），隐式主题锚 = 当前 Tab/对话主题；
- 现状：NS01–NS06 主锚 C×5、S+G+T×1，与假设一致。
- NS07（真机）：首句 "A word that was learned before" + 追问后仍无主题 → 正确判 `missing_topic`（未检索）。H-topic 首条真人证据。

## 决定（Phase B 后填写）

- （空）

## 参考

- [`natural-clue-sampling.md`](./natural-clue-sampling.md)
- [`time-confidence-plan.md`](./time-confidence-plan.md)（已落地对照）
- [`ADR-011-recall-time-confidence.md`](../../docs/architecture/decisions/ADR-011-recall-time-confidence.md)
