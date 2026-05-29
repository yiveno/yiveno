-- 为 gumroad_subscription_id 外键添加索引
-- 此字段关联到 subscriptions 表，用于查询订阅的支付记录
-- 注意：如果列不存在，则跳过创建索引

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_records' 
    AND column_name = 'gumroad_subscription_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_payment_records_gumroad_subscription_id_fkey 
    ON public.payment_records(gumroad_subscription_id);
  END IF;
END $$;

-- 注释：此索引将提升通过 subscription_id 查询支付记录的性能
