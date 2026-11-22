import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import { verifyTurnstileToken } from './turnstile-verify'

describe('verifyTurnstileToken', () => {
  test('success → ok', async () => {
    const result = await verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' } as Env, 'tok', {
      fetchFn: async () => new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    expect(result).toEqual({ ok: true })
  })

  test('siteverify success=false → verify_failed', async () => {
    const result = await verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' } as Env, 'tok', {
      fetchFn: async () => new Response(JSON.stringify({ success: false }), { status: 200 })
    })
    expect(result).toEqual({ ok: false, reason: 'verify_failed' })
  })

  test('缺 secret → missing_secret', async () => {
    const result = await verifyTurnstileToken({} as Env, 'tok')
    expect(result).toEqual({ ok: false, reason: 'missing_secret' })
  })

  test('缺 token → missing_token', async () => {
    const result = await verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' } as Env, '  ')
    expect(result).toEqual({ ok: false, reason: 'missing_token' })
  })

  test('网络异常 → network_error', async () => {
    const result = await verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' } as Env, 'tok', {
      fetchFn: async () => {
        throw new Error('offline')
      }
    })
    expect(result).toEqual({ ok: false, reason: 'network_error' })
  })
})
