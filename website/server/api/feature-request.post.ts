/**
 * 新功能预约 API
 * POST /api/feature-request
 */
import { checkRateLimit, getClientIP } from '../utils/rateLimiter'
import { isBotSubmission } from '../utils/honeypot'

export default defineEventHandler(async event => {
  assertMethod(event, 'POST')

  try {
    const body = await readBody(event)

    // 🔒 Rate Limiting 防护
    const clientIP = getClientIP(event)
    const rateLimit = checkRateLimit(clientIP)
    if (!rateLimit.allowed) {
      throw createError({
        statusCode: 429,
        statusMessage: `请求过于频繁，请 ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} 秒后再试`
      })
    }

    // 🍯 Honeypot 防护（检测机器人）
    if (isBotSubmission(body)) {
      // 静默拒绝，不返回错误信息（避免被识别）
      return {
        success: true,
        message: '感谢您的建议！我们会认真考虑您的需求。'
      }
    }

    // 验证必填字段
    if (!body.email || !body.feature) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少必填字段：email, feature'
      })
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      throw createError({
        statusCode: 400,
        statusMessage: '邮箱格式不正确'
      })
    }

    // TODO: 保存到数据库或发送通知
    // 示例：保存到 Supabase
    // const { data, error } = await supabase
    //   .from('feature_requests')
    //   .insert({
    //     email: body.email,
    //     feature: body.feature,
    //     description: body.description || '',
    //     created_at: new Date().toISOString()
    //   })

    return {
      success: true,
      message: '感谢您的建议！我们会认真考虑您的需求。'
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || '服务器错误'
    })
  }
})
