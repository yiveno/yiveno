import { describe, expect, test, jest, afterEach } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import { normalizeWebsiteSubscriptionTier } from './website'
import * as supabase from '../data-access/supabase'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    }
  }
}

const baseEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com',
  AI_USAGE_KV: createKvMock()
} as unknown as Env

function postWaitlist(body: unknown, env: Env = baseEnv): Promise<Response> {
  const app = createApp()
  return Promise.resolve(
    app.request(
      '/api/website/waitlist',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      },
      env
    )
  )
}

describe('website routes', () => {
  test('GET /api/website/subscription rejects request without Authorization', async () => {
    const app = createApp()
    const response = await app.request('/api/website/subscription', {}, baseEnv)

    expect(response.status).toBe(401)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing_authorization')
  })
})

describe('POST /api/website/waitlist', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('非法邮箱 → 400', async () => {
    const response = await postWaitlist({ email: 'not-an-email' })
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_email')
  })

  test('蜜罐字段有值 → 静默 200 且不写库', async () => {
    const insert = jest.fn()
    jest.spyOn(supabase, 'createSupabaseClient').mockReturnValue({
      from: () => ({ insert })
    } as never)

    const response = await postWaitlist({ email: 'person@example.com', company: 'bot' })
    expect(response.status).toBe(200)
    expect(insert).not.toHaveBeenCalled()
  })

  test('新邮箱 → 200 并 insert', async () => {
    const insert = jest.fn(async () => ({ error: null }))
    jest.spyOn(supabase, 'createSupabaseClient').mockReturnValue({
      from: () => ({ insert })
    } as never)

    const response = await postWaitlist({ email: 'Alex@Example.com' })
    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith({ email: 'alex@example.com' })
  })

  test('重复邮箱 → 仍 200', async () => {
    jest.spyOn(supabase, 'createSupabaseClient').mockReturnValue({
      from: () => ({
        insert: async () => ({ error: { code: '23505' } })
      })
    } as never)

    const response = await postWaitlist({ email: 'alex@example.com' })
    expect(response.status).toBe(200)
  })
})

describe('normalizeWebsiteSubscriptionTier', () => {
  test('仅 pro 对外展示为 pro；premium 等归一 free', () => {
    expect(normalizeWebsiteSubscriptionTier('pro')).toBe('pro')
    expect(normalizeWebsiteSubscriptionTier('premium')).toBe('free')
    expect(normalizeWebsiteSubscriptionTier('free')).toBe('free')
    expect(normalizeWebsiteSubscriptionTier(null)).toBe('free')
  })
})
