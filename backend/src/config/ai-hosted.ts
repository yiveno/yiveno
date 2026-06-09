/**
 * Pro 托管 LLM 服务端配置
 *
 * 配额与模型由服务端控制，前端仅展示。
 */

/** 默认托管模型 */
export const AI_HOSTED_DEFAULT_MODEL = 'deepseek-v4-flash'

/** 默认每月调用次数上限 */
export const AI_HOSTED_DEFAULT_MONTHLY_QUOTA = 999

/** DeepSeek API 默认 Base URL */
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com'

/**
 * 解析托管 LLM 每月配额上限
 */
export function resolveHostedMonthlyQuota(env: { AI_HOSTED_MONTHLY_QUOTA?: string }): number {
  const parsed = Number.parseInt(env.AI_HOSTED_MONTHLY_QUOTA ?? '', 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return AI_HOSTED_DEFAULT_MONTHLY_QUOTA
}

/**
 * 解析托管 LLM 模型名称
 */
export function resolveHostedModel(env: { AI_HOSTED_MODEL?: string }): string {
  const model = env.AI_HOSTED_MODEL?.trim()
  return model || AI_HOSTED_DEFAULT_MODEL
}

/**
 * 生成当月配额 KV Key（UTC 月）
 */
export function buildMonthlyUsageKey(userId: string, date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `ai_usage:${userId}:${year}-${month}`
}
