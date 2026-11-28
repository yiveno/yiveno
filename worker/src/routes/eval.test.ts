import { describe, expect, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import { handleEvalMintSession, timingSafeEqualString } from './eval'

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

describe('timingSafeEqualString', () => {
  test('相等 → true', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true)
  })
  test('不等 → false', () => {
    expect(timingSafeEqualString('abc', 'abd')).toBe(false)
    expect(timingSafeEqualString('abc', 'ab')).toBe(false)
  })
})

describe('POST /api/eval/mint-session', () => {
  test('EVAL_MINT_TOKEN 未配置 → 503 eval_mint_disabled', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/eval/mint-session',
      {
        method: 'POST',
        headers: { 'x-eval-mint-token': 'anything' }
      },
      baseEnv
    )
    expect(response.status).toBe(503)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('eval_mint_disabled')
  })

  test('错 token → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/eval/mint-session',
      {
        method: 'POST',
        headers: { 'x-eval-mint-token': 'wrong-token' }
      },
      {
        ...baseEnv,
        EVAL_MINT_TOKEN: 'correct-token'
      } as Env
    )
    expect(response.status).toBe(401)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('unauthorized')
  })

  test('对 token → 200，只返回 accessToken 与 userId', async () => {
    const userId = '11111111-1111-4111-8111-111111111111'
    const response = await handleEvalMintSession(
      {
        ...baseEnv,
        EVAL_MINT_TOKEN: 'correct-token',
        EVAL_MINT_USER_EMAIL: 'retrieval-ablation-local@yiveno.dev'
      } as Env,
      'correct-token',
      {
        lookup: async () => ({ found: true, userId }),
        issue: async () => ({
          ok: true,
          session: {
            accessToken: 'minted-access',
            refreshToken: 'minted-refresh',
            userId,
            email: 'retrieval-ablation-local@yiveno.dev',
            expiresAt: null,
            sessionId: null
          }
        })
      }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const data = (await response.json()) as Record<string, unknown>
    expect(data.accessToken).toBe('minted-access')
    expect(data.userId).toBe(userId)
    expect(data.refreshToken).toBeUndefined()
  })
})
