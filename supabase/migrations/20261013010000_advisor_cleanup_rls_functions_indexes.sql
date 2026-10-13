-- Advisor 清理（优先级 1→2）：
-- 1) 删除 share 表退役后残留的函数；收紧仍在用函数的 EXECUTE + 固定 search_path
-- 2) RLS policy：auth.uid() → (select auth.uid())；payment_records 去掉 Gumroad 重复索引

-- ---------------------------------------------------------------------------
-- 1a. 删除已无表依赖的 share 残留函数
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_share_import_count(uuid);
DROP FUNCTION IF EXISTS public.increment_share_view_count(uuid);
DROP FUNCTION IF EXISTS public.generate_short_code();
DROP FUNCTION IF EXISTS public.update_notification_read_at();
DROP FUNCTION IF EXISTS public.update_direct_share_read_at();

-- ---------------------------------------------------------------------------
-- 1b. 仍在用的函数：固定 search_path，收回客户端 EXECUTE
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.set_audit_fields() SET search_path = public;
ALTER FUNCTION public.get_user_subscription_status(uuid) SET search_path = public;

-- handle_new_user：仅 auth.users 触发器使用，禁止经 REST RPC 调用
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 触发器函数：禁止客户端直调
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_audit_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_audit_fields() TO service_role;

-- 订阅状态：Worker 直查 subscriptions 表，RPC 仅保留 service_role
REVOKE ALL ON FUNCTION public.get_user_subscription_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 2a. RLS initplan：profiles / memory_items / memory_sync_backups
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can select own memory items" ON public.memory_items;
CREATE POLICY "Users can select own memory items"
  ON public.memory_items FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can insert own memory items" ON public.memory_items;
CREATE POLICY "Users can insert own memory items"
  ON public.memory_items FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can update own memory items" ON public.memory_items;
CREATE POLICY "Users can update own memory items"
  ON public.memory_items FOR UPDATE
  USING ((select auth.uid()) = owner_id)
  WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can delete own memory items" ON public.memory_items;
CREATE POLICY "Users can delete own memory items"
  ON public.memory_items FOR DELETE
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can select own memory sync backups" ON public.memory_sync_backups;
CREATE POLICY "Users can select own memory sync backups"
  ON public.memory_sync_backups FOR SELECT
  USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Users can insert own memory sync backups" ON public.memory_sync_backups;
CREATE POLICY "Users can insert own memory sync backups"
  ON public.memory_sync_backups FOR INSERT
  WITH CHECK ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- 2b. payment_records：去掉 Gumroad 旧名重复索引，保留 provider_* 命名
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_payment_records_gumroad_subscription_id;
DROP INDEX IF EXISTS public.idx_payment_records_gumroad_subscription_id_fkey;
DROP INDEX IF EXISTS public.idx_payment_records_gumroad_order_id;
