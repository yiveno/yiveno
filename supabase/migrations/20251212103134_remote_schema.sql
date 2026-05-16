drop extension if exists "pg_net";

drop trigger if exists "update_payment_records_updated_at" on "public"."payment_records";

drop trigger if exists "update_subscriptions_updated_at" on "public"."subscriptions";

alter table "public"."payment_records" drop constraint "payment_records_lemon_squeezy_subscription_id_fkey";

alter table "public"."payment_records" add constraint "payment_records_lemon_squeezy_subscription_id_fkey" FOREIGN KEY (lemon_squeezy_subscription_id) REFERENCES public.subscriptions(lemon_squeezy_subscription_id) not valid;

alter table "public"."payment_records" validate constraint "payment_records_lemon_squeezy_subscription_id_fkey";

CREATE TRIGGER update_payment_records_updated_at BEFORE UPDATE ON public.payment_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


