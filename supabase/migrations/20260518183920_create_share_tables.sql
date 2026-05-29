-- 创建分享功能相关表
-- 支持两种分享方式：
-- 1. 生成链接分享（公开）
-- 2. 直接发送给用户（私密）

-- =====================================================
-- 1. 分享记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_code VARCHAR(10) UNIQUE,  -- 短链接代码（如 abc123），仅链接分享使用
  title TEXT NOT NULL,
  bookmark_count INTEGER NOT NULL CHECK (bookmark_count > 0),
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('link', 'direct')),
  is_public BOOLEAN DEFAULT TRUE,  -- 是否公开（链接分享为 true，直接分享为 false）
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),  -- 访问次数（仅链接分享）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,  -- 可选：分享过期时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_short_code ON public.shares(short_code) WHERE short_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON public.shares(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_share_type ON public.shares(share_type);

-- 注释
COMMENT ON TABLE public.shares IS '分享记录表，支持链接分享和直接分享两种方式';
COMMENT ON COLUMN public.shares.short_code IS '短链接代码，仅链接分享使用，格式如 abc123';
COMMENT ON COLUMN public.shares.share_type IS '分享类型：link（链接分享）或 direct（直接发送）';
COMMENT ON COLUMN public.shares.is_public IS '是否公开：链接分享为 true，直接分享为 false';
COMMENT ON COLUMN public.shares.view_count IS '访问次数，仅链接分享统计';

-- =====================================================
-- 2. 分享的书签数据表
-- =====================================================
CREATE TABLE IF NOT EXISTS public.shared_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),  -- 书签顺序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_shared_bookmarks_share_id ON public.shared_bookmarks(share_id);
CREATE INDEX IF NOT EXISTS idx_shared_bookmarks_position ON public.shared_bookmarks(share_id, position);

-- 注释
COMMENT ON TABLE public.shared_bookmarks IS '分享的书签数据表';
COMMENT ON COLUMN public.shared_bookmarks.position IS '书签在分享中的顺序，从 0 开始';

-- =====================================================
-- 3. 直接分享记录表（用户对用户）
-- =====================================================
CREATE TABLE IF NOT EXISTS public.direct_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,  -- 发送者留言
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,  -- 接收者查看时间
  imported_at TIMESTAMP WITH TIME ZONE,  -- 接收者导入时间
  
  -- 约束：不能发送给自己
  CONSTRAINT check_not_self_share CHECK (sender_id != recipient_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_direct_shares_recipient_id ON public.direct_shares(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_shares_sender_id ON public.direct_shares(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_shares_status ON public.direct_shares(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_direct_shares_sent_at ON public.direct_shares(sent_at DESC);

-- 注释
COMMENT ON TABLE public.direct_shares IS '直接分享记录表，用于用户之间的私密分享';
COMMENT ON COLUMN public.direct_shares.status IS '分享状态：pending（待处理）、accepted（已接受）、rejected（已拒绝）';
COMMENT ON COLUMN public.direct_shares.message IS '发送者给接收者的留言';

-- =====================================================
-- 4. 通知表
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 通知类型：share_received, share_imported, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,  -- 额外数据（如 share_id, sender_id 等）
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE  -- 标记已读时间
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- 注释
COMMENT ON TABLE public.notifications IS '用户通知表';
COMMENT ON COLUMN public.notifications.type IS '通知类型，如 share_received（收到分享）、share_imported（分享已导入）';
COMMENT ON COLUMN public.notifications.data IS '通知相关的额外数据，JSON 格式';

-- =====================================================
-- 5. 导入历史表（可选，用于统计）
-- =====================================================
CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_id UUID NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  bookmark_count INTEGER NOT NULL CHECK (bookmark_count > 0),
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_import_history_user_id ON public.import_history(user_id);
CREATE INDEX IF NOT EXISTS idx_import_history_share_id ON public.import_history(share_id);
CREATE INDEX IF NOT EXISTS idx_import_history_imported_at ON public.import_history(imported_at DESC);

-- 注释
COMMENT ON TABLE public.import_history IS '导入历史表，记录用户导入分享的历史';

-- =====================================================
-- 6. Row Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- shares 表策略
-- 用户可以查看自己创建的分享
CREATE POLICY "Users can view their own shares"
  ON public.shares FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以查看公开的分享（通过短链接访问）
CREATE POLICY "Anyone can view public shares by short_code"
  ON public.shares FOR SELECT
  USING (is_public = TRUE AND short_code IS NOT NULL);

-- 用户可以创建分享
CREATE POLICY "Users can create shares"
  ON public.shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户可以更新自己的分享
CREATE POLICY "Users can update their own shares"
  ON public.shares FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的分享
CREATE POLICY "Users can delete their own shares"
  ON public.shares FOR DELETE
  USING (auth.uid() = user_id);

-- shared_bookmarks 表策略
-- 用户可以查看自己分享的书签
CREATE POLICY "Users can view bookmarks from their shares"
  ON public.shared_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shares
      WHERE shares.id = shared_bookmarks.share_id
      AND shares.user_id = auth.uid()
    )
  );

-- 用户可以查看公开分享的书签
CREATE POLICY "Anyone can view bookmarks from public shares"
  ON public.shared_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shares
      WHERE shares.id = shared_bookmarks.share_id
      AND shares.is_public = TRUE
    )
  );

