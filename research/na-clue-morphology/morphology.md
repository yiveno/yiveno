# Clue Morphology · v0（2026-09-08）

> 用户在 Recall composer 里打的是 **clue**（术语表）。本表描述**北美口语形态**，不是检索 API。  
> 一条 clue 通常 **1 个主锚 + ≤2 个辅锚**（与 TTE SOP §2.1 一致）。

## 形态 ID

| ID       | 名称              | 典型词面                                                                          | 主/辅          | 理解层应对（产品已有或应有） | 备注                            |
| -------- | ----------------- | --------------------------------------------------------------------------------- | -------------- | ---------------------------- | ------------------------------- |
| `DEM`    | 指示 + 糊名词     | `that article` / `that thing` / `the one` / `something` / `the piece`             | 常主框         | 对象存在性；弱类型启发       | 已知项再找信号；勿当停用词丢掉  |
| `TYPE`   | 对象类型词        | `article` / `video` / `recipe` / `notes` / `tweet thread` / `page` / `docs`       | 主或辅         | `objectType` 槽（闭集词表）  | 闭集 OK；禁止扩成开放同义灰名单 |
| `GIST`   | about + 主题 gist | `about working from home` / `about UX spacing`                                    | **最常见主锚** | `contentTerms` + Hybrid      | 常为半截话题，非整句摘要        |
| `SRC`    | 来源 / 渠道感觉   | `from the FT` / `a New Yorker thing` / `YouTube` / `github docs`                  | 辅（易升主）   | host / 品牌 token            | 常简称、不全名                  |
| `BEH`    | 存取行为          | `I saved` / `didn't finish` / `left a note` / `on repeat`                         | 辅             | behavior / 附注指向          | 与 Capture 行为字段对齐         |
| `INTENT` | 用途意图          | `for a talk` / `for a workshop` / `to send to the team`                           | 辅             | 常落 `clues.note`            | 标题里往往没有                  |
| `TIME`   | 糊时间            | `a while back` / `last month` / `yesterday` / `the other day` / `few months back` | 辅             | time 槽                      | 少精确日期                      |
| `HEDGE`  | 含糊 / 不确定     | `I think` / `maybe` / `something like` / `stuff`                                  | 修饰           | **不得当噪声剥光**           | TOT 文献高频                    |
| `ATTR`   | 归属 / 作者感     | `that guy wrote` / `by Li Bai` / `Apple's`                                        | 辅             | entity / contentTerms        | 人名常糊                        |
| `FEEL`   | 主观感受 / 语气   | `scary` / `long essay` / `really useful`                                          | 辅             | 弱信号；勿当硬过滤           | 产品文档已列「很嗨/很绝」类     |
| `NEG`    | 反例 / 不要什么   | `not the pricing one`                                                             | 辅（少）       | 追问/否定路径                | 对搜索引擎差、对「人」常见      |
| `KW`     | 关键词检索式      | `react hooks caching`（无口语框）                                                 | —              | 可检，但**不作口语金标**     | Google 心智；TTE 正式臂禁用     |

## 高频组合（观察 · v0）

按公开营销例句 + 本仓 TTE v2 粗频：

1. **`DEM` + `TYPE` + `GIST`** — `that article about anxiety and sleep`
2. **`DEM` + `GIST`**（TYPE 省略）— `that thing about sleep and cortisol`
3. **`TYPE`/`DEM` + `SRC` + `GIST`** — `something from the ft about working from home`
4. **`BEH` + `TIME` + `GIST`** — `something about public libraries i saved a few months back`
5. **`DEM` + `TYPE` + `INTENT`/`BEH`** — `that page where i saved a quote for a talk`
6. **`ATTR` + `GIST` + hedge** — `the thing about rate limiting that guy wrote`

## 与产品文档记忆点对照

| 产品文档维度         | 形态 ID        |
| -------------------- | -------------- |
| 时间感               | `TIME`         |
| 行为感               | `BEH`          |
| 主观感受             | `FEEL`         |
| 对象类型             | `TYPE`         |
| 对象归属             | `ATTR` / `SRC` |
| （文档未单列）指示框 | `DEM`          |
| （文档未单列）hedge  | `HEDGE`        |
| （文档未单列）用途   | `INTENT`       |

## 反模式（像检索，不像口语）

- 刊名 + 术语 + 附注原词三连射
- 完整标题 / URL / 连续 10+ 字原文
- 学科黑话堆叠（`method of loci` 优于 `remembering with places`）
- ESL 语序硬译：`yesterday saved a poem about X` → 宜 `that X poem I saved yesterday`

## 版本

| 版  | 日期       | 变更                     |
| --- | ---------- | ------------------------ |
| v0  | 2026-09-08 | 初稿；待真人语料校准频次 |
