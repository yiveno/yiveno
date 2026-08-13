import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import { listPublicPlans, parseBillingPlanId, resolvePaddlePriceId } from './plans'

function env(overrides: Partial<Env> = {}): Env {
  return {
    BILLING_FOUNDING_ENABLED: 'false',
    PADDLE_PRICE_ID_PRO_MONTHLY: 'pri_monthly',
    PADDLE_PRICE_ID_PRO_ANNUAL: 'pri_annual',
    ...overrides
  } as Env
}

describe('listPublicPlans', () => {
  test('默认只有标准价', () => {
    expect(listPublicPlans(env()).map(plan => plan.id)).toEqual(['pro_monthly', 'pro_annual'])
  })

  test('Founding 打开时追加实验价', () => {
    const ids = listPublicPlans(env({ BILLING_FOUNDING_ENABLED: 'true' })).map(plan => plan.id)
    expect(ids).toContain('founding_monthly')
    expect(ids).toContain('founding_annual')
  })
})

describe('parseBillingPlanId', () => {
  test('未开放 founding → null', () => {
    expect(parseBillingPlanId('founding_monthly', env())).toBeNull()
    expect(parseBillingPlanId('pro_monthly', env())).toBe('pro_monthly')
  })
})

describe('resolvePaddlePriceId', () => {
  test('空 Price ID → null', () => {
    expect(
      resolvePaddlePriceId(env({ PADDLE_PRICE_ID_PRO_MONTHLY: '  ' }), 'pro_monthly')
    ).toBeNull()
    expect(resolvePaddlePriceId(env(), 'pro_monthly')).toBe('pri_monthly')
  })
})
