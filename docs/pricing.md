# 定价（展示锚点）

结账权威在 **Dodo Payments Product**。Pro Product ID：Worker env（`DODO_PRODUCT_ID_PRO_*`）。官网只展示锚点价，不把 product id 下发浏览器。

规范见产品文档 **§A.3** / **§5.7**。对外 **Free + 仅 Pro**；Power User / Team 预留不售。

## 在售

| 档位 | 说明                                               |
| ---- | -------------------------------------------------- |
| Free | $0；本机召回同档；无云同步                         |
| Pro  | 月/年；展示锚点 **$7.99/月 · $59.99/年**（未含税） |

## Founding（实验，默认关）

Worker `BILLING_FOUNDING_ENABLED=true` 时才出现在 `GET /api/billing/plans`；官网定价页默认不展示。

## Checkout

- Hosted：Worker `POST /api/billing/checkout-session` → 跳转 Dodo `checkout_url`
- Success：`/welcome`
- 未登录 Subscribe → `/login?next=/pricing&intent=subscribe`
