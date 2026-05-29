-- 撤销 anon 角色对 SECURITY DEFINER 函数的执行权限
-- 这些函数应该只能被已认证用户或特定角色调用

-- 1. 撤销 get_user_subscription_status 函数的 anon 执行权限
REVOKE EXECUTE ON FUNCTION public.get_user_subscription_status(uuid) FROM anon;

-- 2. 撤销 set_audit_fields 函数的 anon 执行权限
REVOKE EXECUTE ON FUNCTION public.set_audit_fields() FROM anon;

-- 3. 撤销 update_updated_at_column 函数的 anon 执行权限
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;

-- 注释：这些函数仍然可以被 authenticated 角色调用
-- 如果需要进一步限制，可以考虑只授权给 service_role
