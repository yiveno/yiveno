import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Env } from '../../types/env'
import type { DodoWebhookEvent } from './dodo-webhook'
import {
  extractCustomerEmail,
  sendProWelcomeEmail,
  shouldSendProWelcomeEmail
} from './pro-welcome-email'

const USER_ID = '11111111-1111-4111-8111-111111111111'

function event(overrides: Partial<DodoWebhookEvent> = {}): DodoWebhookEvent {
  return {
    eventId: 'evt_01welcome00000000000000001',
    eventType: 'subscription.active',
    occurredAt: '2026-08-18T00:00:00.000Z',
    data: {
      subscription_id: 'sub_Iuaq622bbmmfOGrVTqdXv',
      status: 'active',
      customer: { email: 'buyer@example.com' },
      metadata: { yiveno_user_id: USER_ID }
    },
    ...overrides
  }
}

describe('shouldSendProWelcomeEmail', () => {
  test('subscription.active + applied 且无 reason → 发', () => {
    expect(shouldSendProWelcomeEmail('subscription.active', { outcome: 'applied' })).toBe(true)
  })

  test('rejected / duplicate / 续费 / 乱序 → 不发', () => {
    expect(shouldSendProWelcomeEmail('subscription.active', { outcome: 'rejected' })).toBe(false)
    expect(shouldSendProWelcomeEmail('subscription.active', { outcome: 'duplicate' })).toBe(false)
    expect(shouldSendProWelcomeEmail('subscription.renewed', { outcome: 'applied' })).toBe(false)
    expect(
      shouldSendProWelcomeEmail('subscription.active', {
        outcome: 'applied',
        reason: 'stale_event'
      })
    ).toBe(false)
  })
})

describe('extractCustomerEmail', () => {
  test('读 customer.email', () => {
    expect(extractCustomerEmail({ customer: { email: 'a@b.co' } })).toBe('a@b.co')
  })

  test('非法地址 → null', () => {
    expect(extractCustomerEmail({ email: 'not-an-email' })).toBeNull()
  })
})

describe('sendProWelcomeEmail', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('无 EMAIL 绑定 → no_binding，不抛', async () => {
    const result = await sendProWelcomeEmail({ WEBSITE_URL: 'https://yiveno.com' } as Env, event())
    expect(result).toEqual({ sent: false, reason: 'no_binding' })
  })

  test('有绑定则发给 customer.email', async () => {
    const send = jest.fn().mockResolvedValue({ messageId: 'msg_1' })
    const env = {
      WEBSITE_URL: 'https://yiveno.com',
      EMAIL: { send }
    } as unknown as Env

    const result = await sendProWelcomeEmail(env, event())
    expect(result).toEqual({ sent: true, messageId: 'msg_1' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[0] as {
      to: string
      from: { email: string }
      subject: string
      text: string
      html: string
    }
    expect(payload.to).toBe('buyer@example.com')
    expect(payload.from.email).toBe('hello@yiveno.com')
    expect(payload.subject).toBe('Your Yiveno Pro is ready')
    expect(payload.text).toContain('https://yiveno.com/account')
    expect(payload.html).toContain('https://yiveno.com/account')
  })

  test('send 抛错 → send_failed，不抛给调用方', async () => {
    const send = jest.fn().mockRejectedValue(new Error('E_SENDER_NOT_VERIFIED'))
    const env = {
      WEBSITE_URL: 'https://yiveno.com',
      EMAIL: { send }
    } as unknown as Env

    const result = await sendProWelcomeEmail(env, event())
    expect(result).toEqual({ sent: false, reason: 'send_failed' })
  })
})
