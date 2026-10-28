# 定价（展示锚点）

结账权威在 **Dodo Payments Product**。Pro Product ID：Worker env（`DODO_PRODUCT_ID_PRO_*`）。官网只展示锚点价，不把 product id 下发浏览器。

规范见产品文档 **§A.3** / **§5.7**。对外 **Free + 仅 Pro**；Power User / Team 预留不售。

**商业状态（2026-10-18）：** Chrome Web Store **尚未上架**；**无**真实付费用户。下文档位/价为产品接线与展示锚点，**不得**写成已向公众开收。Worker 生产 `DODO_PAYMENTS_ENVIRONMENT` 须在真实开收前切 `live_mode`（见 `docs/ENVIRONMENT.md`）。

## 在售（产品接线 · 非「已对公众收费」）

| 档位 | 说明                                               |
| ---- | -------------------------------------------------- |
| Free | $0；本机召回同档；无云同步                         |
| Pro  | 月/年；展示锚点 **$7.99/月 · $59.99/年**（未含税） |

## 币种与多市场（Normative · 2026-10-28）

| 层               | 权威                                          | 说明                                                                                                      |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **展示 / 基价**  | 本文件 + `plans.ts` / `tiers.ts`              | **仅 USD 锚点**；北美与大陆官网（`yiveno.com` / `yiveno.cn`）同价                                         |
| **结账扣款币种** | **Dodo Adaptive Currency**                    | 按账单国 / 已存 customer / IP 选本地币；金额 = USD 基价 × 实时汇率（Dashboard 若开 PPP / Charm 会再偏移） |
| **固定本地价**   | Dodo **Localized Pricing**（未配置 = 未上线） | 按国家或币种钉死另一套标价；**不等于**换汇收据                                                            |

- Worker `createDodoCheckout` **不传** `billing_currency` / `billing_address`；币种完全由 Dodo Checkout + Dashboard 决定。
- 收据出现 **CN¥** 等本地币 = Adaptive Currency 换汇，**不得**对外写成「已上线人民币本地化定价」。
- 官网定价页**禁止**「北美 \| 大陆」价签 toggle；市场入口靠域名分流（`GEO_CN_MARKET_LIVE`），不鼓励页内套利。
- `yiveno.cn` `/pricing` 可加诚实旁注（结账可能按汇率显示本地币），**仍只展示 USD 锚点**；禁止写死「约 ¥xx」当权威价。
- 若日后要「大陆故意更便宜」：先在 Dodo 配 Localized Pricing，再改本文件与产品文档 §A.3；仍是同一 Product / plan id 映射。
- 币种解析顺序与 Dashboard 运维自检见 [`docs/billing.md`](./billing.md)「结账币种」。

## Founding（实验，默认关）

Worker `BILLING_FOUNDING_ENABLED=true` 时才出现在 `GET /api/billing/plans`；官网定价页默认不展示。

## Checkout

- Hosted：Worker `POST /api/billing/checkout-session` → 跳转 Dodo `checkout_url`
- `return_url`：`/account?checkout=return`（中性回跳；成败看 Dodo 追加的 `status` + 账户页对账；**禁止** URL 字面 success 冒充已付款；产品致谢归欢迎信，不另做 Welcome 落地页）
- 旧路径 `/welcome` → 301 到上述账户回跳
- 未登录 Subscribe → `/login?next=/pricing&intent=subscribe`
