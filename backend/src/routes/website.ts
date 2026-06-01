import { Hono } from 'hono'
import type { Env } from '../types/env'

export const websiteRouter = new Hono<{ Bindings: Env }>()

/** GET /api/website/debug — 调试环境变量 */
websiteRouter.get('/debug', async c => {
  const SUPABASE_URL = (c.env as any)["SUPABASE_URL"] ?? 'not set'
  const SUPABASE_ANON_KEY = (c.env.SUPABASE_ANON_KEY || 'not set').substring(0, 20)
  const WEBSITE_URL = (c.env as any)["WEBSITE_URL"] ?? 'not set'
  return c.json({ SUPABASE_URL, SUPABASE_ANON_KEY, WEBSITE_URL })
})

/** GET /api/website/share/:shortCode — 分享短链接查看 */
websiteRouter.get('/share/:shortCode', async c => {
  try {
    const shortCode = c.req.param('shortCode')
    const SUPABASE_URL = (c.env as any)["SUPABASE_URL"] ?? 'https://ugxgxytykxblctsyulsg.supabase.co'
    const SUPABASE_ANON_KEY = (c.env as any)["SUPABASE_ANON_KEY"] ?? ''
    const WEBSITE_URL = (c.env as any)["WEBSITE_URL"] ?? 'https://ottersage.com'

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shares?short_code=eq.${encodeURIComponent(shortCode)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    )

    if (!res.ok) {
      const body = await res.text()
      console.error('[website/share] Supabase error:', res.status, body)
      return c.json({ error: '查询失败', detail: body.substring(0, 200) }, 500)
    }

    const data = await res.json() as any[]
    if (!data || data.length === 0) {
      return c.json({ error: '分享不存在或已过期' }, 404)
    }

    const share = data[0]
    return c.json({
      short_code: share.short_code,
      share_url: `${WEBSITE_URL}/share?code=${share.short_code}`,
      title: share.title ?? '',
      url: (share.url || share.content) ?? '',
      created_at: share.created_at
    })
  } catch (err) {
    console.error('[website/share] error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})
