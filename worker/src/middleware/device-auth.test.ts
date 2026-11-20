import { afterEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import type { Env } from '../types/env'
import {
  clearDeviceAuthCache,
  DEVICE_AUTH_CACHE_TTL_MS,
  DEVICE_LAST_SEEN_THROTTLE_MS,
  deviceAuth,
  setDeviceAuthCacheForTests
} from './device-auth'
import {
  createDeviceToken,
  deviceTokenKvKey,
  issueDeviceToken,
  type DeviceTokenRecord
} from '../services/auth/device-token-kv'
import { deviceAuthOrSupabaseAuth } from './device-or-supabase-auth'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  let putCount = 0
  return {
    store,
    getPutCount: () => putCount,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      putCount += 1
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    }
  }
}

function createEnv(kv: ReturnType<typeof createKvMock>): Env {
  return {
    AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key'
  } as unknown as Env
}

afterEach(() => {
  clearDeviceAuthCache()
  setDeviceAuthCacheForTests(null)
})

describe('deviceAuth', () => {
  test('有效 token → 200 并设置 userId', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const issued = await issueDeviceToken(env, {
      userId: '22222222-2222-2222-2222-222222222222',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const app = new Hono<{
      Bindings: Env
      Variables: { supabaseUserId: string; deviceIsAnonymous: boolean }
    }>()
    app.get('/t', deviceAuth(), c =>
      c.json({
        userId: c.get('supabaseUserId'),
        isAnonymous: c.get('deviceIsAnonymous')
      })
    )
    const res = await app.request(
      '/t',
      { headers: { authorization: `Bearer ${issued.deviceToken}` } },
      env
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { userId: string; isAnonymous: boolean }
    expect(data.userId).toBe(issued.userId)
    expect(data.isAnonymous).toBe(true)
  })

  test('无效 / 已撤销 → 401 invalid_token', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const app = new Hono<{ Bindings: Env }>()
    app.get('/t', deviceAuth(), c => c.json({ ok: true }))

    const bad = createDeviceToken()
    const resBad = await app.request('/t', { headers: { authorization: `Bearer ${bad}` } }, env)
    expect(resBad.status).toBe(401)

    const issued = await issueDeviceToken(env, { userId: 'u-rev', isAnonymous: false })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    const raw = await kv.get(deviceTokenKvKey(issued.deviceToken))
    const record = JSON.parse(raw!) as DeviceTokenRecord
    record.revokedAt = new Date().toISOString()
    await kv.put(deviceTokenKvKey(issued.deviceToken), JSON.stringify(record))

    const resRev = await app.request(
      '/t',
      { headers: { authorization: `Bearer ${issued.deviceToken}` } },
      env
    )
    expect(resRev.status).toBe(401)
  })

  test('内存缓存 TTL：过期前不重复读 KV get 路径仍可用', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const issued = await issueDeviceToken(env, { userId: 'u-cache', isAnonymous: false })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const app = new Hono<{ Bindings: Env }>()
    app.get('/t', deviceAuth(), c => c.json({ ok: true }))

    const headers = { authorization: `Bearer ${issued.deviceToken}` }
    expect((await app.request('/t', { headers }, env)).status).toBe(200)

    // 删 KV 键但缓存未过期 → 仍放行
    await kv.delete(deviceTokenKvKey(issued.deviceToken))
    expect((await app.request('/t', { headers }, env)).status).toBe(200)

    // 强制过期缓存
    const cache = new Map()
    setDeviceAuthCacheForTests(cache)
    cache.set(issued.deviceToken, {
      userId: 'u-cache',
      deviceId: 'd',
      isAnonymous: false,
      email: null,
      expiresAt: Date.now() - 1,
      lastSeenWrittenAt: Date.now()
    })
    expect((await app.request('/t', { headers }, env)).status).toBe(401)
    expect(DEVICE_AUTH_CACHE_TTL_MS).toBeGreaterThanOrEqual(30_000)
  })

  test('lastSeenAt 节流：5 分钟内二次鉴权不重复写', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const issued = await issueDeviceToken(env, { userId: 'u-seen', isAnonymous: false })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const putsAfterIssue = kv.getPutCount()
    const app = new Hono<{ Bindings: Env }>()
    app.get('/t', deviceAuth(), c => c.json({ ok: true }))
    const headers = { authorization: `Bearer ${issued.deviceToken}` }

    // 首次鉴权：若 issue 刚写过 lastSeen，节流内不应再 put
    await app.request('/t', { headers }, env)
    await app.request('/t', { headers }, env)
    expect(kv.getPutCount()).toBe(putsAfterIssue)
    expect(DEVICE_LAST_SEEN_THROTTLE_MS).toBe(5 * 60_000)
  })
})

describe('deviceAuthOrSupabaseAuth', () => {
  test('ydt_ 走 device；非法非 JWT 形态仍 401', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const issued = await issueDeviceToken(env, { userId: 'u-dual', isAnonymous: false })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const app = new Hono<{
      Bindings: Env
      Variables: { supabaseUserId: string; deviceIsAnonymous: boolean }
    }>()
    app.get('/t', deviceAuthOrSupabaseAuth(), c =>
      c.json({ userId: c.get('supabaseUserId'), anon: c.get('deviceIsAnonymous') })
    )

    const ok = await app.request(
      '/t',
      { headers: { authorization: `Bearer ${issued.deviceToken}` } },
      env
    )
    expect(ok.status).toBe(200)

    const bad = await app.request('/t', { headers: { authorization: 'Bearer not-a-jwt' } }, env)
    expect(bad.status).toBe(401)
  })
})
