-- 简化分享表结构
-- 移除不需要的字段，只保留有价值的数据

-- =====================================================
-- 1. 先删除依赖 is_public 字段的 RLS 策略
-- =====================================================

-- 删除 shares 表的旧 RLS 策略
DROP POLICY IF EXISTS "Anyone can view public shares by short_code" ON public.shares;

-- 删除 shared_bookmarks 表的旧 RLS 策略
DROP POLICY IF EXISTS "Anyone can view bookmarks from public shares" ON public.shared_bookmarks;

-- =====================================================
-- 2. 移除 shares 表的冗余字段
-- =====================================================

-- 移除 is_public 字段（链接分享默认公开，直接分享默认私密，可以通过 share_type 判断）
ALTER TABLE public.shares DROP COLUMN IF EXISTS is_public;

-- 移除 expires_at 字段（暂时不需要过期功能）
ALTER TABLE public.shares DROP COLUMN IF EXISTS expires_at;

-- 移除 updated_at 字段（分享创建后不会修改）
ALTER TABLE public.shares DROP COLUMN IF EXISTS updated_at;

-- 添加 import_count 字段（导入次数统计）
ALTER TABLE public.shares ADD COLUMN IF NOT EXISTS import_count INTEGER DEFAULT 0 CHECK (import_count >= 0);

-- 更新注释
COMMENT ON COLUMN public.shares.import_count IS '导入次数统计';

-- =====================================================
-- 3. 创建新的 RLS 策略
-- =====================================================

-- 创建新的 RLS 策略：任何人可以通过短链接访问链接分享
CREATE POLICY "Anyone can view link shares by short_code"
  ON public.shares FOR SELECT
  USING (share_type = 'link' AND short_code IS NOT NULL);

-- 创建新的 RLS 策略：任何人可以查看链接分享的书签
CREATE POLICY "Anyone can view bookmarks from link shares"
  ON public.shared_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shares
      WHERE shares.id = shared_bookmarks.share_id
      AND shares.share_type = 'link'
    )
  );

-- =====================================================
-- 4. 删除 update_shares_updated_at 触发器
-- =====================================================

DROP TRIGGER IF EXISTS update_shares_updated_at ON public.shares;

-- =====================================================
-- 5. 添加增加导入次数的函数
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_share_import_count(share_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.shares
  SET import_count = import_count + 1
  WHERE id = share_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.increment_share_import_count IS '增加分享的导入次数';

-- 授权：允许 authenticated 用户调用
GRANT EXECUTE ON FUNCTION public.increment_share_import_count TO authenticated;
