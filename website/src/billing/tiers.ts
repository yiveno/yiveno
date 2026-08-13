/**
 * 官网付费档位（仅 Pro）。
 * Free 在 PricingPage 本地写死展示，不走 Paddle。
 * 改 Pro 文案 / Price ID 只改这里。
 */

export interface Tier {
  name: 'Pro'
  description: string
  features: string[]
  priceId: { month: string; year: string }
}

function requirePublicEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[Billing] ${String(name)} is not set`)
  }
  return value.trim()
}

/** 可售付费档：仅 Pro（产品文档 §A.3）。 */
export function getPaidTiers(): Tier[] {
  return [
    {
      name: 'Pro',
      description:
        'Same on-device recall quality as Free, plus cloud sync and a larger hosted clue-understanding quota.',
      features: [
        'Same on-device Hybrid recall as Free',
        'Cloud sync across devices',
        'Larger hosted clue understanding quota',
        'Higher embedding daily cap'
      ],
      priceId: {
        month: requirePublicEnv('PUBLIC_PADDLE_PRICE_PRO_MONTHLY'),
        year: requirePublicEnv('PUBLIC_PADDLE_PRICE_PRO_YEARLY')
      }
    }
  ]
}
