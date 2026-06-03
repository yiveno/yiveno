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
  test('GET /api/website/share/:shortCode returns share contract with bookmarks', async () => {
    const app = createApp()

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/shares?')) {
        return new Response(
          JSON.stringify([
            {
              id: 'share_1',
              short_code: 'abc123',
              title: 'My Share',
              description: 'desc',
              bookmark_count: 2,
              show_username: true,
              created_at: '2026-01-01T00:00:00.000Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('/rest/v1/shared_bookmarks?')) {
        return new Response(
          JSON.stringify([
            {
              title: 'OpenAI',
              url: 'https://openai.com',
              description: 'ai',
              position: 1
            },
            {
              title: 'Hono',
              url: 'https://hono.dev',
              description: null,
              position: 2
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request('/api/website/share/abc123', {}, baseEnv)

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      short_code: string
      title: string
      bookmark_count: number
      bookmarks: Array<{
        title: string
        url: string
        description: string | null
        position: number | null
      }>
    }

    expect(data.short_code).toBe('abc123')
    expect(data.title).toBe('My Share')
    expect(data.bookmark_count).toBe(2)
    expect(data.bookmarks).toHaveLength(2)
    expect(data.bookmarks[0]).toEqual({
      title: 'OpenAI',
      url: 'https://openai.com',
      description: 'ai',
      position: 1
    })
  })

  test('GET /api/website/share/:shortCode returns 404 when share is missing', async () => {
    const app = createApp()

    globalThis.fetch = (async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })) as unknown as typeof fetch

    const response = await app.request('/api/website/share/missing', {}, baseEnv)

    expect(response.status).toBe(404)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('分享不存在或已过期')
  })

  test('GET /api/website/share/:shortCode returns 500 for invalid share payload', async () => {
    const app = createApp()

    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ id: 1, short_code: 'bad' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })) as unknown as typeof fetch

    const response = await app.request('/api/website/share/bad', {}, baseEnv)

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('分享数据格式错误')
  })

  test('GET /api/website/share/:shortCode returns 500 when bookmark query fails', async () => {
    const app = createApp()

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/shares?')) {
        return new Response(
          JSON.stringify([
            {
              id: 'share_1',
              short_code: 'abc123',
              title: 'My Share',
              description: 'desc',
              bookmark_count: 2,
              show_username: true,
              created_at: '2026-01-01T00:00:00.000Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('/rest/v1/shared_bookmarks?')) {
        return new Response('db timeout', {
          status: 500,
          headers: { 'content-type': 'text/plain' }
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request('/api/website/share/abc123', {}, baseEnv)

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string; detail: string }
    expect(data.error).toBe('查询书签失败')
    expect(data.detail).toContain('db timeout')
  })

  test('GET /api/website/share/:shortCode returns 500 for invalid bookmark payload', async () => {
    const app = createApp()

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/shares?')) {
        return new Response(
          JSON.stringify([
            {
              id: 'share_1',
              short_code: 'abc123',
              title: 'My Share',
              description: 'desc',
              bookmark_count: 2,
              show_username: true,
              created_at: '2026-01-01T00:00:00.000Z'
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('/rest/v1/shared_bookmarks?')) {
        return new Response(
          JSON.stringify([
            {
              title: 'Broken Bookmark',
              url: 123
            }
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request('/api/website/share/abc123', {}, baseEnv)

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('书签数据格式错误')
  })

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
    const response = await app.request(
      '/api/website/subscription?userId=user_123',
      {},
      {
        JWT_SECRET: 'test-secret',
        WEBSITE_URL: 'https://example.com'
      } as Env
    )

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
