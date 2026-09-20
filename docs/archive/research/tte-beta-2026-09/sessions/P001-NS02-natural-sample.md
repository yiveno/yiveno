# Natural sample · P001-NS02（已确认）

| 字段            | 填写                                                |
| --------------- | --------------------------------------------------- |
| **Sample id**   | P001-NS02                                           |
| **Date**        | 2026-09-10                                          |
| **Participant** | P001                                                |
| **Gold**        | **Dodo Payments 官网** · `dodopayments.com`（Top1） |
| **确认**        | **`yes`**（2026-09-10 · 维护者）                    |

## 1. 首句

```text
The official website of the product related to payment that I recently collected
```

**维度：**

- **T** recently（→ `recent` / low · Framing Around）
- **S/G** payment product · official website
- **行为** collected / recently_saved 意味  
  **主锚：** S+G（支付产品官网）+ T（recently）

## 2. clue₁ 真机（MCP UI · 原句）

| 项          | 结果                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Framing     | Looking for **page** · **Around recently** · Based on "official, product, payment"             |
| 邻域        | 14 matches                                                                                     |
| **Top1**    | **Billing & Payments Platform… \| Dodo Payments** · dodopayments.com · Saved **2 minutes ago** |
| #2          | Idempotent requests · stripe.com · note「payments incident…」· Saved last month                |
| 邻域含 gold | **yes**（Top1）                                                                                |
| no_match    | 否                                                                                             |

## 3. 确认

- [x] `yes` — 目标是 Dodo 官网，首屏 Top1 认得出
- [ ] `miss`
- [ ] `no`

**taxonomy：** `time_soft_ok`（Around recently · ADR-011）· 主锚 S/G+T 有效

## 4. 备注

正式采样有效例：刚 Capture 的支付产品官网 + 糊时间 + 品类词，邻域正确且 Top1 命中。
