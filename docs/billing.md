# 计费（Paddle Billing）

唯一支付提供方：**Paddle Billing**（非 Classic）。Gumroad 运行时已删除。

产品规范：`docs/product/Yiveno-产品文档-v4.0.md` **§A.3 / §A.3.1 / §A.3.2 / §5.7**。环境：`docs/ENVIRONMENT.md`。价格：`docs/pricing.md`。

## 数据流

```
Paddle → POST /api/webhooks/paddle（验签）
      → billing_events 占位（幂等）
      → subscriptions / payment_records 投影
      → isPro / 云同步门禁
```

Refresh / 账户页 / Cron 用 `PADDLE_API_KEY` 拉 `GET /subscriptions/{id}` 对账。扩展不嵌 Paddle.js：升级 → `/pricing`，管理 → `/account` → Customer Portal。

## 授 Pro / 收回

- **开通**：签名有效 + UUID `custom_data.yiveno_user_id` + 真实 `sub_` 订阅 ID；`trialing` 视为 active。
- **周期结束取消**：Paddle 仍 `active` 且 `scheduled_change.action=cancel` → 投影 `cancel_at_period_end`，**仍 Pro** 至周期结束。
- **立刻收回**：`canceled` / `paused` / `past_due`；当前周期**全额**退款。
- **部分退款**：维持 Pro，除非订阅本身已取消。
- **孤立付款**：缺 `yiveno_user_id` → 不开 Pro，事件可观测。官网 Pricing：未登录点 Subscribe → `/login?next=/pricing&intent=subscribe`，登完回定价并自动开 overlay（始终带 `yiveno_user_id`）。

## 幂等

`billing_events` 唯一 `(provider, provider_event_id)`。先占位再投影；重复 event → skip；投影失败删占位，便于 Paddle 重试。

## 官方事件（已接线）

`subscription.created|updated|canceled|activated|past_due|paused|resumed|trialing`  
`transaction.completed` / `transaction.payment_failed`  
`adjustment.created|updated`（仅 `action=refund` 且 `status=approved`）

未知 event：验签后记入事件账并 200，不崩。续费走 `subscription.updated`（无 `subscription.renewed`）。

## 本地 / 生产

Worker Secrets：`PADDLE_API_KEY`、`PADDLE_WEBHOOK_SECRET`、Price ID。  
官网：`PUBLIC_PADDLE_CLIENT_TOKEN`、`PUBLIC_PADDLE_ENV`（由 `VITE_PADDLE_*` 同步）。  
Default payment link 必须指向已含 Paddle.js 的 `/checkout`。

**不要**把密钥提交进仓库。生产库迁移与 Worker 部署须单独确认后再做。
