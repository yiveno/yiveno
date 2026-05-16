-- ========================================
-- 步骤 1: 删除现有 RLS 策略（以便修改 user_id 类型）
-- ========================================

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
drop policy if exists "Users can insert own subscriptions" on public.subscriptions;
drop policy if exists "Users can update own subscriptions" on public.subscriptions;
drop policy if exists "Users can view own payment records" on public.payment_records;

-- ========================================
-- 步骤 2: 修复 1 - 将 user_id 从 TEXT 改为 UUID
-- ========================================

alter table public.subscriptions
  alter column user_id type uuid using user_id::uuid;

alter table public.payment_records
  alter column user_id type uuid using user_id::uuid;

-- ========================================
-- 步骤 3: 修复 2 - 重新创建优化后的 RLS 策略
-- ========================================

-- subscriptions 表的策略
create policy "Users can view own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "Users can insert own subscriptions"
  on public.subscriptions
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "Users can update own subscriptions"
  on public.subscriptions
  for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- payment_records 表的策略
create policy "Users can view own payment records"
  on public.payment_records
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- 修复 4: 添加 payment_records 的 INSERT 策略
create policy "Users can insert own payment records"
  on public.payment_records
  for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

-- ========================================
-- 步骤 4: 修复 3 - 修复函数的 search_path 安全问题
-- ========================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ========================================
-- 步骤 5: 修复 7 - 添加软删除支持
-- ========================================

alter table public.subscriptions
  add column if not exists deleted_at timestamptz default null;

alter table public.payment_records
  add column if not exists deleted_at timestamptz default null;

-- 为软删除字段添加部分索引（只索引未删除的记录）
create index if not exists idx_subscriptions_deleted_at
  on public.subscriptions (deleted_at)
  where deleted_at is null;

create index if not exists idx_payment_records_deleted_at
  on public.payment_records (deleted_at)
  where deleted_at is null;

-- ========================================
-- 步骤 6: 修复 8 - 添加审计字段
-- ========================================

alter table public.subscriptions
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

alter table public.payment_records
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id);

-- 创建触发器自动设置 created_by 和 updated_by
create or replace function public.set_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
    new.updated_by = auth.uid();
  elsif tg_op = 'UPDATE' then
    new.updated_by = auth.uid();
    new.created_by = old.created_by;
  end if;
  return new;
end;
$$;

create trigger set_subscriptions_audit_fields
  before insert or update on public.subscriptions
  for each row
  execute function public.set_audit_fields();

create trigger set_payment_records_audit_fields
  before insert or update on public.payment_records
  for each row
  execute function public.set_audit_fields();

-- ========================================
-- 步骤 7: 修复 9 - 添加 webhook 相关字段
-- ========================================

alter table public.payment_records
  add column if not exists webhook_id text,
  add column if not exists webhook_event_type text,
  add column if not exists raw_webhook_data jsonb;

-- 为 webhook_id 添加部分索引
create index if not exists idx_payment_records_webhook_id
  on public.payment_records (webhook_id)
  where webhook_id is not null;

-- ========================================
-- 步骤 8: 添加表和列注释
-- ========================================

comment on table public.subscriptions is 'User subscription records from Lemon Squeezy. Tracks subscription status, tier, and billing periods.';
comment on table public.payment_records is 'Payment transaction records from Lemon Squeezy. Includes webhook data for audit trail.';

comment on column public.subscriptions.user_id is 'Reference to auth.users.id';
comment on column public.subscriptions.lemon_squeezy_subscription_id is 'Unique subscription ID from Lemon Squeezy';
comment on column public.subscriptions.deleted_at is 'Soft delete timestamp. NULL means active record.';
comment on column public.subscriptions.created_by is 'User who created this record';
comment on column public.subscriptions.updated_by is 'User who last updated this record';

comment on column public.payment_records.user_id is 'Reference to auth.users.id';
comment on column public.payment_records.lemon_squeezy_order_id is 'Unique order ID from Lemon Squeezy';
comment on column public.payment_records.webhook_id is 'Webhook event ID from Lemon Squeezy';
comment on column public.payment_records.webhook_event_type is 'Type of webhook event (e.g., order_created, subscription_payment_success)';
comment on column public.payment_records.raw_webhook_data is 'Complete webhook payload for debugging and audit';
comment on column public.payment_records.deleted_at is 'Soft delete timestamp. NULL means active record.';
comment on column public.payment_records.created_by is 'User who created this record';
comment on column public.payment_records.updated_by is 'User who last updated this record';
