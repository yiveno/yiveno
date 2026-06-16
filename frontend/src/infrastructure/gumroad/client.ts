// Gumroad 客户端工具

import { frontendEnv } from '@/config/env'

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
