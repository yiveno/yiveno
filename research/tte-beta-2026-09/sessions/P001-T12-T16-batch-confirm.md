# Batch confirm · P001-T12–T16 **v2 口语 clue**（2026-09-08）

> **标准：** `solo-researcher-sop.md` §2.1（短+碎+最多两锚 · Easy/Medium/Hard = 2/2/1）  
> **旧版专业 clue 批作废**，不计正式试跑。  
> 库：68 Memory · Side Panel UI · **未**整库替换种库

## v2 Clue（已按标准重写）

| Task    | 档     | Fuzzy clue（v2）                                                    | Gold        | MCP                         | 邻域 | Top1=gold                                            |       TTE-V | 你的确认 |
| ------- | ------ | ------------------------------------------------------------------- | ----------- | --------------------------- | ---: | ---------------------------------------------------- | ----------: | -------- |
| **T12** | Easy   | `that new yorker thing about remembering stuff with places`         | `91972c9f…` | ✅                          |   16 | ✅                                                   |       20.7s |          |
| **T13** | Hard   | `something about public libraries i saved a few months back`        | `7f6b2eb6…` | ❌ 错邻域（8 条无一 JSTOR） |    8 | ❌                                                   | —（空成功） |          |
| **T14** | Easy   | `something from the ft about working from home`                     | `81894347…` | 邻域✅ · Top1❌             |   21 | ❌（Top1=example.org；#2=FT 书签 alt；#4=gold 摘录） |       15.9s |          |
| **T15** | Medium | `that page where i saved a quote for a talk`                        | `238ebb6c…` | ✅                          |   18 | ✅                                                   |       21.4s |          |
| **T16** | Medium | `my notion notes with interview questions about saving across apps` | `6df0afad…` | ✅                          |   21 | ✅                                                   |       17.6s |          |

## 客观汇总（人确认前 · v2）

| 指标                  |      v2 | 对比旧专业 clue 批               |
| --------------------- | ------: | -------------------------------- |
| 邻域含 gold（或 alt） | **4/5** | 旧 4/5（T13 仍 miss）            |
| Top1 = gold           | **3/5** | 旧 4/5（口语化后 T14 Top1 掉了） |
| 明显更难 / 更真       | T13/T14 | 旧批 clue 信息过密，抬高命中     |

## 请你确认

回复示例：`T12 yes; T13 miss; T14 yes; T15 yes; T16 yes`  
（`yes` = 这条口语 clue 的目标就是 gold，且结果里认得出；`miss` = gold 对但产品没找回；`no` = gold/clue 配对不对）

## 失败 taxonomy（v2）

1. **`miss_neighborhood`** — T13：`public libraries` + 时间 → Hybrid 邻域全偏（Figma/MDN/Aeon…），JSTOR gold 未进 8
2. **`rank_wrong`** — T14：FT 在邻域但 Top1 被 example.org 弱标题+note 噪声抢走