-- 用户可以插入书签到自己的分享
CREATE POLICY "Users can insert bookmarks to their shares"
  ON public.shared_bookmarks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shares
      WHERE shares.id = shared_bookmarks.share_id
      AND shares.user_id = auth.uid()
    )
  );

-- direct_shares 表策略
-- 发送者可以查看自己发送的分享
CREATE POLICY "Senders can view their sent shares"
  ON public.direct_shares FOR SELECT
  USING (auth.uid() = sender_id);

-- 接收者可以查看发送给自己的分享
CREATE POLICY "Recipients can view shares sent to them"
  ON public.direct_shares FOR SELECT
  USING (auth.uid() = recipient_id);

-- 用户可以创建直接分享
CREATE POLICY "Users can create direct shares"
  ON public.direct_shares FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 接收者可以更新分享状态（接受/拒绝）
CREATE POLICY "Recipients can update share status"
  ON public.direct_shares FOR UPDATE
  USING (auth.uid() = recipient_id);

-- notifications 表策略
-- 用户只能查看自己的通知
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 系统可以创建通知（通过 service_role）
CREATE POLICY "Service role can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 用户可以更新自己的通知（标记已读）
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 用户可以删除自己的通知
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- import_history 表策略
-- 用户可以查看自己的导入历史
CREATE POLICY "Users can view their own import history"
  ON public.import_history FOR SELECT
  USING (auth.uid() = user_id);

-- 用户可以创建导入历史
CREATE POLICY "Users can create import history"
  ON public.import_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 7. 触发器：自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shares_updated_at
  BEFORE UPDATE ON public.shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 8. 触发器：自动标记通知已读时间
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_read_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_read_at();

-- =====================================================
-- 9. 触发器：自动标记直接分享的查看时间
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_direct_share_read_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_direct_shares_read_at
  BEFORE UPDATE ON public.direct_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_direct_share_read_at();

-- =====================================================
-- 10. 函数：生成短链接代码
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_short_code IS '生成 8 位随机短链接代码';

-- =====================================================
-- 11. 函数：增加分享访问次数
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_share_view_count(share_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.shares
  SET view_count = view_count + 1
  WHERE id = share_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_share_view_count IS '增加分享的访问次数（仅链接分享）';

-- 授权：允许 authenticated 用户调用
GRANT EXECUTE ON FUNCTION public.increment_share_view_count TO authenticated;
