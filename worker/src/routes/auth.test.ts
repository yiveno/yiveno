import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'
import * as bindOtpService from '../services/auth/bind-otp-service'
import { clearDeviceAuthCache } from '../middleware/device-auth'
import { issueDeviceToken } from '../services/auth/device-token-kv'

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
  clearDeviceAuthCache()
})

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    }
  }
}

describe('auth routes', () => {
  test('POST /api/auth/promote 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/promote',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/extension-session → 410 Gone（改走 device-register）', async () => {
    const app = createApp()
    const response = await app.request('/api/auth/extension-session', { method: 'POST' }, baseEnv)
    expect(response.status).toBe(410)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('gone')
  })

  test('POST /api/auth/extension-uninstall-revoke 缺 token → 400', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/extension-uninstall-revoke',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      },
      baseEnv
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('empty_token')
  })

  test('POST /api/auth/extension-uninstall-revoke 未知 token → 404', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/extension-uninstall-revoke',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'a'.repeat(64) })
      },
      {
        ...baseEnv,
        AI_USAGE_KV: {
          get: async () => null,
          put: async () => undefined,
          delete: async () => undefined
        }
      } as unknown as Env
    )
    expect(response.status).toBe(404)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_token')
  })

  test('GET /api/auth/providers returns configured provider status', async () => {
    const app = createApp()
    const response = await app.request('/api/auth/providers', {}, {
      ...baseEnv,
      AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
      AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
    } as Env)

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      providers: {
        google: boolean
        googleHasSecret: boolean
        microsoft: boolean
        microsoftHasSecret: boolean
      }
      redirectAllowlist?: string[]
    }

    expect(data.success).toBe(true)
    expect(data.providers.google).toBe(true)
    expect(data.providers.googleHasSecret).toBe(true)
    expect(data.providers.microsoft).toBe(false)
    expect(data.providers.microsoftHasSecret).toBe(false)
  })

  test('GET /api/auth/start returns oauth authorization url for valid request', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'
    const response = await app.request(
      `/api/auth/start?provider=google&redirect_uri=${encodeURIComponent(redirectUri)}&state=test-state`,
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id'
      } as Env
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      provider: string
      authUrl: string
      state: string
    }

    expect(data.success).toBe(true)
    expect(data.provider).toBe('google')
    expect(data.state).toBe('test-state')

    const authUrl = new URL(data.authUrl)
    expect(authUrl.origin).toBe('https://accounts.google.com')
    expect(authUrl.searchParams.get('client_id')).toBe('google-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe(redirectUri)
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('state')).toBe('test-state')
  })

  test('GET /api/auth/start rejects invalid redirect_uri', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/start?provider=google&redirect_uri=http://evil.example.com/callback',
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id'
      } as Env
    )

    expect(response.status).toBe(400)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid redirect_uri: unsupported scheme')
  })

  test('GET /api/auth/start rejects unconfigured provider', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'
    const response = await app.request(
      `/api/auth/start?provider=microsoft&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {},
      baseEnv
    )

    expect(response.status).toBe(400)

    const data = (await response.json()) as {
      error: string
      missing: string[]
    }

    expect(data.error).toBe('provider not configured: microsoft')
    expect(data.missing).toContain('AUTH_MICROSOFT_CLIENT_ID')
  })

  test('GET /api/auth/start returns microsoft authorization url for valid request', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'
    const response = await app.request(
      `/api/auth/start?provider=microsoft&redirect_uri=${encodeURIComponent(redirectUri)}&state=ms-state`,
      {},
      {
        ...baseEnv,
        AUTH_MICROSOFT_CLIENT_ID: 'microsoft-client-id'
      } as Env
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      provider: string
      authUrl: string
      state: string
    }

    expect(data.success).toBe(true)
    expect(data.provider).toBe('microsoft')
    expect(data.state).toBe('ms-state')

    const authUrl = new URL(data.authUrl)
    expect(authUrl.origin).toBe('https://login.microsoftonline.com')
    expect(authUrl.searchParams.get('client_id')).toBe('microsoft-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe(redirectUri)
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('state')).toBe('ms-state')
    expect(authUrl.searchParams.get('prompt')).toBeNull()
    expect(authUrl.searchParams.get('access_type')).toBeNull()
  })

  test('GET /api/auth/callback rejects request without code', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'
    const response = await app.request(
      `/api/auth/callback?provider=google&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Env
    )

    expect(response.status).toBe(400)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing code')
  })

  test('GET /api/auth/callback rejects unsupported provider', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'
    const response = await app.request(
      `/api/auth/callback?provider=github&code=test-code&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {},
      baseEnv
    )

    expect(response.status).toBe(400)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('unsupported provider: github')
  })

  test('GET /api/auth/callback returns jwt and user payload for valid oauth flow', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'google-access-token',
            token_type: 'Bearer'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            email: 'user@example.com',
            sub: 'google-user-id'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request(
      `/api/auth/callback?provider=google&code=test-code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_verifier=test-verifier`,
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Env
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      token: string
      user: {
        id: string
        email: string
        provider: string
        tier: string
      }
    }

    expect(data.success).toBe(true)
    expect(data.token.length).toBeGreaterThan(20)
    expect(data.user).toEqual({
      id: 'google:google-user-id',
      email: 'user@example.com',
      provider: 'google',
      tier: 'free'
    })
  })

  test('GET /api/auth/callback returns 500 when token exchange fails', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response('bad oauth code', {
          status: 500,
          headers: { 'content-type': 'text/plain' }
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request(
      `/api/auth/callback?provider=google&code=bad-code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_verifier=test-verifier`,
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Env
    )

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('auth_callback_failed')
  })

  test('GET /api/auth/callback falls back to email when provider sub is empty', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'google-access-token',
            token_type: 'Bearer'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            email: 'fallback@example.com',
            sub: ''
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request(
      `/api/auth/callback?provider=google&code=test-code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_verifier=test-verifier`,
      {},
      {
        ...baseEnv,
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Env
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      user: {
        id: string
        email: string
      }
    }

    expect(data.user.id).toBe('google:fallback@example.com')
    expect(data.user.email).toBe('fallback@example.com')
  })

  test('GET /api/auth/callback returns 500 when JWT secret is missing', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'google-access-token',
            token_type: 'Bearer'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            email: 'user@example.com',
            sub: 'google-user-id'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request(
      `/api/auth/callback?provider=google&code=test-code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_verifier=test-verifier`,
      {},
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        WEBSITE_URL: 'https://example.com',
        AUTH_GOOGLE_CLIENT_ID: 'google-client-id',
        AUTH_GOOGLE_CLIENT_SECRET: 'google-client-secret'
      } as Env
    )

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('JWT_SECRET 未配置')
  })

  test('GET /api/auth/callback returns jwt and user payload for valid microsoft oauth flow', async () => {
    const app = createApp()
    const redirectUri = 'https://example.chromiumapp.org/callback'

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('login.microsoftonline.com/common/oauth2/v2.0/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'microsoft-access-token',
            token_type: 'Bearer'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      if (url.includes('graph.microsoft.com/v1.0/me')) {
        return new Response(
          JSON.stringify({
            email: 'ms-user@example.com',
            sub: 'microsoft-user-id'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    const response = await app.request(
      `/api/auth/callback?provider=microsoft&code=test-code&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&code_verifier=test-verifier`,
      {},
      {
        ...baseEnv,
        AUTH_MICROSOFT_CLIENT_ID: 'microsoft-client-id',
        AUTH_MICROSOFT_CLIENT_SECRET: 'microsoft-client-secret'
      } as Env
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      success: boolean
      token: string
      user: {
        id: string
        email: string
        provider: string
        tier: string
      }
    }

    expect(data.success).toBe(true)
    expect(data.token.length).toBeGreaterThan(20)
    expect(data.user).toEqual({
      id: 'microsoft:microsoft-user-id',
      email: 'ms-user@example.com',
      provider: 'microsoft',
      tier: 'free'
    })
  })

  test('POST /api/auth/bind-code 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', turnstileToken: 't' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/bind-verify 未登录 → 401', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@example.com', code: '12345678' })
      },
      baseEnv
    )
    expect(response.status).toBe(401)
  })

  test('POST /api/auth/bind-code 非法 body → 透传 service 错误', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '11111111-1111-1111-1111-111111111111',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'requestBindCode').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_email'
    })

    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'bad', turnstileToken: 't' })
      },
      env
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('invalid_email')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('POST /api/auth/bind-code 成功 → { success: true }', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '22222222-2222-2222-2222-222222222222',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'requestBindCode').mockResolvedValue({ ok: true })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-code',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`,
          'CF-Connecting-IP': '203.0.113.1'
        },
        body: JSON.stringify({
          email: 'ok@example.com',
          turnstileToken: 'tok',
          locale: 'en'
        })
      },
      env
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as { success: boolean }
    expect(data.success).toBe(true)
    expect(spy.mock.calls[0]?.[1]).toMatchObject({
      email: 'ok@example.com',
      turnstileToken: 'tok',
      locale: 'en',
      ip: '203.0.113.1',
      userId: issued.userId,
      deviceId: issued.deviceId
    })
    spy.mockRestore()
  })

  test('POST /api/auth/bind-verify 成功 → branch + claimToken', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '33333333-3333-3333-3333-333333333333',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'verifyBindCode').mockResolvedValue({
      ok: true,
      data: { branch: 'promote', claimToken: 'd'.repeat(64) }
    })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', code: '12345678' })
      },
      env
    )
    expect(response.status).toBe(200)
    const data = (await response.json()) as {
      success: boolean
      data: { branch: string; claimToken: string }
    }
    expect(data.success).toBe(true)
    expect(data.data.branch).toBe('promote')
    expect(data.data.claimToken).toBe('d'.repeat(64))
    spy.mockRestore()
  })

  test('POST /api/auth/bind-verify 主要失败路径 → invalid_code', async () => {
    const kv = createKvMock()
    const env = {
      ...baseEnv,
      AI_USAGE_KV: kv
    } as unknown as Env
    const issued = await issueDeviceToken(env, {
      userId: '44444444-4444-4444-4444-444444444444',
      isAnonymous: true
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const spy = spyOn(bindOtpService, 'verifyBindCode').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_code',
      remainingAttempts: 3
    })
    const app = createApp()
    const response = await app.request(
      '/api/auth/bind-verify',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${issued.deviceToken}`
        },
        body: JSON.stringify({ email: 'ok@example.com', code: '00000000' })
      },
      env
    )
    expect(response.status).toBe(400)
    const data = (await response.json()) as { error: string; remainingAttempts?: number }
    expect(data.error).toBe('invalid_code')
    expect(data.remainingAttempts).toBe(3)
    spy.mockRestore()
  })
})
