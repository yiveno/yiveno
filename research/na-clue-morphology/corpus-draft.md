# Corpus draft · v0（公开源 + 本仓内部）

> **偏差警告：** 竞品博客例句多为**营销打磨**的理想口语，不等于真人日记。标注供形态校准；**不得**当 §5.9 / must 金标。  
> **字段：** `id` · `clue`（英文原文）· `tags`（主锚在前）· `source` · `tier`（`market` 营销 / `claim_user` 声称用户 / `yiveno_tte` 本仓 / `yiveno_doc` 产品示例）· `notes`

## A. 竞品 / 公开营销（market）

| id  | clue                                                        | tags                 | source                 | notes                    |
| --- | ----------------------------------------------------------- | -------------------- | ---------------------- | ------------------------ |
| M01 | the piece about coffee and afternoon focus                  | GIST, TYPE, FEEL     | Marqly blog            | `piece` ≈ DEM/TYPE       |
| M02 | the article comparing remote work and trust                 | TYPE, GIST           | Marqly blog            | 完整从句，偏「理想口语」 |
| M03 | that thing about sleep and cortisol                         | DEM, GIST            | Marqly FAQ             | 高 DEM                   |
| M04 | the recipe with miso and butter                             | TYPE, GIST           | Marqly FAQ             | with-槽 ≈ gist 实体      |
| M05 | the long essay about a founder who quit and moved to a farm | TYPE, FEEL, GIST     | Marqly tips            | 叙事 gist                |
| M06 | the scary article about phone addiction in kids             | FEEL, TYPE, GIST     | Marqly tips            | FEEL 前置                |
| M07 | that article about decision fatigue in product design       | DEM, TYPE, GIST      | Fabric                 |                          |
| M08 | the documentation page about API rate limiting              | TYPE, GIST           | Fabric                 | docs 类型                |
| M09 | the recipe with the tahini dressing                         | TYPE, GIST           | Fabric                 |                          |
| M10 | ideas for a trip                                            | GIST, KW             | ReCollect              | 偏开放发现，弱 DEM       |
| M11 | that workout video                                          | DEM, TYPE            | ReCollect              | 无 gist（极短）          |
| M12 | article about UX spacing                                    | TYPE, GIST           | ReCollect              | 无 DEM                   |
| M13 | Find my saved YouTube video about meal prep                 | BEH, SRC, TYPE, GIST | ReCollect popular      | 命令腔 `Find my`         |
| M14 | The tweet thread about investing basics                     | TYPE, GIST           | ReCollect popular      |                          |
| M15 | That article I saved about anxiety and sleep                | DEM, TYPE, BEH, GIST | ReCollect popular      | **经典组合**             |
| M16 | My notes on the project kickoff                             | TYPE, GIST, INTENT   | ReCollect popular      | 所有格                   |
| M17 | the pasta recipe I saved last year                          | TYPE, BEH, TIME      | Findmark README        |                          |
| M18 | that article about getting better sleep                     | DEM, TYPE, GIST      | Findmark README        |                          |
| M19 | hotel we looked at for our trip                             | GIST, INTENT, BEH    | Findmark README        | 省略 DEM                 |
| M20 | birthday gift ideas for mom                                 | GIST, INTENT         | Findmark README        | 偏任务列表               |
| M21 | that video about sourdough starters                         | DEM, TYPE, GIST      | Marqly homepage FAQ    |                          |
| M22 | that recipe with garlic and pasta                           | DEM, TYPE, GIST      | Bookmarkjar            |                          |
| M23 | Wedding guest outfits                                       | KW, GIST             | Bookmarkjar            | 无口语框                 |
| M24 | the note about the apartment                                | TYPE, GIST           | MarkIt guide           |                          |
| M25 | that piece on sourdough                                     | DEM, TYPE, GIST      | MarkIt guide           | `on` ≈ about             |
| M26 | articles about developer experience                         | TYPE, GIST           | Solem blog             | 复数 = 逛一簇意图？      |
| M27 | That article about why B2B pricing is harder than B2C       | DEM, TYPE, GIST      | Solem blog             | 完整论题                 |
| M28 | Articles about engineering team scaling challenges          | TYPE, GIST           | Solem blog             |                          |
| M29 | that article about mitochondria as the cell's power plant   | DEM, TYPE, GIST      | local Recall ext pitch | 科普比喻 gist            |
| M30 | that article about fast similarity search in Postgres       | DEM, TYPE, GIST      | personal KB blog       |                          |

## B. 声称用户模式（claim_user · 仍可能润色）

