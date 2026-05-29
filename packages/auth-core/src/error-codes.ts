/**
 * Supabase 认证错误码到用户友好消息的映射
 */

export interface ErrorCodeMap {
  [key: string]: string
}

/**
 * Supabase 认证错误码映射
 */
export const SUPABASE_ERROR_CODES: ErrorCodeMap = {
  // 邮箱相关
  email_address_invalid: '邮箱地址无效，请检查后重试',
  email_address_not_authorized: '该邮箱未授权，请联系管理员',
  email_already_registered: '该邮箱已被注册，请直接登录或使用其他邮箱',
  email_exists: '该邮箱已被注册，请直接登录或使用其他邮箱',
  email_not_confirmed: '请先验证邮箱。请检查您的邮箱并点击验证链接完成注册后才能登录',
  email_not_verified: '请先验证邮箱。请检查您的邮箱并点击验证链接完成注册后才能登录',
  email_rate_limit_exceeded: '发送邮件过于频繁，请稍后再试（建议等待 15-60 分钟后重试）',
  over_email_send_rate_limit: '发送邮件过于频繁，请稍后再试（建议等待 15-60 分钟后重试）',

  // 密码相关
  weak_password: '密码不符合安全要求，必须至少8位，包含字母和数字',
  password_too_short: '密码长度不足，必须至少8位',
  password_requires_uppercase: '密码必须包含至少一个大写字母',
  password_requires_lowercase: '密码必须包含至少一个小写字母',
  password_requires_number: '密码必须包含至少一个数字',
  password_requires_special: '密码必须包含至少一个特殊字符',
  invalid_password: '密码格式不正确',

  // 登录相关
  invalid_credentials: '邮箱或密码错误，请检查后重试',
  invalid_email: '邮箱格式不正确',
  invalid_email_or_password: '邮箱或密码错误，请检查后重试',
  user_not_found: '用户不存在，请先注册',
  user_not_authorized: '用户未授权，请联系管理员',

  // Token 相关
  invalid_token: '令牌无效，请重新登录',
  expired_token: '令牌已过期，请重新登录',
  invalid_refresh_token: '刷新令牌无效，请重新登录',
  expired_refresh_token: '刷新令牌已过期，请重新登录',

  // OAuth 相关
  oauth_provider_error: 'OAuth 登录失败，请稍后重试',
  oauth_state_mismatch: 'OAuth 状态不匹配，请重试',
  oauth_provider_unavailable: 'OAuth 服务提供商暂时不可用，请稍后重试',

  // 请求限制
  too_many_requests: '请求过于频繁，请稍后再试',
  rate_limit_exceeded: '操作过于频繁，请稍后再试',

  // 会话相关
  session_not_found: '会话不存在，请重新登录',
  session_expired: '会话已过期，请重新登录',

  // 通用错误
  network_error: '网络连接失败，请检查网络后重试',
  server_error: '服务器错误，请稍后重试',
  unknown_error: '发生未知错误，请稍后重试'
}

/**
 * 从错误对象中提取错误码
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (!error) return undefined

  // 类型守卫：确保 error 是对象
  if (typeof error !== 'object') return undefined

  const errorObj = error as Record<string, unknown>

  // 尝试多种方式提取错误码
  return (
    (errorObj.error_code as string | undefined) ||
    (errorObj.errorCode as string | undefined) ||
    (errorObj.code as string | undefined) ||
    ((errorObj.error as Record<string, unknown> | undefined)?.code as string | undefined) ||
    (errorObj.error_description as string | undefined) ||
    (typeof errorObj.message === 'string'
      ? errorObj.message.match(/error_code:\s*(\w+)/)?.[1]
      : undefined)
  )
}

/**
 * 获取用户友好的错误消息
 */
export function getErrorMessage(
  errorCodeOrError: string | unknown | undefined,
  defaultMessage: string = '操作失败，请稍后重试'
): string {
  if (!errorCodeOrError) {
    return defaultMessage
  }

  // 如果传入的是错误对象，先提取错误码
  const errorCode =
    typeof errorCodeOrError === 'string' ? errorCodeOrError : extractErrorCode(errorCodeOrError)

  if (!errorCode) {
    return defaultMessage
  }

  // 查找映射
  const normalizedCode = errorCode.toLowerCase()
  return SUPABASE_ERROR_CODES[normalizedCode] || defaultMessage
}
