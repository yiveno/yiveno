# Natural sample · P001-NS03（已确认 · 库无 gold）

| 字段             | 填写                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sample id**    | P001-NS03                                                                                                                                                               |
| **Date**         | 2026-09-10                                                                                                                                                              |
| **Participant**  | P001                                                                                                                                                                    |
| **Gold（心里）** | [My Father, the Giant · The Atlantic](https://www.theatlantic.com/family/archive/2024/01/my-father-giant/677000/)（Ross Andersen · Family 栏目 · 写父亲作为 caretaker） |
| **库内**         | **无**该 URL / 标题；同站仅有探针「The Attention Economy Is a Lie」（路径亦含 `/677000/`，**不是**同一篇）                                                              |
| **确认**         | **`no`（正式采样作废分子）** — clue↔目标配对合理，但条目未 Capture，Recall 无法履约                                                                                     |

## 1. 首句

```text
An article about family affection
```

**维度：** TYPE=article · **C**=family affection（gist）  
**主锚：** C  
**口语质量：** ✅ 与 gold 主题吻合（父亲/亲情/照顾所爱之人；栏目即 Family）— 维护者认定「很符合」成立。

## 2. clue₁ 真机（MCP UI · 原句）

| 项          | 结果                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| Framing     | Looking for **article** · Based on "family, affection" · Hybrid 语义邻域 |
| 邻域        | 17 matches；Top1 Wired「Phone Is Listening」等噪声                       |
| 邻域含 gold | **否**（库内无 gold）                                                    |
| no_match    | 否（错邻域）                                                             |

## 3. 确认

- [ ] `yes`
- [ ] `miss`（库有但没找回）— **不适用**：库扫描无该篇
- [x] `no` — 目标在脑中清晰、clue 合格，但 **未进 Memory** → 不计正式采样命中/漏检分子；维度标注仍保留作「人会这么说」

**taxonomy：** `no_signal`（相对本机库）· Hybrid 在无字面锚时易漂到无关文章

## 4. 备注

- **根因（已修探针）：** 种库曾写假路径 `…/attention-economy-myth/677000/`；Atlantic 按 id **302** 到真文 [My Father, the Giant](https://www.theatlantic.com/family/archive/2024/01/my-father-giant/677000/)。属测试语料 bug，非产品同步。
- **修复：** `@yiveno/probe` researcher 改为 `…/yiveno-probe/attention-economy-myth/` + `corpus-url-safety` 单测杜绝再撞 CMS id。
- 正式采样仍记 **`no`（作废分子）**——当时账本标题≠落地页，不能当干净 yes/miss。
