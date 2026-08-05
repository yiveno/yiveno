-- 迁移：移除分享功能（不再考虑分享）
-- 清理相关表：shares / shared_bookmarks / direct_shares / notifications / import_history
-- 注意：drop 会导致旧分享链接失效（返回 404）。

DROP TABLE IF EXISTS public.import_history CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.direct_shares CASCADE;
DROP TABLE IF EXISTS public.shared_bookmarks CASCADE;
DROP TABLE IF EXISTS public.shares CASCADE;

