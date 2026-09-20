# Natural sample · P001-NS05（已确认 · `miss`）

| 字段            | 填写                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| **Sample id**   | P001-NS05                                                                      |
| **Date**        | 2026-09-10                                                                     |
| **Participant** | P001                                                                           |
| **Gold**        | [周杰伦担任 vivo 影像大使…](https://android.tgbus.com/news/244703)（刚存书签） |
| **确认**        | **`miss`** — 库内有；邻域无；首屏 Hybrid 噪声                                  |

## 1. 首句

```text
A news story about a Chinese-language singer
```

**维度：** TYPE=news/article · **C**=Chinese-language singer（英文 gist）  
**主锚：** C

## 2. clue₁ 真机

| 项        | 结果                                               |
| --------- | -------------------------------------------------- |
| Framing   | article · Based on "**chinese, language, singer**" |
| 邻域      | 16–17 · Top1 Wired / Doc / Stripe… **无** tgbus    |
| 库内 gold | 有书签 · 标题全中文 · 无英附注                     |

## 3. 确认

- [x] `miss`
- [ ] `yes` / `no`

**taxonomy：** `weak_index`（中文标题 vs 英文 clue 无字面交集）· `hybrid_drift`（语义漂到无关英文探针条）

## 4. 根因（简述）

书签**已同步进 Memory**（不是没灌库）。失败在检索侧：clue 抽英词 `chinese/language/singer`，条目可检索痕迹几乎只有中文「周杰伦 / vivo / 影像大使…」——倒排对不上；Hybrid 在英文探针库里乱漂。属 C 维典型 miss，不是同步 bug。
