# 定价（展示锚点）

结账权威在 **Paddle Price Preview / Checkout**。Pro Price ID：`website/src/billing/tiers.ts` + env。

规范见产品文档 **§A.3** / **§5.7**。对外 **Free + 仅 Pro**；Power User / Team 预留不售。

## 在售

| 档位 | 说明                                                               |
| ---- | ------------------------------------------------------------------ |
| Free | $0；本机召回同档；无云同步                                         |
| Pro  | 月/年；展示价以 `Paddle.PricePreview().formattedTotals.total` 为准 |

标准锚点（未含税）：**$7.99/月 · $59.99/年**。

## Founding（实验，默认关）

Worker `BILLING_FOUNDING_ENABLED=true` 时才出现在 `GET /api/billing/plans`；官网定价页默认不展示。

## Checkout

- Overlay：`displayMode: overlay` + `variant: one-page`
- Success：`/welcome`
- Default payment link（Dashboard only）：`Checkout → Checkout settings` → 指向 `/checkout`（sandbox 可用 `http://localhost:3001/checkout`）
