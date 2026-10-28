# 计费（Dodo Payments）

唯一支付提供方：**Dodo Payments**（Merchant of Record）。Paddle 运行时已删除。

产品规范：`docs/product/Yiveno-产品文档-v4.0.md` **§A.3 / §A.3.1 / §A.3.2 / §5.7**。环境：`docs/ENVIRONMENT.md`。价格：`docs/pricing.md`。

**商业状态（2026-10-18）：** CWS 未上架；**尚未**向公众收费。下文描述产品接线与对账门禁；真实开收前须 `DODO_PAYMENTS_ENVIRONMENT=live_mode` 并完成 ENVIRONMENT 上线清单。

## 数据流

```
Dodo → POST /api/webhooks/dodo（Standard Webhooks 验签）
    → billing_events 占位（幂等）
    → subscriptions / payment_records 投影
    → isPro / 云同步门禁
    →（仅首次授 Pro / applied）异步产品欢迎信
```

Refresh / 账户页 / Cron 用 `DODO_PAYMENTS_API_KEY` 拉 `GET /subscriptions/{id}` 对账。扩展不嵌 Dodo checkout：升级 → `/pricing`（Worker 创建 Checkout Session 后跳转 hosted 页；`return_url` → `/account?checkout=return`），管理 → `/account` → Customer Portal。Dodo 在回跳 URL 追加 `status`（如 `succeeded` / `active` / `failed`）；账户页仅作 UI 分流（失败提示 / 核对中），**授 Pro 只信 webhook 投影**。支付成功确认归 Dodo；产品欢迎信归 Yiveno（§A.3）。

## 结账币种（Adaptive Currency · Normative）

展示/基价权威见 [`docs/pricing.md`](./pricing.md)（单一 **USD**）。Worker `createDodoCheckout` **不传** `billing_currency` / `billing_address`。

**Dodo 解析扣款币种（顺序）：**

1. Checkout API 显式 `billing_address.country` 或 `billing_currency`（Yiveno 当前不传）
2. Dodo 侧已有 customer 的账单地址
3. IP 地理（可用时）
4. 回退到商品基价币种 **USD**

Dashboard **Adaptive Currency** 开启后：支持国默认本地币（中国 → CNY）；金额 = USD 基价 × 实时汇率；Checkout 上通常可切回 USD。非 USD/EUR/GBP 的本地币：MoR **结算进账仍多为 USD**。

| 能力              | 作用                           | 现状                                         |
| ----------------- | ------------------------------ | -------------------------------------------- |
| Adaptive Currency | 同一 USD SKU → 本地币展示/扣款 | 预期行为；收据 CNY ≠ 人民币本地化定价        |
| Localized Pricing | 按国家/币种钉死另一套标价      | **未启用**；启用须同步改 `pricing.md` / §A.3 |
| 定价页市场 toggle | 仓内双价 UI                    | **禁止**                                     |

**运维自检（开收 / 改价后手测）：**

1. Dodo Dashboard → Settings → Business → **Adaptive Currency** 是否按预期开启。
2. Pro Product 是否误开 **PPP** / **Charm Pricing**（会再偏离纯汇率）。
3. 对照：账单国 / IP 为 **CN** → 收据可为 CNY（基价仍 $7.99）；**非 CN** → USD 或该国本地币。
4. 勿把换汇收据写成对外「已支持人民币定价」；微信订阅等第二通道仍见国内化审计 P2（Dodo WeChat 文档：订阅不支持）。

## 授 Pro / 收回

