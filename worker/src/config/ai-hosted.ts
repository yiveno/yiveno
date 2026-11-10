/**
 * 托管 LLM 服务端配置
 *
 * 配额与模型由服务端控制，前端仅展示。
 * DeepSeek 默认经 Cloudflare AI Gateway 转发（观测 / 限流 / 预算）；未配 Gateway 时直连。
 */

/** 默认托管模型 */
export const AI_HOSTED_DEFAULT_MODEL = 'deepseek-v4-flash'

/** 登录 Free：每月 Clue LLM 次数（Normative 起步值） */
export const AI_HOSTED_FREE_MONTHLY_QUOTA = 60

/** Pro：每月 Clue LLM 次数（Normative 起步值） */
export const AI_HOSTED_PRO_MONTHLY_QUOTA = 1000

/** 登录 Free：日软盖 */
export const AI_HOSTED_FREE_DAILY_CAP = 10

/** Pro：日软盖 */
export const AI_HOSTED_PRO_DAILY_CAP = 120

/** DeepSeek API 默认 Base URL（直连回退） */
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Cloudflare AI Gateway 根域名 */
export const AI_GATEWAY_DEFAULT_HOST = 'https://gateway.ai.cloudflare.com'

/** 客户端可请求的 completion max_tokens 硬上限（防刷费用） */
export const AI_MAX_COMPLETION_TOKENS = 1024

export type DeepSeekEndpointEnv = {
  DEEPSEEK_API_BASE?: string
  /** Cloudflare 账户 ID（AI Gateway URL 段） */
  AI_GATEWAY_ACCOUNT_ID?: string
  /** AI Gateway 名称 / id（Dashboard 创建后填入） */
  AI_GATEWAY_ID?: string
}

export type HostedQuotaEnv = {
  AI_HOSTED_MONTHLY_QUOTA?: string // Pro 月配额覆盖
  AI_HOSTED_FREE_MONTHLY_QUOTA?: string // Free 月配额覆盖
  AI_HOSTED_DAILY_CAP?: string // Pro 日盖覆盖
  AI_HOSTED_FREE_DAILY_CAP?: string // Free 日盖覆盖
}

/**
 * 是否已配置 AI Gateway（account + gateway id 均非空）。
 */
export function isDeepSeekAiGatewayEnabled(env: DeepSeekEndpointEnv): boolean {
  return Boolean(env.AI_GATEWAY_ACCOUNT_ID?.trim() && env.AI_GATEWAY_ID?.trim())
}

/**
 * 解析 DeepSeek Chat Completions 完整 URL。
 *
 * - 已配 Gateway：`…/v1/{account}/{gateway}/deepseek/chat/completions`
 * - 否则直连：`{DEEPSEEK_API_BASE}/v1/chat/completions`
 * - 若 `DEEPSEEK_API_BASE` 已是 Gateway provider 根（含 gateway.ai.cloudflare.com），补 `/chat/completions`
 */
export function resolveDeepSeekChatCompletionsUrl(env: DeepSeekEndpointEnv): string {
  const accountId = env.AI_GATEWAY_ACCOUNT_ID?.trim()
  const gatewayId = env.AI_GATEWAY_ID?.trim()
  if (accountId && gatewayId) {
    return `${AI_GATEWAY_DEFAULT_HOST}/v1/${accountId}/${gatewayId}/deepseek/chat/completions`
  }

  const baseUrl = (env.DEEPSEEK_API_BASE?.trim() || DEEPSEEK_DEFAULT_BASE_URL).replace(/\/$/, '')
  if (baseUrl.includes('gateway.ai.cloudflare.com')) {
    if (baseUrl.endsWith('/chat/completions')) return baseUrl
    return `${baseUrl}/chat/completions`
  }
  return `${baseUrl}/v1/chat/completions`
}

/**
 * 将客户端 maxTokens 钳制到合法区间。
 */
export function clampCompletionMaxTokens(requested: number | undefined, fallback: number): number {
  const raw = requested ?? fallback
  if (!Number.isFinite(raw)) return fallback
  return Math.min(AI_MAX_COMPLETION_TOKENS, Math.max(1, Math.floor(raw)))
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

/**
 * 解析托管 LLM 每月配额上限（按是否 Pro 分档）。
 */
export function resolveHostedMonthlyQuota(env: HostedQuotaEnv, isPro: boolean): number {
  if (isPro) {
    return parsePositiveInt(env.AI_HOSTED_MONTHLY_QUOTA, AI_HOSTED_PRO_MONTHLY_QUOTA)
  }
  return parsePositiveInt(env.AI_HOSTED_FREE_MONTHLY_QUOTA, AI_HOSTED_FREE_MONTHLY_QUOTA)
}

/**
 * 解析托管 LLM 日软盖。
 */
export function resolveHostedDailyCap(env: HostedQuotaEnv, isPro: boolean): number {
  if (isPro) {
    return parsePositiveInt(env.AI_HOSTED_DAILY_CAP, AI_HOSTED_PRO_DAILY_CAP)
  }
  return parsePositiveInt(env.AI_HOSTED_FREE_DAILY_CAP, AI_HOSTED_FREE_DAILY_CAP)
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

/**
 * 生成当日软盖 KV Key（UTC 日）
 */
export function buildDailyUsageKey(userId: string, date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `ai_usage_day:${userId}:${year}-${month}-${day}`
}
