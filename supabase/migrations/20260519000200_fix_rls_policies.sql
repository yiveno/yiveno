-- 修复 RLS 策略
-- 确保匿名用户可以访问链接分享

-- =====================================================
-- 1. 删除所有可能冲突的旧策略
-- =====================================================

DROP POLICY IF EXISTS "Anyone can view public shares by short_code" ON public.shares;
DROP POLICY IF EXISTS "Anyone can view link shares by short_code" ON public.shares;
DROP POLICY IF EXISTS "Anyone can view bookmarks from public shares" ON public.shared_bookmarks;
DROP POLICY IF EXISTS "Anyone can view bookmarks from link shares" ON public.shared_bookmarks;

-- =====================================================
-- 2. 重新创建正确的 RLS 策略
-- =====================================================

-- 任何人（包括匿名用户）可以查看链接分享
CREATE POLICY "Anyone can view link shares by short_code"
  ON public.shares FOR SELECT
  USING (share_type = 'link' AND short_code IS NOT NULL);

-- 任何人（包括匿名用户）可以查看链接分享的书签
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
-- 3. 验证策略
-- =====================================================

-- 查看当前的 RLS 策略
SELECT 
  tablename, 
  policyname, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename IN ('shares', 'shared_bookmarks')
ORDER BY tablename, policyname;