- **开通**：签名有效 + UUID `metadata.yiveno_user_id` + 真实 Dodo `sub_` 订阅 ID；Dodo `active`（含 trial）视为有效。
- **周期结束取消**：`cancel_at_next_billing_date=true` → 投影 `cancel_at_period_end`，**仍 Pro** 至周期结束。
- **立刻收回**：`cancelled`（立即）/ `on_hold` / `failed` / `expired`；当前周期**全额**退款。
- **部分退款**：维持 Pro，除非订阅本身已取消。
- **全额退款投影（`refund.succeeded`）：** Dodo Refund payload **常无** `subscription_id` / `yiveno_user_id`。Worker 用 `payment_id` → 本机 `payment_records` →（必要时）`GET /payments/{id}` 反查订阅与 user；全额退 → 本地 expire（`provider_status=refunded`）+ **尽力** `PATCH` 立即取消 Dodo 订阅（退款本身不取消订阅，否则对账会刷回 Pro）。对账若见本地已 `refunded` expire，即使 Dodo 仍 active 也不复活 Pro。退款 `payment_records` 的 `provider_transaction_id` = **refund_id**（`provider_payment_id` = 原 `payment_id`），避免与 `payment.succeeded` 行撞唯一键。投影结束后须回写 `billing_events.result`（拒绝不得留「假 applied」）。**生产 Worker 须部署含本逻辑的版本**；仅合入 git 不够。
- **孤立付款**：缺 `yiveno_user_id` → 不开 Pro，事件可观测。官网 Pricing：未登录点 Subscribe → `/login?next=/pricing&intent=subscribe`，登完回定价并自动开 checkout（始终带 `yiveno_user_id`）。

## 幂等

`billing_events` 唯一 `(provider, provider_event_id)`。`provider_event_id` 取 webhook 头 `webhook-id`。先占位再投影；重复 event → skip；投影失败删占位，便于 Dodo 重试。

访问面：仅 Worker `service_role` 读写（RLS 已开、无 `anon`/`authenticated` policy；并对二者 `REVOKE`）。扩展 / 官网客户端不得直连此表。

## 官方事件（已接线）

`subscription.active|updated|renewed|plan_changed|cancelled|on_hold|past_due|paused|unpaused|failed|expired`  
`payment.succeeded` / `payment.failed`  
`refund.succeeded`（全额退款立刻收回；部分退款维持 Pro；Refund payload 常无 `subscription_id` → `payment_id` 反查）  
`dispute.lost` / `dispute.accepted`（败诉/接受 → 收回 Pro，同全额退款路径）

**状态口径（与 Dodo 对齐）：**

| Dodo status                     | 本地投影                             | Pro          |
| ------------------------------- | ------------------------------------ | ------------ |
| `active` / `past_due`（宽限期） | `active`（`provider_status` 记原值） | 有           |
| `on_hold`                       | `past_due`（历史命名）               | 无           |
| `paused` / `expired` / `failed` | `expired`                            | 无           |
| `cancelled` + 周期末取消        | 仍 `active` + `cancel_at_period_end` | 有（至期末） |
| 立即 `cancelled`                | 降级                                 | 无           |

未知 event（含 `dispute.opened`、payout、credit 等）：验签后记入事件账并 200，不崩。续费走 `subscription.renewed`。

## 产品欢迎信

与 Dodo 付款收据分开。规范：产品文档 **§A.3**。

- **触发**：`subscription.active` 且投影 `applied`（已授 Pro）。`rejected` / `duplicate` / 乱序 / Dashboard 示例不发。
- **通道**：阿里云 DirectMail `SingleSendMail`（与 OTP 的 Supabase SMTP **分立**；同属 DirectMail 配额）。Worker Secrets：`ALIYUN_DM_ACCESS_KEY_ID` / `ALIYUN_DM_ACCESS_KEY_SECRET`；发件 `hello@yiveno.com`（须控制台已建发信地址）；回信默认 `support@yiveno.com`。
- **收件人**：payload `customer.email`，否则 Supabase Auth。
- **文案锚点**：subject `You're on Yiveno Pro`；正文致谢 + sync 下一步；主 CTA `Manage subscription` → `/account`；脚注标明收据来自 Dodo（见 `pro-welcome-email.ts` `welcomeCopy`）。
- **幂等**：同一 `webhook-id` 不二次投影，故不重发。
- **失败**：投影已 200 后 `waitUntil` 发送；未配 AK / 发信失败只打日志，webhook 仍成功。
- **未改**：卸载/结构化反馈邮件仍走 Cloudflare `EMAIL` 绑定（Routing destination）。

## 本地 / 生产

Worker Secrets：`DODO_PAYMENTS_API_KEY`、`DODO_PAYMENTS_WEBHOOK_KEY`、Product ID。  
`DODO_PAYMENTS_ENVIRONMENT`：`test_mode` | `live_mode`（SDK/客户端缺省是 live，开发必须显式 test）。  
官网不持有 Dodo 密钥；checkout 只经 Worker。

**不要**把密钥提交进仓库。生产库迁移与 Worker 部署须单独确认后再做。
