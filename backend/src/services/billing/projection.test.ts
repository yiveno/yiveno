import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Subscription } from '@yiveno/types'
import type { Env } from '../../types/env'
import type { PaddleWebhookEvent } from './paddle-webhook'
import { projectPaddleWebhook } from './projection'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SUB_ID = 'sub_01h1vjes1y163hjs1s211srxny'
const env = {} as Env

function subscriptionEvent(
  overrides: Partial<PaddleWebhookEvent> & { data?: Record<string, unknown> } = {}
): PaddleWebhookEvent {
  return {
    eventId: 'evt_01proj00000000000000000001',
    eventType: 'subscription.created',
    occurredAt: '2026-08-14T00:00:00.000Z',
    data: {
      id: SUB_ID,
      status: 'active',
      customer_id: 'ctm_01abc',
      custom_data: { yiveno_user_id: USER_ID },
      current_billing_period: {
        starts_at: '2026-08-01T00:00:00.000Z',
        ends_at: '2026-09-01T00:00:00.000Z'
      },
      ...(overrides.data ?? {})
    },
    ...overrides
  }
}

const existingRow: Subscription = {
  user_id: USER_ID,
  status: 'active',
  tier: 'pro',
  current_period_start: '2026-08-01T00:00:00.000Z',
  current_period_end: '2026-09-01T00:00:00.000Z',
  provider_subscription_id: SUB_ID
}

describe('projectPaddleWebhook', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('重复 event_id → duplicate，不二次投影', async () => {
    const supabase = await import('../../data-access/supabase')
    const insert = jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(false)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectPaddleWebhook(env, subscriptionEvent(), '{}')
    expect(result.outcome).toBe('duplicate')
    expect(insert).toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  test('缺 yiveno_user_id → rejected，不开 Pro', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectPaddleWebhook(
      env,
      subscriptionEvent({ data: { id: SUB_ID, status: 'active', custom_data: {} } }),
      '{}'
    )
    expect(result).toEqual({ outcome: 'rejected', reason: 'missing_user_id' })
    expect(upsert).not.toHaveBeenCalled()
  })

  test('subscription.created 写入 active 投影', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectPaddleWebhook(env, subscriptionEvent(), '{}')
    expect(result.outcome).toBe('applied')
    expect(upsert).toHaveBeenCalled()
    const patch = upsert.mock.calls[0]?.[1]
    expect(patch?.status).toBe('active')
    expect(patch?.user_id).toBe(USER_ID)
    expect(patch?.cancel_at_period_end).toBe(false)
  })

  test('周期结束取消：仍投影 active + cancel_at_period_end', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectPaddleWebhook(
      env,
      subscriptionEvent({
        eventType: 'subscription.updated',
        data: {
          id: SUB_ID,
          status: 'active',
          custom_data: { yiveno_user_id: USER_ID },
          scheduled_change: { action: 'cancel', effective_at: '2026-09-01T00:00:00.000Z' }
        }
      }),
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(upsert.mock.calls[0]?.[1]?.cancel_at_period_end).toBe(true)
    expect(upsert.mock.calls[0]?.[1]?.status).toBe('active')
  })

  test('全额退款 → 立刻 expire', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue({
      ...existingRow,
      status: 'expired'
    })
    const pay = jest
      .spyOn(supabase, 'insertPaymentRecord')
      .mockImplementation(async (_env, payment) => payment)

    const result = await projectPaddleWebhook(
      env,
      {
        eventId: 'evt_refund_full',
        eventType: 'adjustment.updated',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          id: 'adj_01full',
          action: 'refund',
          status: 'approved',
          type: 'full',
          subscription_id: SUB_ID,
          transaction_id: 'txn_01abc',
          currency_code: 'USD',
          totals: { total: '799' }
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(pay).toHaveBeenCalled()
    expect(upsert.mock.calls[0]?.[1]?.status).toBe('expired')
  })

  test('部分退款 → 不 expire', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)
    jest.spyOn(supabase, 'insertPaymentRecord').mockImplementation(async (_env, payment) => payment)

    const result = await projectPaddleWebhook(
      env,
      {
        eventId: 'evt_refund_partial',
        eventType: 'adjustment.updated',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          id: 'adj_01part',
          action: 'refund',
          status: 'approved',
          type: 'partial',
          subscription_id: SUB_ID,
          transaction_id: 'txn_01abc'
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(upsert).not.toHaveBeenCalled()
  })

  test('投影失败会删除 event 占位', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    jest.spyOn(supabase, 'upsertSubscription').mockRejectedValue(new Error('db down'))
    const del = jest.spyOn(supabase, 'deleteBillingEvent').mockResolvedValue()

    await expect(projectPaddleWebhook(env, subscriptionEvent(), '{}')).rejects.toThrow('db down')
    expect(del).toHaveBeenCalledWith(env, 'evt_01proj00000000000000000001')
  })
})
