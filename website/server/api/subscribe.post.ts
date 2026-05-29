import { checkRateLimit, getClientIP } from '../utils/rateLimiter'

export default defineEventHandler(async event => {
  assertMethod(event, 'POST')

  try {
    const body = await readBody<{
      email?: string
      source?: string
      channel?: string
    }>(event)

    const clientIP = getClientIP(event)
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      throw createError({
        statusCode: 429,
        statusMessage: `操作过于频繁，请 ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} 秒后重试`
      })
    }

    if (!body.email) {
      throw createError({ statusCode: 400, statusMessage: '缺少邮箱字段' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      throw createError({ statusCode: 400, statusMessage: '邮箱格式不正确' })
    }

    // 📌 TODO: 在此集成邮件营销平台（如 Buttondown、Mailchimp 等）
    console.info('[Subscribe] 新订阅:', {
      email: body.email,
      source: body.source || 'website',
      channel: body.channel || 'newsletter'
    })

    return {
      success: true,
      message: '订阅成功，我们将定期发送产品更新给您！'
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || '服务器错误'
    })
  }
})
