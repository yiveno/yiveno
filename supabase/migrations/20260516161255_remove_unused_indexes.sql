-- 删除未使用的索引以节省存储空间和提升写入性能
-- 这些索引从未被查询使用过，可以安全删除

-- payment_records 表的未使用索引
DROP INDEX IF EXISTS public.idx_payment_records_user_id;
DROP INDEX IF EXISTS public.idx_payment_records_deleted_at;
DROP INDEX IF EXISTS public.idx_payment_records_webhook_id;
DROP INDEX IF EXISTS public.idx_payment_records_gumroad_order_id;
DROP INDEX IF EXISTS public.idx_payment_records_gumroad_subscription_id;
DROP INDEX IF EXISTS public.idx_payment_records_status;

-- subscriptions 表的未使用索引
DROP INDEX IF EXISTS public.idx_subscriptions_deleted_at;
DROP INDEX IF EXISTS public.idx_subscriptions_status;
DROP INDEX IF EXISTS public.idx_subscriptions_tier;
DROP INDEX IF EXISTS public.idx_subscriptions_gumroad_id;

-- 注释：
-- 1. 删除未使用的索引可以：
--    - 减少存储空间占用
--    - 提升 INSERT/UPDATE/DELETE 性能（无需维护这些索引）
--    - 简化数据库维护
-- 2. 如果将来需要这些索引，可以根据实际查询模式重新创建
-- 3. 保留了刚创建的外键索引（created_by, updated_by），因为它们对性能很重要
