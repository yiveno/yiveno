# Natural sample card · \_TEMPLATE

> 复制为 `P00x-natural-S0N.md`。含真实 id / 原文的成品 **勿 commit**。

| 字段                | 填写                                      |
| ------------------- | ----------------------------------------- |
| **Sample id**       | P001-NS01                                 |
| **Date**            | YYYY-MM-DD                                |
| **Participant**     | P001                                      |
| **Extension**       | v                                         |
| **Gold id（事后）** |                                           |
| **Gold 粗锚**       | 类型 / 域 / 冷却天（勿写附注原词进 clue） |

## 1. 首句（禁止翻历史后编写）

**提示语：** 「你还记得什么都行。」

```text
（原文粘贴）
```

**维度勾选（可多）：** T□ S□ G□ C□ D□ R□ F□  
**主锚（单选一个码）：**

## 2. clue₁ = 首句（最小清洗后）

```text

```

| 项              | 结果     |
| --------------- | -------- |
| TTE-V₁ (s)      |          |
| 邻域含 gold/alt | yes / no |
| no_match / 空   | yes / no |
| Framing 摘录    |          |
| Top1 粗记       |          |

## 3. clue₂ = 补充句（「还能想起别的吗？」）

> **硬规则（暗线 H2 / 2026-10）：** clue₁ 为正式 **`miss`** 时本节**必填**；勾选相对 clue₁ 的**新增**维度。yes / no 可省略 clue₂。

```text

```

**维度勾选（可多）：** T□ S□ G□ C□ D□ R□ F□  
**相对 clue₁ 新增码：** （无新增则写「无」）

| 项              | 结果     |
| --------------- | -------- |
| TTE-V₂ (s)      |          |
| 邻域含 gold/alt | yes / no |
| no_match / 空   | yes / no |
| Framing 摘录    |          |
| Top1 粗记       |          |

## 4. 确认

- [ ] `yes` — 目标对且认得出
- [ ] `miss` — 目标对但产品没找回
- [ ] `no` — 目标/口语不合格作废

**失败归因 stage（单选 · 暗线基建）：** `not_captured` · `index_gap` · `candidate_miss` · `understand_skew` · `rank_wrong` · `clue_insufficient` · `absent_honest` · `ux_friction` · `unknown`  
**detailCodes（可多）：** `parse_fail` · `rank_wrong` · `type_hard_empty` · `time_soft_ok` · `no_signal` · `miss_neighborhood` · `weak_index` · `gist_mismatch` · `missing_topic` · `hybrid_drift` · `ux_friction` · `other:`  
（映射见 `extension/src/core/recall/dual-thread/recall-failure-attribution.ts`）

## 5. 备注

（可选）
