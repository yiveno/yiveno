-- Paddle 为唯一计费 Provider：gumroad_* 改名为 provider_*；事件账改为 billing_events。
-- 可重复执行。无真实付费 Gumroad 行；假/mismatch 测试行删除。

-- 1) 删除无法授 Pro 的历史假行（仅旧列仍在时）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'gumroad_subscription_id'
  ) THEN
    DELETE FROM public.subscriptions
    WHERE verification_status = 'mismatch'
       OR gumroad_subscription_id IS NULL
       OR gumroad_subscription_id ILIKE 'test%'
       OR length(trim(coalesce(gumroad_subscription_id, ''))) < 8;
  END IF;
END $$;

-- 2) 拆掉依赖旧列名的外键
ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_gumroad_subscription_id_fkey;

-- 3) subscriptions 列改名
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'gumroad_subscription_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN gumroad_subscription_id TO provider_subscription_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'gumroad_order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_transaction_id'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN gumroad_order_id TO provider_transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'gumroad_variant_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_price_id'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN gumroad_variant_id TO provider_price_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'gumroad_subscriber_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
      AND column_name = 'provider_status'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN gumroad_subscriber_status TO provider_status;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider_customer_id text;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_gumroad_subscription_id_key;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_subscription_id_key;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_subscription_id_key
    UNIQUE (provider_subscription_id);

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_source_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_source_check
    CHECK (
      source IS NULL
      OR source = ANY (ARRAY['paddle_webhook', 'paddle_verify', 'admin_grant'])
    );

DROP INDEX IF EXISTS public.idx_subscriptions_gumroad_subscription_id;
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON public.subscriptions (provider_subscription_id);

-- 4) payment_records 列改名
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'gumroad_subscription_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'provider_subscription_id'
  ) THEN
    ALTER TABLE public.payment_records
      RENAME COLUMN gumroad_subscription_id TO provider_subscription_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'gumroad_order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'provider_transaction_id'
  ) THEN
    ALTER TABLE public.payment_records
      RENAME COLUMN gumroad_order_id TO provider_transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'gumroad_payment_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_records'
      AND column_name = 'provider_payment_id'
  ) THEN
    ALTER TABLE public.payment_records
      RENAME COLUMN gumroad_payment_id TO provider_payment_id;
  END IF;
END $$;

ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_gumroad_order_id_key;

ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_provider_transaction_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_records_provider_transaction_id_key'
      AND conrelid = 'public.payment_records'::regclass
  ) THEN
    ALTER TABLE public.payment_records
      ADD CONSTRAINT payment_records_provider_transaction_id_key
        UNIQUE (provider_transaction_id);
  END IF;
END $$;

ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_provider_subscription_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_records_provider_subscription_id_fkey'
      AND conrelid = 'public.payment_records'::regclass
  ) THEN
    ALTER TABLE public.payment_records
      ADD CONSTRAINT payment_records_provider_subscription_id_fkey
        FOREIGN KEY (provider_subscription_id)
        REFERENCES public.subscriptions (provider_subscription_id)
        NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_records_provider_transaction_id
  ON public.payment_records (provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_provider_subscription_id
  ON public.payment_records (provider_subscription_id);

-- 5) 事件账
DROP TABLE IF EXISTS public.gumroad_events;

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'paddle',
  provider_event_id text NOT NULL,
  event_type text,
  occurred_at timestamp with time zone,
  user_id uuid,
  result text NOT NULL,
  skip_reason text,
  payload_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT billing_events_provider_check
    CHECK (provider = 'paddle'),
  CONSTRAINT billing_events_result_check
    CHECK (result = ANY (ARRAY['applied', 'ignored', 'rejected', 'error']))
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_id_key
  ON public.billing_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_billing_events_created_at
  ON public.billing_events (created_at DESC);

COMMENT ON TABLE public.billing_events IS 'Paddle 入站幂等事件账；计费真相在 Paddle，本表可审计。';
COMMENT ON COLUMN public.subscriptions.source IS '投影来源：paddle_webhook | paddle_verify | admin_grant';
COMMENT ON COLUMN public.subscriptions.last_verified_at IS '最近一次与 Paddle 对齐时间（webhook 或 API）';
COMMENT ON COLUMN public.subscriptions.provider_subscription_id IS 'Paddle subscription ID';
COMMENT ON COLUMN public.subscriptions.provider_customer_id IS 'Paddle customer ID';
COMMENT ON COLUMN public.payment_records.provider_transaction_id IS 'Paddle transaction ID';
