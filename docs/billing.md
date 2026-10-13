# 计费（Dodo Payments）

唯一支付提供方：**Dodo Payments**（Merchant of Record）。Paddle 运行时已删除。

产品规范：`docs/product/Yiveno-产品文档-v4.0.md` **§A.3 / §A.3.1 / §A.3.2 / §5.7**。环境：`docs/ENVIRONMENT.md`。价格：`docs/pricing.md`。

## 数据流

```
Dodo → POST /api/webhooks/dodo（Standard Webhooks 验签）
    → billing_events 占位（幂等）
    → subscriptions / payment_records 投影
    → isPro / 云同步门禁
    →（仅首次授 Pro / applied）异步产品欢迎信
```

Refresh / 账户页 / Cron 用 `DODO_PAYMENTS_API_KEY` 拉 `GET /subscriptions/{id}` 对账。扩展不嵌 Dodo checkout：升级 → `/pricing`（Worker 创建 Checkout Session 后跳转 hosted 页），管理 → `/account` → Customer Portal。

## 授 Pro / 收回

- **开通**：签名有效 + UUID `metadata.yiveno_user_id` + 真实 Dodo `sub_` 订阅 ID；Dodo `active`（含 trial）视为有效。
- **周期结束取消**：`cancel_at_next_billing_date=true` → 投影 `cancel_at_period_end`，**仍 Pro** 至周期结束。
- **立刻收回**：`cancelled`（立即）/ `on_hold` / `failed` / `expired`；当前周期**全额**退款。
- **部分退款**：维持 Pro，除非订阅本身已取消。
- **孤立付款**：缺 `yiveno_user_id` → 不开 Pro，事件可观测。官网 Pricing：未登录点 Subscribe → `/login?next=/pricing&intent=subscribe`，登完回定价并自动开 checkout（始终带 `yiveno_user_id`）。

## 幂等

`billing_events` 唯一 `(provider, provider_event_id)`。`provider_event_id` 取 webhook 头 `webhook-id`。先占位再投影；重复 event → skip；投影失败删占位，便于 Dodo 重试。

访问面：仅 Worker `service_role` 读写（RLS 已开、无 `anon`/`authenticated` policy；并对二者 `REVOKE`）。扩展 / 官网客户端不得直连此表。

## 官方事件（已接线）

`subscription.active|updated|renewed|plan_changed|cancelled|on_hold|failed|expired`  
`payment.succeeded` / `payment.failed`  
`refund.succeeded`（全额退款立刻收回；部分退款维持 Pro）

未知 event：验签后记入事件账并 200，不崩。续费走 `subscription.renewed`。

## 产品欢迎信（未上线）

与 Dodo 付款收据分开。规范：产品文档 **§A.3**。须 **Workers Paid** + `yiveno.com` Email Sending；未开通前代码可留、不发信、不 5xx webhook。

- **触发**：`subscription.active` 且投影 `applied`（已授 Pro）。`rejected` / `duplicate` / 乱序 / Dashboard 示例不发。
- **通道**：Cloudflare Email Sending；Worker 绑定 `EMAIL`；发件 `hello@yiveno.com`。
- **收件人**：payload `customer.email`，否则 Supabase Auth。
- **幂等**：同一 `webhook-id` 不二次投影，故不重发。
- **失败**：投影已 200 后 `waitUntil` 发送；发信失败只打日志，webhook 仍成功。

## 本地 / 生产

Worker Secrets：`DODO_PAYMENTS_API_KEY`、`DODO_PAYMENTS_WEBHOOK_KEY`、Product ID。  
`DODO_PAYMENTS_ENVIRONMENT`：`test_mode` | `live_mode`（SDK/客户端缺省是 live，开发必须显式 test）。  
官网不持有 Dodo 密钥；checkout 只经 Worker。

**不要**把密钥提交进仓库。生产库迁移与 Worker 部署须单独确认后再做。
