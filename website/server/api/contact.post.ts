/**
 * 联系表单提交 API
 * POST /api/contact
 */
import { checkRateLimit, getClientIP } from '../utils/rateLimiter'
import { isBotSubmission } from '../utils/honeypot'

export default defineEventHandler(async event => {
  // 只允许 POST 请求
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
        message: '感谢您的联系，我们会尽快回复您！'
      }
    }

    // 验证必填字段
    if (!body.name || !body.email || !body.message) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少必填字段：name, email, message'
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

    // TODO: 这里可以集成邮件服务（如 SendGrid、Brevo）或保存到数据库
    // 示例：发送邮件通知
    // await sendEmail({
    //   to: 'contact@ottersage.com',
    //   subject: `新联系表单：${body.name}`,
    //   html: `
    //     <h2>新联系表单提交</h2>
    //     <p><strong>姓名：</strong>${body.name}</p>
    //     <p><strong>邮箱：</strong>${body.email}</p>
    //     <p><strong>消息：</strong></p>
    //     <p>${body.message}</p>
    //   `
    // })

    // 返回成功响应
    return {
      success: true,
      message: '感谢您的联系，我们会尽快回复您！'
    }
  } catch (error: unknown) {
    const err = error as { statusCode?: number; statusMessage?: string }
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || '服务器错误'
    })
  }
})
