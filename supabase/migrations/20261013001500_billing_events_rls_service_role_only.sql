-- billing_events：仅 Worker service_role 读写；客户端无 policy（与 website_waitlist 同口径）。

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_events FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.billing_events TO service_role;

COMMENT ON TABLE public.billing_events IS
  'Dodo 入站幂等事件账；计费真相在 Dodo，本表可审计。仅 service_role 访问（RLS 开、无 anon/authenticated policy）。';
