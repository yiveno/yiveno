/**
 * 官网付费档位（仅 Pro）。
 * Free 在 PricingPage 本地写死展示。
 * 改 Pro 文案 / 锚点价只改这里。
 */

export interface Tier {
  name: 'Pro'
  description: string
  features: string[]
  displayUsd: { month: string; year: string }
  planId: { month: 'pro_monthly'; year: 'pro_annual' }
}

/** 可售付费档：仅 Pro（产品文档 §A.3）。 */
export function getPaidTiers(): Tier[] {
  return [
    {
      name: 'Pro',
      description:
        'Same find quality as Free, plus sync across devices and a higher limit for cloud help with your clues.',
      features: [
        'Same find quality as Free',
        'Cloud sync across devices',
        'Higher limit for cloud clue help',
        'Higher daily limit for smarter matching in the cloud'
      ],
      displayUsd: { month: '7.99', year: '59.99' },
      planId: { month: 'pro_monthly', year: 'pro_annual' }
    }
  ]
}
