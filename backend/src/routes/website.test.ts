import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import * as supabaseModule from '../data-access/supabase'

const baseEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = originalFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  jest.restoreAllMocks()
})

describe('website routes', () => {
  test('GET /api/website/subscription rejects request without userId', async () => {
    const app = createApp()
    const response = await app.request('/api/website/subscription', {}, baseEnv)

    expect(response.status).toBe(400)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('缺少 userId 参数')
  })

  test('GET /api/website/subscription returns free tier when no subscription exists', async () => {
    const app = createApp()

    jest.spyOn(supabaseModule, 'createSupabaseClient').mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gt: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: null
                    })
                  })
                })
              })
            })
          })
        })
      })
    } as unknown as ReturnType<typeof supabaseModule.createSupabaseClient>)

    const response = await app.request('/api/website/subscription?userId=user_123', {}, baseEnv)

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      tier: string
      status: string
    }
    expect(data).toEqual({
      tier: 'free',
      status: 'inactive'
    })
  })

  test('GET /api/website/subscription returns normalized active subscription payload', async () => {
    const app = createApp()

    jest.spyOn(supabaseModule, 'createSupabaseClient').mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gt: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: {
                        tier: 'pro',
                        status: 'active',
                        current_period_start: '2026-01-01T00:00:00.000Z',
                        current_period_end: '2026-02-01T00:00:00.000Z',
                        cancel_at_period_end: true
                      },
                      error: null
                    })
                  })
                })
              })
            })
          })
        })
      })
    } as unknown as ReturnType<typeof supabaseModule.createSupabaseClient>)

    const response = await app.request('/api/website/subscription?userId=user_123', {}, baseEnv)

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      tier: string
      status: string
      currentPeriodStart: string
      currentPeriodEnd: string
      cancelAtPeriodEnd: boolean
    }

    expect(data).toEqual({
      tier: 'pro',
      status: 'active',
      currentPeriodStart: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      cancelAtPeriodEnd: true
    })
  })

  test('GET /api/website/subscription returns 500 when database is not configured', async () => {
    const app = createApp()
    const response = await app.request('/api/website/subscription?userId=user_123', {}, {
      JWT_SECRET: 'test-secret',
      WEBSITE_URL: 'https://example.com'
    } as Env)

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('数据库未配置')
  })

  test('GET /api/website/subscription returns 500 when subscription query fails', async () => {
    const app = createApp()

    jest.spyOn(supabaseModule, 'createSupabaseClient').mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gt: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: null,
                      error: { message: 'db failed' }
                    })
                  })
                })
              })
            })
          })
        })
      })
    } as unknown as ReturnType<typeof supabaseModule.createSupabaseClient>)

    const response = await app.request('/api/website/subscription?userId=user_123', {}, baseEnv)

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('查询订阅失败')
  })
})
