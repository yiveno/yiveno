import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { jwtAuth } from './jwt'
import { signJWT } from '../utils/jwt'
import type { Env } from '../types/env'

const baseEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com'
} as Env

function createProtectedApp() {
  const app = new Hono<{ Bindings: Env }>()

  app.use('/protected', jwtAuth())
  app.get('/protected', c => {
    const payload = c.get('jwtPayload') as { sub?: string } | undefined
    return c.json({
      ok: true,
      sub: payload?.sub ?? null
    })
  })

  return app
}

describe('jwtAuth middleware', () => {
  test('returns 500 when secret is missing', async () => {
    const app = createProtectedApp()
    const response = await app.request('/protected', {}, { ...baseEnv, JWT_SECRET: '' } as Env)

    expect(response.status).toBe(500)
    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('JWT_SECRET 未配置')
  })

  test('rejects request without authorization header', async () => {
    const app = createProtectedApp()
    const response = await app.request('/protected', {}, baseEnv)

    expect(response.status).toBe(401)
  })

  test('allows request with a valid jwt token', async () => {
    const app = createProtectedApp()
    const token = await signJWT(baseEnv.JWT_SECRET, {
      sub: 'google:test-user',
      email: 'test@example.com',
      tier: 'free',
      features: {}
    })

    const response = await app.request(
      '/protected',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      baseEnv
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as { ok: boolean; sub: string | null }
    expect(data.ok).toBe(true)
    expect(data.sub).toBe('google:test-user')
  })
})
