import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Env } from '../../types/env'
import * as directMail from '../email/aliyun-directmail'
import type { DodoWebhookEvent } from './dodo-webhook'
import {
  extractCustomerEmail,
  sendProWelcomeEmail,
  shouldSendProWelcomeEmail,
  welcomeCopy
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

describe('welcomeCopy', () => {
  test('定稿 subject / CTA / 脚注；禁旧工程师口吻', () => {
    const copy = welcomeCopy('https://yiveno.com')
    expect(copy.subject).toBe("You're on Yiveno Pro")
    expect(copy.text).toContain('Thanks for going Pro.')
    expect(copy.text).toContain('https://yiveno.com/account')
    expect(copy.text).toContain('Dodo Payments')
    expect(copy.text).not.toContain('Your Yiveno Pro is ready')
    expect(copy.text).not.toContain('hosted-clue quota')
    expect(copy.html).toContain('Manage subscription')
    expect(copy.html).toContain('https://yiveno.com/account')
    expect(copy.html).toContain('https://yiveno.com/apple-touch-icon.png')
    expect(copy.html).toContain('Dodo Payments')
    expect(copy.html).toContain('clue understanding are ready')
    expect(copy.html).not.toContain('Your Yiveno Pro is ready')
    expect(copy.html).not.toContain('hosted-clue quota')
  })
})

describe('sendProWelcomeEmail', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('未配 DirectMail → not_configured，不抛', async () => {
    const result = await sendProWelcomeEmail({ WEBSITE_URL: 'https://yiveno.com' } as Env, event())
    expect(result).toEqual({ sent: false, reason: 'not_configured' })
  })

  test('已配置则经 DirectMail 发给 customer.email', async () => {
    const send = jest.spyOn(directMail, 'sendDirectMail').mockResolvedValue({
      ok: true,
      requestId: 'req_1',
      envId: 'env_1'
    })
    jest.spyOn(directMail, 'isDirectMailConfigured').mockReturnValue(true)

    const result = await sendProWelcomeEmail(
      {
        WEBSITE_URL: 'https://yiveno.com',
        ALIYUN_DM_ACCESS_KEY_ID: 'ak',
        ALIYUN_DM_ACCESS_KEY_SECRET: 'sk'
      } as Env,
      event()
    )
    expect(result).toEqual({ sent: true, messageId: 'env_1' })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[1]
    expect(payload?.to).toBe('buyer@example.com')
    expect(payload?.accountName).toBe('hello@yiveno.com')
    expect(payload?.subject).toBe("You're on Yiveno Pro")
    expect(payload?.html).toContain('Manage subscription')
  })

  test('DirectMail 失败 → send_failed，不抛给调用方', async () => {
    jest.spyOn(directMail, 'isDirectMailConfigured').mockReturnValue(true)
    jest.spyOn(directMail, 'sendDirectMail').mockResolvedValue({
      ok: false,
      reason: 'api_error',
      detail: 'InvalidMailAddress.NotFound'
    })

    const result = await sendProWelcomeEmail(
      {
        WEBSITE_URL: 'https://yiveno.com',
        ALIYUN_DM_ACCESS_KEY_ID: 'ak',
        ALIYUN_DM_ACCESS_KEY_SECRET: 'sk'
      } as Env,
      event()
    )
    expect(result).toEqual({ sent: false, reason: 'send_failed' })
  })
})
