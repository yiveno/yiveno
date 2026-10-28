# Natural sample · P001-NS07（空卡 · H-topic 字段版）

> 含真实 id / 原文的成品 **勿 commit**。先在心里锁定一条真实 Memory，禁止翻历史/Library 后再编。

| 字段                | 填写                                      |
| ------------------- | ----------------------------------------- |
| **Sample id**       | P001-NS07                                 |
| **Date**            | 2026-09-27                                |
| **Participant**     | P001                                      |
| **Gold id（事后）** |                                           |
| **Gold 粗锚**       | 类型 / 域 / 冷却天（勿写附注原词进 clue） |

## 0. 触发场景（H-topic 新增 · 必记）

- 当前在看/在聊什么：在学英语
- 省略主题与否（首句是否说出主题）：是——首句未说出任何主题/单词本身

## 1. 首句（禁止翻历史后编写）

**提示语：** 「你还记得什么都行。」

```text
A word that was learned before
```

**维度勾选（可多）：** T□ S□ G☑（为学英语而学） C□ D□ R□ F□
**主锚（单选一个码）：** G（弱）——无 C 主题锚
**主题短语原样（H-topic 新增 · 必记）：**（无）首句未包含任何可检索主题

## 2. clue₁ = 首句（最小清洗后）

```text
A word that was learned before
```

| 项              | 结果                                                         |
| --------------- | ------------------------------------------------------------ |
| TTE-V₁ (s)      | —（未检索）                                                  |
| 邻域含 gold/alt | —（无检索，无邻域）                                          |
| no_match / 空   | **yes**（`emptyKind=missing_topic`，未进检索）               |
| Framing 摘录    | Tell me what topic it is about, and I will look.（只问一问） |
| Top1 粗记       | 无（不挂猜测）                                               |

> 规则解析：contentTerms = `word/was/learned/before`（全泛词）→ 无主题锚 → `missing_topic`。

## 3. clue₂ = 补充句（「还能想起别的吗？」）

```text
A word that was learned before
```

| 项              | 结果                        |
| --------------- | --------------------------- |
| TTE-V₂ (s)      | —                           |
| 邻域含 gold/alt | —                           |
| no_match / 空   | **yes**（同首轮，仍无主题） |
| Framing 摘录    | 同 clue₁                    |
| Top1 粗记       | 无                          |

> 维护者补充提示后仍未能给出任何主题（单词含义 / 来源 / 场景均无）→ 确认无主题锚。

## 4. 确认

- [ ] `yes` — 目标对且认得出
- [ ] `miss` — 目标对但产品没找
- [x] `no` — 目标/口语不合格作废（无主题 · H-topic 判"无意义请求"忽略）

**taxonomy（可多）：** `missing_topic`（H-topic 新增码）；旧码不适用

**结论（H-topic 首条真人证据）：** 真实人类首句 + 追问后仍无主题 → Yiveno 正确判 `missing_topic`（未检索、不幻觉、只问一问）。符合"无主题即无意义请求、可忽略"的判定；本条不计入 Phase B 履约分子。

## 5. Outcome 配对（§7.2 P2 · 每条自动攒一个）

- 出口：Found / dismiss / absent
- gold targetId（含替代集）：
- 隐式推断：C1 / C2（id 来源：日志 / 本机 Outcome 事件）：
- 与出口一致性：
