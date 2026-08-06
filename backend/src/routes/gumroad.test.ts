import { afterEach, describe, expect, jest, test } from 'bun:test'
import { createApp } from '../app'
import { signJWT } from '../utils/jwt'
import type { Env } from '../types/env'
import type { PaymentRecord, Subscription } from '@yiveno/types'
import * as supabaseModule from '../data-access/supabase'

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111'
const TEST_SUB_ID = 'sub_abc12345'
const TEST_SALE_ID = 'sale_order_456'

const baseEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

function saleBody(extra: string[] = []): string {
  return [
    'seller_id=test-seller',
    'notification_type=sale',
    `subscription_id=${TEST_SUB_ID}`,
    `sale_id=${TEST_SALE_ID}`,
    'price=9.99',
    'currency=USD',
    `custom_fields[user_id]=${TEST_USER_ID}`,
    'custom_fields[tier]=pro',
    ...extra
  ].join('&')
}

async function createAuthHeaders() {
  const token = await signJWT(baseEnv.JWT_SECRET, {
    sub: 'google:test-user',
    email: 'test@example.com',
    tier: 'free',
    features: {}
  })

  return {
    Authorization: `Bearer ${token}`
  }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('gumroad routes', () => {
  test('GET /api/gumroad/subscription rejects missing JWT', async () => {
    const app = createApp()
    const response = await app.request('/api/gumroad/subscription', {}, baseEnv)

    expect(response.status).toBe(401)
  })

  test('GET /api/gumroad/subscription uses JWT sub and ignores query user_id', async () => {
    jest.spyOn(supabaseModule, 'getLatestUserSubscriptionRow').mockResolvedValue(null)
    jest.spyOn(supabaseModule, 'getUserSubscription').mockResolvedValue(null)
    const app = createApp()
    const response = await app.request(
      '/api/gumroad/subscription?user_id=attacker-other-user',
      {
        headers: await createAuthHeaders()
      },
      baseEnv
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      data: { hasSubscription: boolean; isPro?: boolean }
    }
    expect(data.success).toBe(true)
    expect(data.data.hasSubscription).toBe(false)
    expect(data.data.isPro).toBe(false)
  })

  test('POST /api/gumroad/webhook accepts request without JWT and rejects invalid seller', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: `seller_id=wrong-seller&subscription_id=${TEST_SUB_ID}&custom_fields[user_id]=${TEST_USER_ID}`
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'expected-seller-id'
      } as Env
    )

    expect(response.status).toBe(401)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Invalid seller_id')
  })

  test('POST /api/gumroad/webhook rejects when GUMROAD_SELLER_ID is missing', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: `seller_id=any&subscription_id=${TEST_SUB_ID}&custom_fields[user_id]=${TEST_USER_ID}`
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: ''
      } as Env
    )

    expect(response.status).toBe(503)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('seller_id_not_configured')
  })

  test('POST /api/gumroad/webhook rejects invalid webhook token when configured', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/gumroad/webhook?token=wrong',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: 'notification_type=sale'
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller',
        GUMROAD_WEBHOOK_TOKEN: 'expected-token'
      } as Env
    )

    expect(response.status).toBe(401)
  })

  test('POST /api/gumroad/webhook ACKs test ping without seller_id', async () => {
    const app = createApp()
    const upsertSpy = jest.spyOn(supabaseModule, 'upsertSubscription')
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: 'notification_type=sale&test=true'
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)
    expect(upsertSpy).not.toHaveBeenCalled()
    const data = (await response.json()) as { success: boolean; skipped?: boolean; reason?: string }
    expect(data.success).toBe(true)
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('missing_seller_id')
  })

  test('POST /api/gumroad/webhook ACKs test ping without subscription_id or user_id', async () => {
    const app = createApp()
    const upsertSpy = jest.spyOn(supabaseModule, 'upsertSubscription')
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: 'seller_id=test-seller&notification_type=sale'
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)
    expect(upsertSpy).not.toHaveBeenCalled()

    const data = (await response.json()) as { success: boolean; skipped?: boolean; reason?: string }
    expect(data.success).toBe(true)
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('missing_subscription_id')
  })

  test('POST /api/gumroad/webhook rejects fake subscription id', async () => {
    const app = createApp()
    const upsertSpy = jest.spyOn(supabaseModule, 'upsertSubscription')
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          'seller_id=test-seller',
          'notification_type=sale',
          'subscription_id=test-gumroad-001',
          `sale_id=${TEST_SALE_ID}`,
          `custom_fields[user_id]=${TEST_USER_ID}`
        ].join('&')
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)
    expect(upsertSpy).not.toHaveBeenCalled()
    const data = (await response.json()) as { skipped?: boolean; reason?: string }
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('fake_subscription_id')
  })

  test('POST /api/gumroad/webhook persists subscription and payment on success', async () => {
    const app = createApp()
    const upsertSpy = jest
      .spyOn(supabaseModule, 'upsertSubscription')
      .mockResolvedValue({ id: 'sub-row-id' } as Subscription)
    const paymentSpy = jest
      .spyOn(supabaseModule, 'insertPaymentRecord')
      .mockResolvedValue({ id: 'payment-row-id' } as PaymentRecord)
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: saleBody()
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(paymentSpy).toHaveBeenCalledTimes(1)

    const subscriptionArgs = upsertSpy.mock.calls[0]?.[1] as Partial<Subscription>
    expect(subscriptionArgs.user_id).toBe(TEST_USER_ID)
    expect(subscriptionArgs.gumroad_subscription_id).toBe(TEST_SUB_ID)
    expect(subscriptionArgs.tier).toBe('pro')
    expect(subscriptionArgs.status).toBe('active')
    expect(subscriptionArgs.verification_status).toBe('verified')
    expect(subscriptionArgs.source).toBe('gumroad_webhook')

    const paymentArgs = paymentSpy.mock.calls[0]?.[1] as Partial<PaymentRecord>
    expect(paymentArgs.user_id).toBe(TEST_USER_ID)
    expect(paymentArgs.gumroad_subscription_id).toBe(TEST_SUB_ID)
    expect(paymentArgs.status).toBe('paid')
    expect(paymentArgs.event_type).toBe('sale')

    const data = (await response.json()) as { success: boolean }
    expect(data.success).toBe(true)
  })

  test('POST /api/gumroad/webhook returns 500 when subscription upsert fails', async () => {
    const app = createApp()

    jest.spyOn(supabaseModule, 'upsertSubscription').mockRejectedValue(new Error('upsert failed'))
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const paymentSpy = jest.spyOn(supabaseModule, 'insertPaymentRecord')

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: saleBody()
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(500)
    expect(paymentSpy).not.toHaveBeenCalled()

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Internal server error')
  })

  test('POST /api/gumroad/webhook returns 500 when payment insert fails', async () => {
    const app = createApp()

    jest
      .spyOn(supabaseModule, 'upsertSubscription')
      .mockResolvedValue({ id: 'sub-row-id' } as Subscription)
    jest.spyOn(supabaseModule, 'insertPaymentRecord').mockRejectedValue(new Error('payment failed'))
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: saleBody()
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('Internal server error')
  })

  test('POST /api/gumroad/webhook marks subscription expired when ended_at exists', async () => {
    const app = createApp()
    const upsertSpy = jest
      .spyOn(supabaseModule, 'upsertSubscription')
      .mockResolvedValue({ id: 'sub-row-id' } as Subscription)
    const paymentSpy = jest
      .spyOn(supabaseModule, 'insertPaymentRecord')
      .mockResolvedValue({ id: 'payment-row-id' } as PaymentRecord)
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          'seller_id=test-seller',
          'notification_type=subscription_cancelled',
          `subscription_id=${TEST_SUB_ID}`,
          `sale_id=${TEST_SALE_ID}`,
          'ended_at=2026-06-01T00:00:00.000Z',
          `custom_fields[user_id]=${TEST_USER_ID}`
        ].join('&')
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(paymentSpy).not.toHaveBeenCalled()

    const subscriptionArgs = upsertSpy.mock.calls[0]?.[1] as Partial<Subscription>
    expect(subscriptionArgs.status).toBe('expired')
    expect(subscriptionArgs.cancelled_at).toBe('2026-06-01T00:00:00.000Z')
    expect(subscriptionArgs.current_period_end).toBe('2026-06-01T00:00:00.000Z')
  })

  test('POST /api/gumroad/webhook marks subscription past_due and payment failed on charge failure', async () => {
    const app = createApp()
    const upsertSpy = jest
      .spyOn(supabaseModule, 'upsertSubscription')
      .mockResolvedValue({ id: 'sub-row-id' } as Subscription)
    const paymentSpy = jest
      .spyOn(supabaseModule, 'insertPaymentRecord')
      .mockResolvedValue({ id: 'payment-row-id' } as PaymentRecord)
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          'seller_id=test-seller',
          'notification_type=payment_failed',
          `subscription_id=${TEST_SUB_ID}`,
          `sale_id=${TEST_SALE_ID}`,
          'charge_failed=true',
          'price=19.99',
          `custom_fields[user_id]=${TEST_USER_ID}`
        ].join('&')
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)

    const subscriptionArgs = upsertSpy.mock.calls[0]?.[1] as Partial<Subscription>
    expect(subscriptionArgs.status).toBe('past_due')

    const paymentArgs = paymentSpy.mock.calls[0]?.[1] as Partial<PaymentRecord>
    expect(paymentArgs.status).toBe('failed')
    expect(paymentArgs.event_type).toBe('payment_failed')
  })

  test('POST /api/gumroad/webhook marks payment refunded for refund event', async () => {
    const app = createApp()
    jest
      .spyOn(supabaseModule, 'upsertSubscription')
      .mockResolvedValue({ id: 'sub-row-id' } as Subscription)
    const paymentSpy = jest
      .spyOn(supabaseModule, 'insertPaymentRecord')
      .mockResolvedValue({ id: 'payment-row-id' } as PaymentRecord)
    jest.spyOn(supabaseModule, 'insertGumroadEvent').mockResolvedValue(true)

    const response = await app.request(
      '/api/gumroad/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: [
          'seller_id=test-seller',
          'notification_type=refund',
          `subscription_id=${TEST_SUB_ID}`,
          `sale_id=${TEST_SALE_ID}`,
          'price=9.99',
          `custom_fields[user_id]=${TEST_USER_ID}`
        ].join('&')
      },
      {
        ...baseEnv,
        GUMROAD_SELLER_ID: 'test-seller'
      } as Env
    )

    expect(response.status).toBe(200)

    const paymentArgs = paymentSpy.mock.calls[0]?.[1] as Partial<PaymentRecord>
    expect(paymentArgs.status).toBe('refunded')
  })
})
