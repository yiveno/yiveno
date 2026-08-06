-- 订阅投影可证明性：来源 / 对账状态 / 事件账；并降级测试假数据（§A.3.2）。

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_status text,
  ADD COLUMN IF NOT EXISTS gumroad_subscriber_status text;

UPDATE public.subscriptions
SET
  source = COALESCE(source, 'gumroad_webhook'),
  verification_status = COALESCE(verification_status, 'unverified')
WHERE source IS NULL OR verification_status IS NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_source_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check
    CHECK (
      source IS NULL
      OR source = ANY (ARRAY['gumroad_webhook', 'gumroad_verify', 'admin_grant'])
    );

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_verification_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_verification_status_check
    CHECK (
      verification_status IS NULL
      OR verification_status = ANY (
        ARRAY['verified', 'unverified', 'mismatch', 'stale']
      )
    );

-- 假 / 测试订阅 ID：立刻收回 Pro（不等 period_end）
UPDATE public.subscriptions
SET
  status = 'expired',
  tier = 'pro',
  verification_status = 'mismatch',
  gumroad_subscriber_status = 'revoked_test_id',
  cancelled_at = COALESCE(cancelled_at, now()),
  current_period_end = LEAST(current_period_end, now()),
  updated_at = now()
WHERE status = 'active'
  AND (
    gumroad_subscription_id IS NULL
    OR gumroad_subscription_id ILIKE 'test%'
    OR length(trim(gumroad_subscription_id)) < 8
  );

CREATE TABLE IF NOT EXISTS public.gumroad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  notification_type text,
  gumroad_subscription_id text,
  gumroad_order_id text,
  user_id uuid,
  result text NOT NULL,
  skip_reason text,
  payload_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gumroad_events_result_check
    CHECK (result = ANY (ARRAY['applied', 'skipped', 'rejected', 'error']))
);

CREATE UNIQUE INDEX IF NOT EXISTS gumroad_events_idempotency_key_key
  ON public.gumroad_events (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_gumroad_events_created_at
  ON public.gumroad_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_last_verified_at
  ON public.subscriptions (last_verified_at)
  WHERE status = 'active';

COMMENT ON TABLE public.gumroad_events IS 'Gumroad Ping 入站幂等事件账；计费真相在 Gumroad，本表可审计。';
COMMENT ON COLUMN public.subscriptions.source IS '投影来源：gumroad_webhook | gumroad_verify | admin_grant';
COMMENT ON COLUMN public.subscriptions.last_verified_at IS '最近一次与 Gumroad 对齐时间（webhook 或 API）';
COMMENT ON COLUMN public.subscriptions.verification_status IS 'verified | unverified | mismatch | stale';
