/**
 * 分享功能 tRPC 路由
 * @module routers/share
 */

import { z } from 'zod'
import { publicProcedure, router } from '../trpc'
import { createClient } from '@supabase/supabase-js'

/**
 * 生成 8 位随机短链接代码
 */
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 分享路由
 */

/**
 * 双重查询策略搜索 profiles
 * 方法1：OR 条件；方法2：分别按 name 和 email 查询后合并去重
 */
async function searchProfiles(
  supabase: any,
  query: string,
  currentUserId: string
): Promise<{ users: any[] | null; searchError: any }> {
  let users: any[] | null = null
  let searchError: any = null

  try {
    const result = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
      .neq('id', currentUserId)
      .limit(10)
    users = result.data
    searchError = result.error
  } catch (err) {
    console.error('❌ 查询异常:', err)
    searchError = err
  }

  if (!users || users.length === 0) {
    console.log('🔄 尝试备用查询方法...')
    try {
      const nameResult = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .ilike('name', `%${query}%`)
        .neq('id', currentUserId)
        .limit(10)
      const emailResult = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .ilike('email', `%${query}%`)
        .neq('id', currentUserId)
        .limit(10)
      const nameUsers = nameResult.data || []
      const emailUsers = emailResult.data || []
      const allUsers = [...nameUsers, ...emailUsers]
      users = Array.from(new Map(allUsers.map(u => [u.id, u])).values())
      searchError = nameResult.error || emailResult.error
      console.log('✅ 备用查询结果:', {
        nameMatches: nameUsers.length,
        emailMatches: emailUsers.length,
        totalUnique: users.length
      })
    } catch (err) {
      console.error('❌ 备用查询异常:', err)
    }
  }

  return { users, searchError }
}

