/**
 * 官网付费档位（仅 Pro）的价与 plan id。
 * Free / Pro 可见文案走 `website/src/i18n`（`pricing.*`），不在此写死自然语言。
 */

export interface Tier {
  name: 'Pro'
  displayUsd: { month: string; year: string }
  planId: { month: 'pro_monthly'; year: 'pro_annual' }
}

/** 可售付费档：仅 Pro（产品文档 §A.3）。 */
export function getPaidTiers(): Tier[] {
  return [
    {
      name: 'Pro',
      displayUsd: { month: '7.99', year: '59.99' },
      planId: { month: 'pro_monthly', year: 'pro_annual' }
    }
  ]
}
