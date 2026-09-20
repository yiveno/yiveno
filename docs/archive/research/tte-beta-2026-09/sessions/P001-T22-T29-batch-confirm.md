# Batch confirm · P001-T22–T29 **AI 口语 clue**（2026-09-08 / 续 2026-09-10）

> **标准：** `solo-researcher-sop.md` §2.1 + **§2.2**（AI 生成口语 · 维护者只裁决）  
> **形态：** `research/na-clue-morphology/`  
> **MCP：** Side Panel UI（`fill` / `click`）· 扩展 `npaopcapgknadgooegpkondgfhphkjld` · **未**整库替换种库  
> **本批意图：** T18（FT）作废后重抽 + 大批量 Easy×3 / Medium×3 / Hard×2

## AI 生成 clue（§2.1 · 先锁 gold 再写）

| Task    | 档     | Fuzzy clue（AI）                                              | Gold（短 id / 粗锚）                                         | MCP |  邻域 | Top1≈gold                                      | 你的确认 |
| ------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------ | --- | ----: | ---------------------------------------------- | -------- |
| **T22** | Easy   | `that financial times piece about remote work`                | `81894347…` Weak-tie / FT remote 摘录（T18 重抽）            | ✅  |    21 | ✅ Top1=gold 摘录                              | **yes**  |
| **T23** | Easy   | `that new yorker thing about remembering stuff with places`   | `91972c9f…` How Memory Works 摘录                            | ✅  |    16 | ✅ Top1=gold                                   | **yes**  |
| **T24** | Easy   | `something from the rfc editor about http`                    | `97cc7ad6…` RFC 9110 · rfc-editor                            | ✅  |    48 | ✅ Top1=RFC 9110                               | **yes**  |
| **T25** | Medium | `that guardian article about misinformation i never finished` | Guardian misinfo（书签/同页摘录 alt）                        | ✅  |    17 | ✅ Top1=How misinformation spreads online      | **yes**  |
| **T26** | Medium | `that page where i saved a quote for a talk`                  | `238ebb6c…` Atlantic attention · note「pull quote for talk」 | ✅  |    18 | ✅ Top1=gold 摘录                              | **yes**  |
| **T27** | Medium | `that untitled google doc where i left myself a note`         | Untitled Google Doc（附注勿作 clue 锚）                      | ✅  |    20 | ✅ Top1=Untitled document                      | **yes**  |
| **T28** | Hard   | `something about postgres explain from a while back`          | `78cc2ddd…` / Postgres EXPLAIN 系                            | ✅  | **5** | ❌ Top1=New Yorker memory；**邻域无 postgres** | **miss** |
| **T29** | Hard   | `that stripe docs page about retrying failed requests`        | `a8f56019…` Idempotent requests 摘录                         | ✅  |    19 | ✅ Top1=gold 摘录（#2=同页书签）               | **yes**  |

## 人确认后汇总

| 指标                      |                                         结果 |
| ------------------------- | -------------------------------------------: |
| 有效任务（非 `no`）       |                            **8/8**（无作废） |
| 有效任务中邻域含 gold/alt |                                      **7/8** |
| 有效任务中 `yes`          |                                      **7/8** |
| `miss`                    |               **T28**（`miss_neighborhood`） |
| T18 重抽                  | **T22 yes**（Top1=FT 摘录；作废 T18 已闭环） |

维护者裁决（2026-09-10）：`T22 yes; T23 yes; T24 yes; T25 yes; T26 yes; T27 yes; T28 miss; T29 yes`

## 失败 taxonomy（仅有效任务）

1. **`miss_neighborhood`** — T28：`postgres` + `explain` + `from a while back` → Framing「Within a few months ago」；5 条全是 Hybrid 偏邻域（New Yorker / Smashing / Stripe / FT / JSTOR），**无** PostgreSQL EXPLAIN。疑似时间硬窗挤出「Saved ~4 weeks ago」类条目，和/或词面未进 Filter。
2. **旁注 · 非 miss：** T29 同页书签 #2（邻域履约仍 `yes`；钉死摘录时记 delight 缺口）

## 线索作者声明

本批 clue **全部由 Agent 按 §2.1/形态表生成**；确认列仅维护者填写。
