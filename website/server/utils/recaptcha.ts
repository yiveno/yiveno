/**
 * reCAPTCHA v3 验证工具（可选）
 * 如果将来需要更强的防护，可以使用此工具
 */

interface RecaptchaResponse {
  success: boolean
  score?: number
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * 验证 reCAPTCHA token
 * @param token reCAPTCHA token
 * @param secretKey 服务器端密钥
 * @returns 验证结果
 */
export async function verifyRecaptcha(
  token: string,
  secretKey: string
): Promise<{ success: boolean; score?: number; error?: string }> {
  try {
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${secretKey}&response=${token}`
    })

    const data: RecaptchaResponse = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || '验证失败'
      }
    }

    // reCAPTCHA v3 返回分数（0.0 - 1.0），分数越低越可能是机器人
    // 通常 0.5 以上认为是人类
    return {
      success: true,
      score: data.score
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    }
  }
}
