// Gumroad 客户端工具

import { API_CONFIG } from '@/config/constants'
import { frontendEnv } from '@/config/env'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'

export interface GumroadSubscriptionPayload {
  success: boolean
  hasSubscription: boolean // ✅ 新增：明确标志位
  subscription?: {
    id: string | null
    status: string
    tier: 'free' | 'pro'
    current_period_end: string
    cancel_at_period_end: boolean
  }
  error?: string
}

export type GumroadBillingFrequency = 'monthly' | 'yearly'

export const GUMROAD_CONFIG = {
  productUrl: frontendEnv.gumroadProductUrl,
  manageUrl: frontendEnv.gumroadManageUrl
} as const

/**
 * 构建 Gumroad 结账链接
 */
export function buildCheckoutUrl(
  billingFrequency: GumroadBillingFrequency,
  userId: string,
  email: string,
  tier: 'pro' | 'free' = 'pro'
): string {
  if (!GUMROAD_CONFIG.productUrl) {
    throw new Error('Gumroad 产品链接未配置')
  }

  const url = new URL(GUMROAD_CONFIG.productUrl)
  url.searchParams.set('wanted', 'true')
  url.searchParams.set('monthly', billingFrequency === 'monthly' ? 'true' : 'false')
  url.searchParams.set('yearly', billingFrequency === 'yearly' ? 'true' : 'false')

  if (email) {
    url.searchParams.set('email', email)
  }

  url.searchParams.set('custom_fields[user_id]', userId)
  url.searchParams.set('custom_fields[tier]', tier)

  return url.toString()
}

/**
 * 获取 Gumroad 订阅管理地址
 */
export function getManageSubscriptionUrl(): string {
  return GUMROAD_CONFIG.manageUrl
}

/**
 * 查询当前用户订阅状态
 */
export async function getSubscriptionStatus(userId: string) {
  const apiBase = API_CONFIG.API_BASE
  const url = `${apiBase}/api/gumroad/subscription?user_id=${encodeURIComponent(userId)}`

  const response = await safeJsonFetch<GumroadSubscriptionPayload>(url, 5000, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response || !response.success) {
    throw new Error(response?.error || '查询订阅状态失败')
  }

  // ✅ 改进：使用 hasSubscription 标志位，更清晰
  if (!response.hasSubscription || !response.subscription) {
    return null
  }

  return response.subscription
}
