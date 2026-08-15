-- 官网预约下载名单。仅 Worker service_role 写入；anon / authenticated 无策略。

CREATE TABLE IF NOT EXISTS public.website_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.website_waitlist IS '官网预约安装邮箱；仅用于通知可安装';
COMMENT ON COLUMN public.website_waitlist.email IS '规范化小写邮箱';

CREATE UNIQUE INDEX IF NOT EXISTS website_waitlist_email_lower
  ON public.website_waitlist (lower(email));

ALTER TABLE public.website_waitlist ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.website_waitlist FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.website_waitlist TO service_role;
