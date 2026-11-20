import { afterEach, describe, expect, it, vi } from 'vitest'

import { maskEmailForLog, promoteAnonymousViaApi } from './promote-anonymous-api-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('maskEmailForLog', () => {
  it('掩码本地部分', () => {
    expect(maskEmailForLog('bob@example.com')).toBe('b***@example.com')
  })
})

describe('promoteAnonymousViaApi', () => {
  it('成功路径解析 data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            userId: '11111111-1111-1111-1111-111111111111',
            email: 'a@b.com',
            isAnonymous: false
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as typeof fetch

    const result = await promoteAnonymousViaApi('ydt_' + 'a'.repeat(64), 'a@b.com')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.email).toBe('a@b.com')
  })

  it('409 email_conflict', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'email_conflict' }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      })
    ) as typeof fetch

    const result = await promoteAnonymousViaApi('ydt_' + 'a'.repeat(64), 'taken@x.com')
    expect(result).toEqual({ ok: false, status: 409, error: 'email_conflict' })
  })

  it('网络失败 → status 0', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch
    const result = await promoteAnonymousViaApi('ydt_' + 'a'.repeat(64), 'a@b.com')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe(0)
  })
})
