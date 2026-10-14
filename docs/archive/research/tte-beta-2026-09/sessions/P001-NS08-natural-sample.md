# Natural sample · P001-NS08（空库作废 + 有库 retry · 待确认）

| 字段                | 填写                                                          |
| ------------------- | ------------------------------------------------------------- |
| **Sample id**       | P001-NS08                                                     |
| **Date**            | 2026-10-13                                                    |
| **Participant**     | P001                                                          |
| **Extension**       | v4.0.0 · id `npaopcapgknadgooegpkondgfhphkjld`                |
| **Gold id（事后）** | `865a6777-4340-4cb2-95fc-60449c1a7995`                        |
| **Gold 粗锚**       | bookmark · 中文维基文学人物介绍 · 刚进 Engineering 后灌库导入 |

## 0. 前置（MCP 自检 · 非用户手测）

| 检查           | 结果                                                     |
| -------------- | -------------------------------------------------------- |
| 灌库开关       | 初测 `false` → Agent 经 `UPDATE_USER_SETTINGS` 置 `true` |
| Import         | 完成后 `importedCount=33` / `status=completed`           |
| Memory 含 gold | `LIST_MEMORY_ITEMS` 命中「安妮·卡森 - 维基百科…」        |

## 1. 首句（禁止翻历史后编写）

**提示语：** 「你还记得什么都行。」

```text
A wonderful literary figure introduction
```

**维度勾选（可多）：** T□ S□ G□ C☑ D□ R□ F☑（wonderful 弱辅）  
**主锚（单选一个码）：** **C**

## 2a. clue₁ · 空库轮（作废 · 不计履约分子）

| 项       | 结果                         |
| -------- | ---------------------------- |
| 邻域     | 空库文案 `Nothing saved yet` |
| 确认建议 | `no` / `not_captured`        |

## 2b. clue₁ · 有库 retry（正式候选）

```text
A wonderful literary figure introduction
```

| 项              | 结果                                                 |
| --------------- | ---------------------------------------------------- |
| TTE-V₁ (s)      | （未停表；结果为诚实 no_match）                      |
| 邻域含 gold/alt | **no**                                               |
| no_match / 空   | **yes** · 有库文案 `Nothing close enough turned up…` |
| Framing 摘录    | Heard as：「wonderful」「literary」「figure」        |
| Top1 粗记       | 无（no_match）                                       |

**MCP：** Side Panel UI `fill` + `Start recall`（库 ready 后 Idle 样句可见）。

## 3. clue₂ = 补充句（「还能想起别的吗？」）

> clue₁ 正式 **`miss`** 时本节**必填**。

```text
（待维护者补句）
```

**维度勾选（可多）：** T□ S□ G□ C□ D□ R□ F□  
**相对 clue₁ 新增码：**

| 项              | 结果 |
| --------------- | ---- |
| TTE-V₂ (s)      |      |
| 邻域含 gold/alt |      |
| no_match / 空   |      |
| Framing 摘录    |      |
| Top1 粗记       |      |

## 4. 确认

- [ ] `yes` — 目标对且认得出
- [ ] `miss` — 目标对但产品没找回（**有库 retry 倾向此项**）
- [ ] `no` — 目标/口语不合格作废

**失败归因 stage（单选）：** `candidate_miss`（倾向）· 备选 `clue_insufficient`  
**detailCodes：** `miss_neighborhood` · `weak_index`（英 clue vs 中文标题书签，类 NS05）· `no_signal`?

## 5. 备注

- 空库轮与有库 retry **分计**；独立首句仍计 1 次（与 NS05–07 不同句）。
- 与 NS05/06 同型：英文 C 维 gist ↔ 中文书签标题字面鸿沟。
