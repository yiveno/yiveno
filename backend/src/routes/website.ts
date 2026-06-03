import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { createSupabaseClient } from '../data-access/supabase'

export const websiteRouter = new Hono<{ Bindings: Env }>()

function supabaseHeaders(env: Env): Record<string, string> {
  const key = env.SUPABASE_ANON_KEY ?? ''
  return { apikey: key, Authorization: `Bearer ${key}` }
}

const ShareRecordSchema = z.object({
  id: z.string(),
  short_code: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  bookmark_count: z.number().nullable(),
  show_username: z.boolean().nullable(),
  created_at: z.string().nullable()
})

const SharedBookmarkSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  position: z.number().nullable()
})

const ShareRecordArraySchema = z.array(ShareRecordSchema)
const SharedBookmarkArraySchema = z.array(SharedBookmarkSchema)

websiteRouter.get('/debug', async c => {
  const SUPABASE_URL = c.env.SUPABASE_URL ?? 'not set'
  const SUPABASE_ANON_KEY = (c.env.SUPABASE_ANON_KEY || 'not set').substring(0, 20)
  const WEBSITE_URL = c.env.WEBSITE_URL ?? 'not set'
  return c.json({ SUPABASE_URL, SUPABASE_ANON_KEY, WEBSITE_URL })
})

/** GET /api/website/share/:shortCode — 分享详情（含书签列表） */
websiteRouter.get('/share/:shortCode', async c => {
  try {
    const shortCode = c.req.param('shortCode')
    const baseUrl = c.env.SUPABASE_URL ?? 'https://ugxgxytykxblctsyulsg.supabase.co'
    const headers = supabaseHeaders(c.env)

    // 查询分享记录
    const shareRes = await fetch(
      `${baseUrl}/rest/v1/shares?short_code=eq.${encodeURIComponent(shortCode)}&select=*`,
      { headers }
    )
    if (!shareRes.ok) {
      const body = await shareRes.text()
      return c.json({ error: '查询失败', detail: body.substring(0, 200) }, 500)
    }
    const shareResult = ShareRecordArraySchema.safeParse(await shareRes.json())
    if (!shareResult.success) {
      console.error('[website/share] 分享数据格式错误:', shareResult.error)
      return c.json({ error: '分享数据格式错误' }, 500)
    }
    const share = shareResult.data.at(0)
    if (!share) {
      return c.json({ error: '分享不存在或已过期' }, 404)
    }

    // 查询书签列表
    const bmRes = await fetch(
      `${baseUrl}/rest/v1/shared_bookmarks?share_id=eq.${share.id}&select=title,url,description,position&order=position.asc`,
      { headers }
    )
    if (!bmRes.ok) {
      const body = await bmRes.text()
      console.error('[website/share] 书签查询失败:', body)
      return c.json({ error: '查询书签失败', detail: body.substring(0, 200) }, 500)
    }

    const bookmarkResult = SharedBookmarkArraySchema.safeParse(await bmRes.json())
    if (!bookmarkResult.success) {
      console.error('[website/share] 书签数据格式错误:', bookmarkResult.error)
      return c.json({ error: '书签数据格式错误' }, 500)
    }
    const bookmarks = bookmarkResult.data

    return c.json({
      short_code: share.short_code,
      title: share.title ?? '',
      description: share.description ?? '',
      bookmark_count: share.bookmark_count ?? bookmarks.length,
      show_username: share.show_username,
      created_at: share.created_at,
      bookmarks
    })
  } catch (err) {
    console.error('[website/share] error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

/** GET /api/website/subscription?userId=xxx — 查询用户订阅状态 */
websiteRouter.get('/subscription', async c => {
  try {
    const userId = c.req.query('userId')
    if (!userId) return c.json({ error: '缺少 userId 参数' }, 400)

    const supabase = createSupabaseClient(c.env)
    if (!supabase) return c.json({ error: '数据库未配置' }, 500)

    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier, status, current_period_start, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('current_period_end', new Date().toISOString())
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[website/subscription] 查询失败:', error)
      return c.json({ error: '查询订阅失败' }, 500)
    }

    if (!data) return c.json({ tier: 'free', status: 'inactive' })

    return c.json({
      tier: data.tier || 'free',
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end
    })
  } catch (err) {
    console.error('[website/subscription] error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})
