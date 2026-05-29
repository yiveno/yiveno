-- 修复 SECURITY DEFINER 函数的权限问题
-- 撤销 PUBLIC（包括 anon）的执行权限，只允许 authenticated 和 service_role 调用

-- 1. get_user_subscription_status 函数
REVOKE ALL ON FUNCTION public.get_user_subscription_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status(uuid) TO service_role;

-- 2. set_audit_fields 函数（这是触发器函数，应该只能被系统调用）
REVOKE ALL ON FUNCTION public.set_audit_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_audit_fields() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_audit_fields() TO service_role;

-- 3. update_updated_at_column 函数（这是触发器函数，应该只能被系统调用）
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- 注释：
-- - get_user_subscription_status: 允许已认证用户查询订阅状态
-- - set_audit_fields 和 update_updated_at_column: 仅系统触发器使用，不应被用户直接调用
