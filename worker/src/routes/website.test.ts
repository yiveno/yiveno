import { describe, expect, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import { normalizeWebsiteSubscriptionTier } from './website'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store.set(key, value)
    }
  }
}

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com',
  AI_USAGE_KV: createKvMock()
} as unknown as Env

describe('website routes', () => {
  test('GET /api/website/subscription rejects request without Authorization', async () => {
    const app = createApp()
    const response = await app.request('/api/website/subscription', {}, baseEnv)

    expect(response.status).toBe(401)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing_authorization')
  })
})

function postUninstallFeedback(
  body: unknown,
  env: Env = baseEnv,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const app = createApp()
  return Promise.resolve(
    app.request(
      '/api/website/uninstall-feedback',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(extraHeaders ?? {})
        },
        body: JSON.stringify(body)
      },
      env
    )
  )
}

describe('POST /api/website/uninstall-feedback', () => {
  test('非法 reason → 400', async () => {
    const response = await postUninstallFeedback({ reasons: ['not_a_reason'] })
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_body')
  })

  test('空 reasons 且无 note → 400', async () => {
    const response = await postUninstallFeedback({})
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_body')
  })

  test('蜜罐字段有值 → 静默 200 且不写 KV', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const response = await postUninstallFeedback(
      {
        reasons: ['other'],
        website: 'bot'
      },
      env
    )
    expect(response.status).toBe(200)
    expect([...kv.store.keys()].filter(k => k.startsWith('feedback:'))).toHaveLength(0)
  })

  test('多选 reasons + note → 200 并写入 KV', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const response = await postUninstallFeedback(
      {
        reasons: ['didnt_find', 'too_hard'],
        note: '  hard to recall  '
      },
      env
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as { ok: boolean; id: string; email?: boolean }
    expect(data.ok).toBe(true)
    expect(data.id).toBeTruthy()
    expect(data.email).toBeUndefined()
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    expect(keys).toHaveLength(1)
    const row = JSON.parse(kv.store.get(keys[0]!)!) as {
      source: string
      reasons: string[]
      reason: string
      note: string
    }
    expect(row.source).toBe('uninstall')
    expect(row.reasons).toEqual(['didnt_find', 'too_hard'])
    expect(row.reason).toBe('didnt_find')
    expect(row.note).toBe('hard to recall')
  })

  test('仅 note → 200', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const response = await postUninstallFeedback({ note: 'just a thought' }, env)
    expect(response.status).toBe(200)
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    expect(keys).toHaveLength(1)
    const row = JSON.parse(kv.store.get(keys[0]!)!) as { note: string; reasons?: string[] }
    expect(row.note).toBe('just a thought')
    expect(row.reasons).toBeUndefined()
  })

  test('旧单选 reason 字段仍可用', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const response = await postUninstallFeedback({ reason: 'privacy' }, env)
    expect(response.status).toBe(200)
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    const row = JSON.parse(kv.store.get(keys[0]!)!) as { reasons: string[]; reason: string }
    expect(row.reasons).toEqual(['privacy'])
    expect(row.reason).toBe('privacy')
  })

  test('过长 note → 400', async () => {
    const response = await postUninstallFeedback({
      reasons: ['other'],
      note: 'x'.repeat(501)
    })
    expect(response.status).toBe(400)
  })

  test('context：服务端 IP/UA 覆盖客户端伪造，并保留昵称等', async () => {
    const kv = createKvMock()
    const env = { ...baseEnv, AI_USAGE_KV: kv } as unknown as Env
    const response = await postUninstallFeedback(
      {
        reasons: ['just_trying'],
        context: {
          displayName: 'Ada',
          email: 'ada@example.com',
          language: 'en-US',
          timezone: 'Asia/Shanghai',
          screen: '1440x900',
          ip: '1.2.3.4',
          userAgent: 'spoofed'
        }
      },
      env,
      {
        'cf-connecting-ip': '203.0.113.9',
        'user-agent': 'Mozilla/5.0 (test)'
      }
    )
    expect(response.status).toBe(200)
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    const row = JSON.parse(kv.store.get(keys[0]!)!) as {
      context: {
        displayName?: string
        email?: string
        ip?: string
        userAgent?: string
        language?: string
        timezone?: string
        screen?: string
      }
    }
    expect(row.context.displayName).toBe('Ada')
    expect(row.context.email).toBe('ada@example.com')
    expect(row.context.language).toBe('en-US')
    expect(row.context.timezone).toBe('Asia/Shanghai')
    expect(row.context.screen).toBe('1440x900')
    expect(row.context.ip).toBe('203.0.113.9')
    expect(row.context.userAgent).toBe('Mozilla/5.0 (test)')
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