| id  | clue                                         | tags            | source                    | notes              |
| --- | -------------------------------------------- | --------------- | ------------------------- | ------------------ |
| U01 | the thing about rate limiting that guy wrote | DEM, GIST, ATTR | SaveSync「real patterns」 | 高口语；作者糊     |
| U02 | framework for figuring out pricing           | GIST, INTENT    | SaveSync                  | 弱 DEM；概念再找   |
| U03 | that diagram showing how React renders       | DEM, TYPE, GIST | SaveSync                  | 介质词 diagram     |
| U04 | explaining why useEffect is bad              | GIST, FEEL      | SaveSync                  | 动名词开头         |
| U05 | something about Apple's color philosophy     | DEM, ATTR, GIST | SaveSync                  |                    |
| U06 | improve user onboarding                      | KW, GIST        | ContextBolt               | 概念词 vs 原文轶事 |

## C. 本仓 TTE / SOP（yiveno_tte · 维护者自拟口语）

| id  | clue                                                              | tags                          | source        | notes                |
| --- | ----------------------------------------------------------------- | ----------------------------- | ------------- | -------------------- |
| T12 | that new yorker thing about remembering stuff with places         | DEM, SRC, GIST, HEDGE         | P001-T12 v2   | `thing`+`stuff` 很真 |
| T13 | something about public libraries i saved a few months back        | DEM, GIST, BEH, TIME          | P001-T13 v2   | Hard；邻域 miss      |
| T14 | something from the ft about working from home                     | DEM, SRC, GIST                | P001-T14 v2   | Easy 源+题           |
| T15 | that page where i saved a quote for a talk                        | DEM, TYPE, BEH, INTENT        | P001-T15 v2   | where-从句           |
| T16 | my notion notes with interview questions about saving across apps | TYPE, SRC, GIST               | P001-T16 v2   | 工具名作 SRC         |
| S01 | something from github docs about caching builds                   | SRC, TYPE, GIST               | SOP Easy 例   |                      |
| S02 | that page where i noted something for a workshop                  | DEM, TYPE, BEH, INTENT, HEDGE | SOP Medium 例 |                      |
| S03 | an article i didn't finish last month about work from home        | TYPE, BEH, TIME, GIST         | SOP Hard 例   |                      |

## D. 产品 / 术语表示例（yiveno_doc · 待校准）

| id  | clue                                            | tags                  | source              | notes                |
| --- | ----------------------------------------------- | --------------------- | ------------------- | -------------------- |
| D01 | the song I played on repeat yesterday           | TYPE, BEH, TIME       | 产品文档 § 真实口语 | 好                   |
| D02 | the article I didn't finish reading a while ago | TYPE, BEH, TIME       | 产品文档            | 好                   |
| D03 | the poem by Li Bai I saved yesterday            | TYPE, ATTR, BEH, TIME | 产品文档            | 好                   |
| D04 | the page where I left a note about deployment   | TYPE, BEH, GIST       | 产品文档            | 好                   |
| D05 | yesterday saved a poem about Li Bai             | TIME, BEH, TYPE, ATTR | 术语表              | **ESL 语序**；建议废 |
| D06 | the article I didn't finish reading             | TYPE, BEH             | 术语表              | 好但缺时间/gist      |
| D07 | note about the deployment page                  | TYPE, GIST            | 术语表              | 偏附注词面，非口语框 |

## E. 粗频（仅本草稿 · 不可当统计）

对 A+B+C（~44 条，去 D）主/出现计数（含辅）：

| tag                       | 约出现 | 读法                           |
| ------------------------- | ------ | ------------------------------ |
| `GIST`                    | ~38    | 几乎总有主题感觉               |
| `TYPE`                    | ~30    | 常与 DEM 同现                  |
| `DEM`                     | ~22    | 营销例句爱用；真人可能更碎     |
| `BEH`                     | ~12    | 存/看一半/附注                 |
| `SRC`                     | ~8     | FT / YouTube / Notion / github |
| `TIME`                    | ~6     | 正式口语臂应更多？待真人       |
| `INTENT`                  | ~6     | for X                          |
| `FEEL` / `ATTR` / `HEDGE` | 各 ≤5  | 样本不足                       |

## 立刻可用的「像人话」模板（给 TTE / placeholder）

```
that {TYPE|thing} about {GIST}
something from {SRC} about {GIST}
that {TYPE} I saved {TIME} about {GIST}
that {TYPE} where I {BEH} for {INTENT}
something about {GIST} I saved {TIME}
```

避免：`{SRC} + {jargon} + {note verbatim}` 三连。
