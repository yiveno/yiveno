# 定价（展示锚点）

结账权威在 **Dodo Payments Product**。Pro Product ID：Worker env（`DODO_PRODUCT_ID_PRO_*`）。官网只展示锚点价，不把 product id 下发浏览器。

规范见产品文档 **§A.3** / **§5.7**。对外 **Free + 仅 Pro**；Power User / Team 预留不售。

**商业状态（2026-10-18）：** Chrome Web Store **尚未上架**；**无**真实付费用户。下文档位/价为产品接线与展示锚点，**不得**写成已向公众开收。Worker 生产 `DODO_PAYMENTS_ENVIRONMENT` 须在真实开收前切 `live_mode`（见 `docs/ENVIRONMENT.md`）。

## 在售（产品接线 · 非「已对公众收费」）

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
