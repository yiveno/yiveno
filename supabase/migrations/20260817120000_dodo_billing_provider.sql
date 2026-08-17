-- 计费提供方从 Paddle 切到 Dodo Payments（无存量正式订阅，可硬切）。

ALTER TABLE public.billing_events
  DROP CONSTRAINT IF EXISTS billing_events_provider_check;

UPDATE public.billing_events
SET provider = 'dodo'
WHERE provider = 'paddle';

ALTER TABLE public.billing_events
  ALTER COLUMN provider SET DEFAULT 'dodo';

ALTER TABLE public.billing_events
  ADD CONSTRAINT billing_events_provider_check
  CHECK (provider = 'dodo');

COMMENT ON TABLE public.billing_events IS 'Dodo 入站幂等事件账；计费真相在 Dodo，本表可审计。';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_source_check;

UPDATE public.subscriptions
SET source = CASE source
  WHEN 'paddle_webhook' THEN 'dodo_webhook'
  WHEN 'paddle_verify' THEN 'dodo_verify'
  ELSE source
END
WHERE source IN ('paddle_webhook', 'paddle_verify');

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check
  CHECK (
    source IS NULL
    OR source = ANY (ARRAY['dodo_webhook', 'dodo_verify', 'admin_grant'])
  );

COMMENT ON COLUMN public.subscriptions.source IS '投影来源：dodo_webhook | dodo_verify | admin_grant';
COMMENT ON COLUMN public.subscriptions.last_verified_at IS '最近一次与 Dodo 对齐时间（webhook 或 API）';
COMMENT ON COLUMN public.subscriptions.provider_subscription_id IS 'Dodo subscription ID';
COMMENT ON COLUMN public.subscriptions.provider_customer_id IS 'Dodo customer ID';
COMMENT ON COLUMN public.payment_records.provider_transaction_id IS 'Dodo payment ID';
