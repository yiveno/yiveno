-- MemoryItem 云端事实源（Phase C 铺路）
-- 形状对齐扩展侧 MemoryItemSchema；扩展经 Worker service role 读写。

CREATE TABLE IF NOT EXISTS public.memory_items (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_local_profile_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bookmark', 'text_excerpt')),
  payload JSONB NOT NULL,
  clues JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  rev BIGINT NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.memory_items IS 'Yiveno Cloud Memory：按账号归属的 MemoryItem 文档';
COMMENT ON COLUMN public.memory_items.owner_id IS '账号 ID（auth.users.id），对应扩展 AccountBinding.accountId';
COMMENT ON COLUMN public.memory_items.source_local_profile_id IS '最初写入时的 LocalProfile id';
COMMENT ON COLUMN public.memory_items.rev IS '版本号，便于后续增量同步';

CREATE INDEX IF NOT EXISTS idx_memory_items_owner_updated
  ON public.memory_items (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_items_owner_type_updated
  ON public.memory_items (owner_id, type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_items_owner_chrome_bookmark
  ON public.memory_items (owner_id, (payload->>'chromeBookmarkId'))
  WHERE type = 'bookmark' AND payload->>'chromeBookmarkId' IS NOT NULL;

ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory items"
  ON public.memory_items FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own memory items"
  ON public.memory_items FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own memory items"
  ON public.memory_items FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own memory items"
  ON public.memory_items FOR DELETE
  USING (auth.uid() = owner_id);

-- replace 前按 owner 备份（表内 JSON；后续可迁 R2）
CREATE TABLE IF NOT EXISTS public.memory_sync_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  item_count INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL
);

COMMENT ON TABLE public.memory_sync_backups IS 'Memory 整侧替换前的快照备份';

CREATE INDEX IF NOT EXISTS idx_memory_sync_backups_owner_created
  ON public.memory_sync_backups (owner_id, created_at DESC);

ALTER TABLE public.memory_sync_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory sync backups"
  ON public.memory_sync_backups FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own memory sync backups"
  ON public.memory_sync_backups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