export const shareRouter = router({
  /**
   * 创建链接分享
   */
  createLinkShare: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(), // 分享描述（可选，最多 1000 字符）
        bookmarks: z
          .array(
            z.object({
              title: z.string(),
              url: z.string().url(),
              description: z.string().optional()
            })
          )
          .min(1)
          .max(500), // 最多 500 个书签（性能考虑）
        showUsername: z.boolean().default(true), // 是否显示用户名（默认显示）
        accessToken: z.string() // Supabase Access Token
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { title, description, bookmarks, showUsername, accessToken } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 生成短链接代码（确保唯一）
      let shortCode = generateShortCode()
      let attempts = 0
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('shares')
          .select('id')
          .eq('short_code', shortCode)
          .single()

        if (!existing) break
        shortCode = generateShortCode()
        attempts++
      }

      if (attempts >= 10) {
        throw new Error('生成短链接失败，请重试')
      }

      // 创建分享记录
      const { data: share, error: shareError } = await supabase
        .from('shares')
        .insert({
          user_id: user.id,
          short_code: shortCode,
          title,
          description: description || null,
          bookmark_count: bookmarks.length,
          share_type: 'link',
          show_username: showUsername
        })
        .select()
        .single()

      console.log('[createLinkShare] 创建分享结果:', {
        success: !!share,
        error: shareError?.message,
        shareId: share?.id,
        shortCode: share?.short_code,
        shareType: share?.share_type
      })

      if (shareError) {
        console.error('[createLinkShare] 创建失败:', shareError)
        throw new Error(`创建分享失败: ${shareError.message}`)
      }

      // 保存书签数据
      const { error: bookmarksError } = await supabase.from('shared_bookmarks').insert(
        bookmarks.map((b, i) => ({
          share_id: share.id,
          title: b.title,
          url: b.url,
          description: b.description || null,
          position: i
        }))
      )

      if (bookmarksError) {
        // 回滚：删除分享记录
        await supabase.from('shares').delete().eq('id', share.id)
        throw new Error(`保存书签失败: ${bookmarksError.message}`)
      }

      // 返回分享信息
      return {
        success: true,
        data: {
          shareId: share.id,
          shortCode: share.short_code,
          shareUrl: `${ctx.env.WEBSITE_URL}/s/${share.short_code}`
        }
      }
    }),

  /**
   * 创建直接分享（发送给用户）
   */
  createDirectShare: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(), // 分享描述（可选，最多 1000 字符）
        bookmarks: z
          .array(
            z.object({
              title: z.string(),
              url: z.string().url(),
              description: z.string().optional()
            })
          )
          .min(1)
          .max(500), // 最多 500 个书签（性能考虑）
        recipientIds: z.array(z.string().uuid()).min(1).max(50), // 最多发送给 50 个用户
        message: z.string().max(500).optional(), // 留言最多 500 字符
        showUsername: z.boolean().default(true), // 是否显示用户名（默认显示）
        accessToken: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { title, description, bookmarks, recipientIds, message, showUsername, accessToken } =
        input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 生成短链接代码（确保唯一）
      let shortCode = generateShortCode()
      let attempts = 0
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('shares')
          .select('id')
          .eq('short_code', shortCode)
          .single()

        if (!existing) break
        shortCode = generateShortCode()
        attempts++
      }

      if (attempts >= 10) {
        throw new Error('生成短链接失败，请重试')
      }

      // 创建分享记录（直接分享也生成短链接，方便接收方访问）
      const { data: share, error: shareError } = await supabase
        .from('shares')
        .insert({
          user_id: user.id,
          short_code: shortCode, // 直接分享也生成短链接
          title,
          description: description || null,
          bookmark_count: bookmarks.length,
          share_type: 'direct',
          show_username: showUsername
        })
        .select()
        .single()

      if (shareError) {
        throw new Error(`创建分享失败: ${shareError.message}`)
      }

      // 保存书签数据
      const { error: bookmarksError } = await supabase.from('shared_bookmarks').insert(
        bookmarks.map((b, i) => ({
          share_id: share.id,
          title: b.title,
          url: b.url,
          description: b.description || null,
          position: i
        }))
      )

      if (bookmarksError) {
        await supabase.from('shares').delete().eq('id', share.id)
        throw new Error(`保存书签失败: ${bookmarksError.message}`)
      }

      // 创建直接分享记录（批量）
      const { error: directShareError } = await supabase.from('direct_shares').insert(
        recipientIds.map(recipientId => ({
          share_id: share.id,
          sender_id: user.id,
          recipient_id: recipientId,
          message: message || null
        }))
      )

      if (directShareError) {
        await supabase.from('shares').delete().eq('id', share.id)
        throw new Error(`创建直接分享失败: ${directShareError.message}`)
      }

      // 发送通知给接收者（批量）
      const { error: notificationError } = await supabase.from('notifications').insert(
        recipientIds.map(recipientId => ({
          user_id: recipientId,
          type: 'share_received',
          title: '收到书签分享',
          message: `${user.user_metadata?.name || user.email} 分享了 ${bookmarks.length} 个书签给你`,
          data: {
            share_id: share.id,
            short_code: share.short_code,
            share_url: `${ctx.env.WEBSITE_URL}/s/${share.short_code}`,
            sender_id: user.id,
            sender_name: user.user_metadata?.name || user.email
          }
        }))
      )

      if (notificationError) {
        console.error('发送通知失败:', notificationError)
        // 不回滚，通知失败不影响分享创建
      }

      return {
        success: true,
        data: {
          shareId: share.id,
          shortCode: share.short_code,
          shareUrl: `${ctx.env.WEBSITE_URL}/s/${share.short_code}`,
          recipientCount: recipientIds.length
        }
      }
    }),

  /**
   * 获取分享详情（通过短链接代码）
   */
  getShareByCode: publicProcedure
    .input(
      z.object({
        shortCode: z.string().min(6).max(10) // 允许 6-10 位字符（兼容测试数据）
      })
    )
    .query(async ({ input, ctx }) => {
      const { shortCode } = input

      console.log('[getShareByCode] 开始查询:', { shortCode })

      // 创建 Supabase 客户端（匿名访问）
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '')

      // 先查询分享记录（不包含 profiles）
      const { data: share, error: shareError } = await supabase
        .from('shares')
        .select('*')
        .eq('short_code', shortCode)
        .single()

      console.log('[getShareByCode] 分享查询结果:', {
        found: !!share,
        error: shareError?.message,
        shareId: share?.id,
        shareType: share?.share_type
      })

      if (shareError || !share) {
        console.error('[getShareByCode] 查询失败:', shareError)
        throw new Error('分享不存在或已过期')
      }

      // 如果需要显示用户名，再查询 profiles
      let profiles: { name: any; email: any; avatar_url: any } | null = null
      if (share.show_username) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, email, avatar_url')
          .eq('id', share.user_id)
          .single()

        profiles = profileData
      }

      // 如果是直接分享，查询发送者信息（无论 show_username 设置如何）
      let senderInfo: { name: any; email: any; avatar_url: any } | null = null
      if (share.share_type === 'direct') {
        const { data: senderData } = await supabase
          .from('profiles')
          .select('name, email, avatar_url')
          .eq('id', share.user_id)
          .single()

        senderInfo = senderData
      }

      // 查询书签数据
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('shared_bookmarks')
        .select('*')
        .eq('share_id', share.id)
        .order('position', { ascending: true })

      if (bookmarksError) {
        throw new Error(`获取书签失败: ${bookmarksError.message}`)
      }

      // 增加访问次数
      await supabase.rpc('increment_share_view_count', {
        share_id_param: share.id
      })

      return {
        success: true,
        data: {
          share: {
            ...share,
            profiles, // 添加 profiles 数据（用于链接分享显示用户名）
            sender: senderInfo // 添加发送者信息（用于直接分享）
          },
          bookmarks
        }
      }
    }),

  /**
   * 搜索用户（用于直接分享）
   */
  searchUsers: publicProcedure
    .input(
      z.object({
        query: z.string().min(2).max(100),
        accessToken: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { query, accessToken } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 搜索用户（从 profiles 表），使用双重查询策略
      const { users, searchError } = await searchProfiles(supabase, query, user.id)

      // 🔍 详细调试日志
      console.log('🔍 搜索用户详情:', {
        query,
        currentUserId: user.id,
        currentUserEmail: user.email,
        searchQuery: `name.ilike.%${query}%,email.ilike.%${query}%`,
        foundUsers: users?.length || 0,
        users: users?.map(u => ({ id: u.id, name: u.name, email: u.email })),
        error: searchError?.message,
        errorDetails: searchError
      })

      if (searchError) {
        console.error('❌ 搜索用户错误:', searchError)
        throw new Error(`搜索用户失败: ${searchError.message}`)
      }

      return {
        success: true,
        data: users || []
      }
    }),

  /**
   * 获取我的分享列表
   */
  getMyShares: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0)
      })
    )
    .query(async ({ input, ctx }) => {
      const { accessToken, limit, offset } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 查询分享列表
      const { data: shares, error: sharesError } = await supabase
        .from('shares')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (sharesError) {
        throw new Error(`获取分享列表失败: ${sharesError.message}`)
      }

      return {
        success: true,
        data: shares || []
      }
    }),

  /**
   * 获取收到的分享列表
   */
  getReceivedShares: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        status: z.enum(['pending', 'accepted', 'rejected']).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0)
      })
    )
    .query(async ({ input, ctx }) => {
      const { accessToken, status, limit, offset } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 构建查询
      let query = supabase
        .from('direct_shares')
        .select('*, shares(*)')
        .eq('recipient_id', user.id)
        .order('sent_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data: directShares, error: sharesError } = await query.range(
        offset,
        offset + limit - 1
      )

      if (sharesError) {
        throw new Error(`获取收到的分享失败: ${sharesError.message}`)
      }

      return {
        success: true,
        data: directShares || []
      }
    }),

  /**
   * 获取用户通知列表
   */
  getNotifications: publicProcedure
    .input(
      z.object({
        accessToken: z.string(),
        unreadOnly: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0)
      })
    )
    .query(async ({ input, ctx }) => {
      const { accessToken, unreadOnly, limit, offset } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 构建查询
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (unreadOnly) {
        query = query.eq('is_read', false)
      }

      const { data: notifications, error: notificationsError } = await query.range(
        offset,
        offset + limit - 1
      )

      if (notificationsError) {
        throw new Error(`获取通知失败: ${notificationsError.message}`)
      }

      return {
        success: true,
        data: notifications || []
      }
    }),

  /**
   * 标记通知为已读
   */
  markNotificationAsRead: publicProcedure
    .input(
      z.object({
        notificationId: z.string().uuid(),
        accessToken: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { notificationId, accessToken } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 更新通知状态
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(`标记通知失败: ${updateError.message}`)
      }

      return {
        success: true
      }
    }),

  /**
   * 获取未读通知数量
   */
  getUnreadCount: publicProcedure
    .input(
      z.object({
        accessToken: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      const { accessToken } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 查询未读数量
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (countError) {
        throw new Error(`获取未读数量失败: ${countError.message}`)
      }

      return {
        success: true,
        data: {
          count: count || 0
        }
      }
    }),

  /**
   * 导入分享的书签
   */
  importShare: publicProcedure
    .input(
      z.object({
        shareId: z.string().uuid(),
        targetFolderId: z.string(), // Chrome 书签文件夹 ID
        accessToken: z.string()
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { shareId, targetFolderId, accessToken } = input

      // 创建 Supabase 客户端
      const supabase = createClient(ctx.env.SUPABASE_URL || '', ctx.env.SUPABASE_ANON_KEY || '', {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      })

      // 验证用户
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('未授权：请先登录')
      }

      // 查询分享的书签
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('shared_bookmarks')
        .select('*')
        .eq('share_id', shareId)
        .order('position', { ascending: true })

      if (bookmarksError || !bookmarks) {
        throw new Error('获取分享书签失败')
      }

      // 记录导入历史
      const { error: historyError } = await supabase.from('import_history').insert({
        user_id: user.id,
        share_id: shareId,
        bookmark_count: bookmarks.length
      })

      if (historyError) {
        console.error('记录导入历史失败:', historyError)
      }

      // 更新直接分享状态（如果是直接分享）
      await supabase
        .from('direct_shares')
        .update({
          status: 'accepted',
          imported_at: new Date().toISOString()
        })
        .eq('share_id', shareId)
        .eq('recipient_id', user.id)

      // 返回书签数据，由前端调用 Chrome API 导入
      return {
        success: true,
        data: {
          bookmarks: bookmarks.map(b => ({
            title: b.title,
            url: b.url,
            description: b.description
          })),
          targetFolderId
        }
      }
    })
})
