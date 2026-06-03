-- 统一订阅/支付字段契约：数据库使用 snake_case，外部 Gumroad 字段显式带 gumroad_ 前缀。

-- subscriptions: Lemon Squeezy -> Gumroad
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'lemon_squeezy_subscription_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subscriptions'
      AND column_name = 'gumroad_subscription_id'
  ) THEN
    ALTER TABLE public.subscriptions
      RENAME COLUMN lemon_squeezy_subscription_id TO gumroad_subscription_id;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gumroad_subscription_id text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gumroad_order_id text,
  ADD COLUMN IF NOT EXISTS gumroad_variant_id text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_lemon_squeezy_subscription_id_key,
  DROP CONSTRAINT IF EXISTS subscriptions_gumroad_subscription_id_key,
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_gumroad_subscription_id_key UNIQUE (gumroad_subscription_id),
  ADD CONSTRAINT subscriptions_status_check
    CHECK (status = ANY (ARRAY['active', 'past_due', 'cancelled', 'expired', 'paused']));

DROP INDEX IF EXISTS public.idx_subscriptions_lemon_id;
CREATE INDEX IF NOT EXISTS idx_subscriptions_gumroad_subscription_id
  ON public.subscriptions(gumroad_subscription_id);

-- payment_records: 支付状态只表达支付语义；Gumroad 订阅 ID 不再叫 subscription_id。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'lemon_squeezy_order_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'gumroad_order_id'
  ) THEN
    ALTER TABLE public.payment_records
      RENAME COLUMN lemon_squeezy_order_id TO gumroad_order_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'lemon_squeezy_subscription_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'gumroad_subscription_id'
  ) THEN
    ALTER TABLE public.payment_records
      RENAME COLUMN lemon_squeezy_subscription_id TO gumroad_subscription_id;
  END IF;
END $$;

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS gumroad_order_id text,
  ADD COLUMN IF NOT EXISTS gumroad_subscription_id text,
  ADD COLUMN IF NOT EXISTS gumroad_payment_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.payment_records
  DROP CONSTRAINT IF EXISTS payment_records_lemon_squeezy_order_id_key,
  DROP CONSTRAINT IF EXISTS payment_records_lemon_squeezy_subscription_id_fkey,
  DROP CONSTRAINT IF EXISTS payment_records_gumroad_order_id_key,
  DROP CONSTRAINT IF EXISTS payment_records_gumroad_subscription_id_fkey,
  DROP CONSTRAINT IF EXISTS payment_records_status_check;

ALTER TABLE public.payment_records
  ADD CONSTRAINT payment_records_gumroad_order_id_key UNIQUE (gumroad_order_id),
  ADD CONSTRAINT payment_records_gumroad_subscription_id_fkey
    FOREIGN KEY (gumroad_subscription_id) REFERENCES public.subscriptions(gumroad_subscription_id) NOT VALID,
  ADD CONSTRAINT payment_records_status_check
    CHECK (status = ANY (ARRAY['pending', 'paid', 'failed', 'refunded']));

DROP INDEX IF EXISTS public.idx_payment_records_order_id;
DROP INDEX IF EXISTS public.idx_payment_records_subscription_id;
CREATE INDEX IF NOT EXISTS idx_payment_records_gumroad_order_id
  ON public.payment_records(gumroad_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_gumroad_subscription_id
  ON public.payment_records(gumroad_subscription_id);

COMMENT ON COLUMN public.subscriptions.gumroad_subscription_id IS 'Unique subscription ID from Gumroad';
COMMENT ON COLUMN public.subscriptions.gumroad_order_id IS 'Latest Gumroad order or sale ID';
COMMENT ON COLUMN public.subscriptions.gumroad_variant_id IS 'Gumroad variant/plan ID';
COMMENT ON COLUMN public.payment_records.gumroad_order_id IS 'Gumroad order or sale ID';
COMMENT ON COLUMN public.payment_records.gumroad_subscription_id IS 'Gumroad subscription ID';
COMMENT ON COLUMN public.payment_records.gumroad_payment_id IS 'Gumroad charge/payment ID';
