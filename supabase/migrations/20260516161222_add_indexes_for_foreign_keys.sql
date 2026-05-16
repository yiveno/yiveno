-- 为外键字段添加索引以提升查询性能
-- 特别是在 JOIN 查询和外键约束检查时

-- payment_records 表的外键索引
CREATE INDEX IF NOT EXISTS idx_payment_records_created_by 
ON public.payment_records(created_by);

CREATE INDEX IF NOT EXISTS idx_payment_records_updated_by 
ON public.payment_records(updated_by);

-- subscriptions 表的外键索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_by 
ON public.subscriptions(created_by);

CREATE INDEX IF NOT EXISTS idx_subscriptions_updated_by 
ON public.subscriptions(updated_by);

-- 注释：这些索引将提升以下场景的性能：
-- 1. 通过用户 ID 查询其创建/更新的记录
-- 2. JOIN 操作（例如：获取记录及其创建者信息）
-- 3. 外键约束的完整性检查
-- 4. DELETE CASCADE 操作
