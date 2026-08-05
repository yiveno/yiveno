-- 迁移：清理过期/无用业务数据（不触碰 memory_items 本体）
-- 1) `memory_sync_backups`：每个 owner 只保留最近 5 条备份快照（避免无限增长）
-- 2) `payment_records` / `subscriptions`：清理已软删且超过 180 天的历史行

BEGIN;

-- 1) backups：keep last 5 per owner
WITH ranked AS (
  SELECT
    id,
    owner_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.memory_sync_backups
)
DELETE FROM public.memory_sync_backups b
USING ranked r
WHERE b.id = r.id
  AND r.rn > 5;

-- 2) payment_records：清理软删历史
DELETE FROM public.payment_records pr
WHERE pr.deleted_at IS NOT NULL
  AND pr.deleted_at < NOW() - INTERVAL '180 days';

-- 3) subscriptions：清理软删历史（避免误删仍有未软删 payment_records 的 subscription）
DELETE FROM public.subscriptions s
WHERE s.deleted_at IS NOT NULL
  AND s.deleted_at < NOW() - INTERVAL '180 days'
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_records pr
    WHERE pr.gumroad_subscription_id = s.gumroad_subscription_id
      AND pr.deleted_at IS NULL
  );

COMMIT;

