# Natural sample · P001-NS04（已确认 · `no`）

| 字段            | 填写                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| **Sample id**   | P001-NS04                                                                                                       |
| **Date**        | 2026-09-10                                                                                                      |
| **Participant** | P001                                                                                                            |
| **心里目标**    | [Using EXPLAIN · PostgreSQL](https://www.postgresql.org/docs/current/using-explain.html)                        |
| **确认**        | **`no`**（2026-09-10 · 维护者纠正）— 首屏/可见结果与目标**毫不相关**；口语↔目标配对不合格（不作正式履约 `yes`） |

## 1. 首句

```text
It seems to be a popular science article about network protocols. I don't really remember clearly, though.
```

**维度：** TYPE≈article · C≈network protocols · F=hedging  
**问题：** 口述主题（科普 / network protocols）与心里目标（Postgres **EXPLAIN 文档**）**对不上**。

## 2. clue₁ 真机（MCP UI · 原句）

| 项       | 结果                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| Framing  | Looking for **article** · Based on "**popular, science, network**"                       |
| 邻域     | 16 matches                                                                               |
| **首屏** | FT _science of remote work_ · Stripe「network timeout」· FT 摘录 — **均与 EXPLAIN 无关** |
| 展出后   | 列表深处有 EXPLAIN 摘录「Seq Scan…」— **不足以算认得出**（用户判定无关）                 |
| no_match | 否（出了错邻域）                                                                         |

## 3. 确认

- [ ] `yes` — ~~误记~~（曾因展出后有摘录记 yes；维护者否决）
- [ ] `miss` — 若认定「口语就是在找 EXPLAIN」且产品没履约，可改此档；当前维护者明示 **`no`**
- [x] `no` — 目标/口语不合格：描述的不是那篇文档该有的痕迹；首屏也认不出

**taxonomy：** `no_signal`（相对口述主题）· `rank_wrong`（science/network 字面噪声）· 口语错忆 / gist 错位

## 4. 备注

Agent 曾误把「展出后含 EXPLAIN 摘录」写成 `yes`。采样确认以**维护者主观能否认出**为准：首屏毫不相关 → **`no`**。
