import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Subscription } from '@yiveno/types'
import type { Env } from '../../types/env'
import type { DodoWebhookEvent } from './dodo-webhook'
import { projectDodoWebhook } from './projection'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const SUB_ID = 'sub_Iuaq622bbmmfOGrVTqdXv'
const env = {} as Env

function subscriptionEvent(
  overrides: Partial<DodoWebhookEvent> & { data?: Record<string, unknown> } = {}
): DodoWebhookEvent {
  return {
    eventId: 'evt_01proj00000000000000000001',
    eventType: 'subscription.active',
    occurredAt: '2026-08-14T00:00:00.000Z',
    data: {
      subscription_id: SUB_ID,
      status: 'active',
      customer_id: 'cus_TV52uJWWXt2yIoBBxpjaa',
      metadata: { yiveno_user_id: USER_ID },
      previous_billing_date: '2026-08-01T00:00:00.000Z',
      next_billing_date: '2026-09-01T00:00:00.000Z',
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

describe('projectDodoWebhook', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('重复 event_id → duplicate，不二次投影', async () => {
    const supabase = await import('../../data-access/supabase')
    const insert = jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(false)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectDodoWebhook(env, subscriptionEvent(), '{}')
    expect(result.outcome).toBe('duplicate')
    expect(insert).toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  test('缺 yiveno_user_id → rejected，不开 Pro', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectDodoWebhook(
      env,
      subscriptionEvent({
        data: { subscription_id: SUB_ID, status: 'active', metadata: {} }
      }),
      '{}'
    )
    expect(result).toEqual({ outcome: 'rejected', reason: 'missing_user_id' })
    expect(upsert).not.toHaveBeenCalled()
  })

  test('subscription.active 写入 active 投影', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)

    const result = await projectDodoWebhook(env, subscriptionEvent(), '{}')
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

    const result = await projectDodoWebhook(
      env,
      subscriptionEvent({
        eventType: 'subscription.cancelled',
        data: {
          subscription_id: SUB_ID,
          status: 'cancelled',
          metadata: { yiveno_user_id: USER_ID },
          cancel_at_next_billing_date: true,
          next_billing_date: '2026-09-01T00:00:00.000Z'
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
    const dodo = await import('./dodo-client')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'updateBillingEventResult').mockResolvedValue(undefined)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    jest.spyOn(dodo, 'cancelDodoSubscriptionImmediate').mockResolvedValue({ ok: true })
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue({
      ...existingRow,
      status: 'expired'
    })
    const pay = jest
      .spyOn(supabase, 'insertPaymentRecord')
      .mockImplementation(async (_env, payment) => payment)

    const result = await projectDodoWebhook(
      env,
      {
        eventId: 'evt_refund_full',
        eventType: 'refund.succeeded',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          refund_id: 'ref_01full',
          subscription_id: SUB_ID,
          payment_id: 'pay_01abc',
          currency: 'USD',
          total_amount: 799,
          is_partial: false
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(pay).toHaveBeenCalled()
    expect(pay.mock.calls[0]?.[1]?.provider_transaction_id).toBe('ref_01full')
    expect(pay.mock.calls[0]?.[1]?.provider_payment_id).toBe('pay_01abc')
    expect(upsert.mock.calls[0]?.[1]?.status).toBe('expired')
    expect(upsert.mock.calls[0]?.[1]?.provider_status).toBe('refunded')
    expect(dodo.cancelDodoSubscriptionImmediate).toHaveBeenCalledWith(env, SUB_ID)
  })

  test('全额退款无 subscription_id → 经 payment_records 反查后 expire', async () => {
    const supabase = await import('../../data-access/supabase')
    const dodo = await import('./dodo-client')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'updateBillingEventResult').mockResolvedValue(undefined)
    jest.spyOn(supabase, 'getPaymentRecordByProviderTransactionId').mockResolvedValue({
      user_id: USER_ID,
      provider_subscription_id: SUB_ID,
      provider_transaction_id: 'pay_01abc',
      amount: 799,
      currency: 'USD',
      status: 'paid',
      event_type: 'payment.succeeded'
    })
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    jest.spyOn(dodo, 'cancelDodoSubscriptionImmediate').mockResolvedValue({ ok: true })
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue({
      ...existingRow,
      status: 'expired'
    })
    jest.spyOn(supabase, 'insertPaymentRecord').mockImplementation(async (_env, payment) => payment)

    const result = await projectDodoWebhook(
      env,
      {
        eventId: 'evt_refund_via_pay',
        eventType: 'refund.succeeded',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          refund_id: 'ref_01via_pay',
          payment_id: 'pay_01abc',
          currency: 'USD',
          amount: 799,
          is_partial: false
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(upsert.mock.calls[0]?.[1]?.status).toBe('expired')
    expect(dodo.cancelDodoSubscriptionImmediate).toHaveBeenCalled()
  })

  test('部分退款 → 不 expire', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'updateBillingEventResult').mockResolvedValue(undefined)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue(existingRow)
    jest.spyOn(supabase, 'insertPaymentRecord').mockImplementation(async (_env, payment) => payment)

    const result = await projectDodoWebhook(
      env,
      {
        eventId: 'evt_refund_partial',
        eventType: 'refund.succeeded',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          refund_id: 'ref_01part',
          subscription_id: SUB_ID,
          payment_id: 'pay_01abc',
          is_partial: true
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(upsert).not.toHaveBeenCalled()
  })

  test('dispute.lost → 经 payment 反查后 expire', async () => {
    const supabase = await import('../../data-access/supabase')
    const dodo = await import('./dodo-client')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'updateBillingEventResult').mockResolvedValue(undefined)
    jest.spyOn(supabase, 'getPaymentRecordByProviderTransactionId').mockResolvedValue({
      user_id: USER_ID,
      provider_subscription_id: SUB_ID,
      provider_transaction_id: 'pay_01abc',
      amount: 799,
      currency: 'USD',
      status: 'paid',
      event_type: 'payment.succeeded'
    })
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(existingRow)
    jest.spyOn(dodo, 'cancelDodoSubscriptionImmediate').mockResolvedValue({ ok: true })
    const upsert = jest.spyOn(supabase, 'upsertSubscription').mockResolvedValue({
      ...existingRow,
      status: 'expired'
    })
    const pay = jest
      .spyOn(supabase, 'insertPaymentRecord')
      .mockImplementation(async (_env, payment) => payment)

    const result = await projectDodoWebhook(
      env,
      {
        eventId: 'evt_dispute_lost',
        eventType: 'dispute.lost',
        occurredAt: '2026-08-14T02:00:00.000Z',
        data: {
          dispute_id: 'dsp_01',
          payment_id: 'pay_01abc',
          amount: 799
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('applied')
    expect(pay.mock.calls[0]?.[1]?.provider_transaction_id).toBe('dsp_01')
    expect(pay.mock.calls[0]?.[1]?.provider_payment_id).toBe('pay_01abc')
    expect(upsert.mock.calls[0]?.[1]?.status).toBe('expired')
  })

  test('退款缺 user → rejected 并回写 billing_events', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    const update = jest.spyOn(supabase, 'updateBillingEventResult').mockResolvedValue(undefined)
    jest.spyOn(supabase, 'getPaymentRecordByProviderTransactionId').mockResolvedValue(null)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    const dodo = await import('./dodo-client')
    jest.spyOn(dodo, 'fetchDodoPayment').mockResolvedValue({
      ok: false,
      reason: 'not_found'
    })

    const result = await projectDodoWebhook(
      env,
      {
        eventId: 'evt_refund_orphan',
        eventType: 'refund.succeeded',
        occurredAt: '2026-08-14T01:00:00.000Z',
        data: {
          refund_id: 'ref_orphan',
          payment_id: 'pay_unknown',
          is_partial: false
        }
      },
      '{}'
    )
    expect(result.outcome).toBe('rejected')
    expect(result.reason).toBe('missing_user_id')
    expect(update).toHaveBeenCalledWith(
      env,
      'evt_refund_orphan',
      expect.objectContaining({ result: 'rejected', skip_reason: 'missing_user_id' })
    )
  })

  test('投影失败会删除 event 占位', async () => {
    const supabase = await import('../../data-access/supabase')
    jest.spyOn(supabase, 'insertBillingEvent').mockResolvedValue(true)
    jest.spyOn(supabase, 'getSubscriptionByProviderId').mockResolvedValue(null)
    jest.spyOn(supabase, 'upsertSubscription').mockRejectedValue(new Error('db down'))
    const del = jest.spyOn(supabase, 'deleteBillingEvent').mockResolvedValue()

    await expect(projectDodoWebhook(env, subscriptionEvent(), '{}')).rejects.toThrow('db down')
    expect(del).toHaveBeenCalledWith(env, 'evt_01proj00000000000000000001')
  })
})
