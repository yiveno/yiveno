# Batch confirm · P001-T30–T37 **TIME 主题口语**（2026-09-10）

> **焦点：** 日常联想记忆 — `TIME` + `TYPE`/`DEM`/`BEH`，**弱/无 GIST**（对照：bookmarks last week / excerpts some time ago / bookmark long time ago）  
> **标准：** `solo-researcher-sop.md` §2.1 + §2.2 · `na-clue-morphology`  
> **MCP：** Side Panel UI（`fill`/`click`）· **未**整库替换种库  
> **注：** `some time ago` / `a long time ago` **不在**规则词典（仅 `a while ago` / `long ago`）— 本批压 LLM 映射

## AI 生成 clue（先锁 gold 再写）

| Task    | 档     | Fuzzy clue（AI）                           | Gold（短 id / 窗）                          | MCP |  邻域 | Top1≈gold                                                                 | 你的确认 |
| ------- | ------ | ------------------------------------------ | ------------------------------------------- | --- | ----: | ------------------------------------------------------------------------- | -------- |
| **T30** | Easy   | `the bookmarks i saved last week`          | `8668f8e3…` github caching 书签 · last_week | ✅  |    30 | 邻域✅（Caching 在列表；Top1=Ask HN 同步批）· Framing「Within last week」 |          |
| **T31** | Easy   | `bookmarks from a few days ago`            | `227ac1ac…` substack note-taking · recent   | ✅  |    30 | ❌ 可见 1–20 **无** gold；Framing「Within recently」                      |          |
| **T32** | Medium | `the excerpts i saved some time ago`       | `6a17348c…` aeon bored 摘录                 | ✅  |     9 | 邻域✅ #4=gold · LLM→`a_while_ago`（「Within a while ago」）              |          |
| **T33** | Medium | `an excerpt from a while ago`              | `8c683815…` guardian misinfo 摘录           | ✅  | **0** | ❌ Framing「quote + a while ago」→ **Nothing matched** · 仅 Guess=arxiv   |          |
| **T34** | Medium | `a bookmark from last month`               | `56527184…` nature tipping 书签             | ✅  |     8 | 邻域✅ #2=gold · 「Within last month」                                    |          |
| **T35** | Hard   | `a bookmark from a long time ago`          | `60b10fd1…` New Yorker memory 书签          | ✅  |     6 | 邻域✅ #6=gold · LLM→`long_ago`（「Within a long time ago」）             |          |
| **T36** | Hard   | `something i bookmarked a few months back` | `882b688d…` JSTOR libraries 书签            | ✅  |     5 | 邻域✅ #4=gold · 「Within a few months ago」                              |          |
| **T37** | Hard   | `excerpts from a few months ago`           | `7f6b2eb6…` JSTOR libraries 摘录            | ✅  |     5 | 邻域✅ #3=gold · 「Within a few months ago」                              |          |

## 客观汇总（人确认前）

| 指标                      |                                                              结果 |
| ------------------------- | ----------------------------------------------------------------: |
| 时间 Framing 对上口语窗   |                                 **7/8**（T33 窗对但类型硬过滤空） |
| 邻域含 gold（或同题 alt） |                                              **6/8**（T31 / T33） |
| 词典外短语 LLM 映射       | `some time ago`→`a_while_ago` ✅；`a long time ago`→`long_ago` ✅ |

## 请你确认

回复示例：`T30 yes; T31 miss; T32 yes; T33 miss; T34 yes; T35 yes; T36 yes; T37 yes`  
（`yes` = 口语目标就是该 gold 且结果认得出；`miss` = 配对对但没找；`no` = 配对/口语不合格作废）

## 失败 taxonomy（确认前草稿）

1. **`type_hard_empty`** — T33：`excerpt`→`quote` + 时间硬约束 → 「Nothing matched」；同批 T32/T37 用复数 `excerpts` 走软邻域却能出摘录。疑似 **quote 槽未对齐 `text_excerpt`**。
2. **`rank_flood` / 邻域挤出** — T31：`recent`+`bookmark` 约 30 条，首屏被「Saved yesterday」同步批占满，锁的 gold（~6d）未进可见 1–20。
3. **旁注：** 纯 TIME+TYPE 时 Top1 常非特定 gold（delight 弱）；履约主尺仍是邻域切片可认。

## 线索作者声明

本批 clue **全部由 Agent 按 §2.1/形态表生成**；确认列仅维护者填写。
