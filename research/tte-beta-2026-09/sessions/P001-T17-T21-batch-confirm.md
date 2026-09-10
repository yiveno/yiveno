# Batch confirm · P001-T17–T21 **AI 口语 clue**（2026-09-08）

> **标准：** `solo-researcher-sop.md` §2.1 + **§2.2**（AI 生成口语 · 维护者只裁决）  
> **形态：** `research/na-clue-morphology/`  
> **MCP：** Side Panel UI（`fill` / `click`）· 扩展 v4.0.0 · 已含 `few_months_ago` P0  
> **未**整库替换种库

## AI 生成 clue（§2.1 · 先锁 gold 再写）

| Task    | 档     | Fuzzy clue（AI）                                                    | Gold（短 id / 粗锚）                                                               | MCP | 邻域 | Top1≈gold                                     | 你的确认                  |
| ------- | ------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --- | ---: | --------------------------------------------- | ------------------------- |
| **T17** | Easy   | `something from github docs about caching builds`                   | `3fa7dfcf…` / docs.github · Caches scoped per branch（原卡 `03367e5c` 内容同主题） | ✅  |   18 | ✅ Top1=摘录                                  | **yes**                   |
| **T18** | Easy   | `something from the ft about working from home`                     | `81894347…` Weak-tie / FT remote（书签 alt 同页）                                  | ✅  |   21 | ❌ Top1=example.org；#2=FT 书签；#4=gold 摘录 | **no**（作废 · 不计正式） |
| **T19** | Medium | `my notion notes with interview questions about saving across apps` | Notion · interview / cross-source friction                                         | ✅  |   21 | ✅ Top1=Notion+note                           | **yes**                   |
| **T20** | Medium | `that mdn page about promises i looked at`                          | `72011790…` Promise.all 摘录（书签 alt 同 URL）                                    | ✅  |    8 | 邻域✅ · Top1=书签 alt（#2=摘录）             | **yes**                   |
| **T21** | Hard   | `something about public libraries i saved a few months back`        | `7f6b2eb6…` JSTOR library desk（书签同页）                                         | ✅  |    6 | 邻域✅ · Top1=JSTOR 书签；#2=摘录             | **yes**                   |

## 人确认后汇总

| 指标                      |                                                                    结果 |
| ------------------------- | ----------------------------------------------------------------------: |
| 有效任务（非 `no`）       |                                              **4/5**（T17/T19/T20/T21） |
| 有效任务中邻域含 gold/alt |                                                                 **4/4** |
| 有效任务中 `yes`          |                                                                 **4/4** |
| 作废                      | **T18**（`no`：clue/gold 配对或口语不合格 → **禁止**用本条抬/压产品分） |

维护者裁决（2026-09-08）：`T17 yes; T18 no; T19 yes; T20 yes; T21 yes`

## T18 后续（§2.2）

- **不计** `rank_wrong` 进正式试跑 taxonomy（任务已作废）。
- 下一步：换 gold 或重抽口语 clue 后单开 T22 重跑；**不得**把原 clue 改成检索式凑命中。

## 失败 taxonomy（仅有效任务旁注）

1. **旁注 · 非作废：** T20/T21 同页书签抢 Top1（维护者仍 `yes` → 邻域履约成立；钉死摘录时另记 delight 缺口）
2. ~~T18 rank_wrong~~ — **作废，不入库**
3. ~~旧 T13 miss~~ — T21 已解（时间窗 + jstor 进邻域）

## 线索作者声明

本批 clue **全部由 Agent 按 §2.1/形态表生成**；确认列仅维护者填写。
