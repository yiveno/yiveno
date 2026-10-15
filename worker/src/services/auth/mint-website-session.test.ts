import { beforeEach, describe, expect, mock, test } from 'bun:test'

const userId = '11111111-1111-4111-8111-111111111111'

function fakeAccessToken(sessionId: string): string {
  const payload = btoa(JSON.stringify({ sub: userId, session_id: sessionId }))
  return `x.${payload}.y`
}

describe('mintWebsiteSessionFromExtension', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('成功铸造官网会话且不依赖扩展租约 KV', async () => {
    const access = fakeAccessToken('web-sess-1')
    mock.module('../../data-access/supabase', () => ({
      createSupabaseClient: () => ({
        auth: {
          admin: {
            getUserById: async () => ({ data: { user: { email: 'a@example.com' } }, error: null }),
            generateLink: async () => ({
              data: {
                properties: { hashed_token: 'hash' },
                user: { id: userId }
              },
              error: null
            })
          }
        }
      })
    }))
    mock.module('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          verifyOtp: async () => ({
            data: {
              session: {
                access_token: access,
                refresh_token: 'rt',
                expires_at: 1_700_000_000,
                user: { id: userId, email: 'a@example.com' }
              }
            },
            error: null
          })
        }
      })
    }))

    const { mintWebsiteSessionFromExtension } = await import('./mint-website-session')
    const result = await mintWebsiteSessionFromExtension(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_ANON_KEY: 'anon',
        SUPABASE_SERVICE_ROLE_KEY: 'service'
      } as never,
      userId,
      'a@example.com'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.session.accessToken).toBe(access)
    expect(result.session.refreshToken).toBe('rt')
    expect(result.session.userId).toBe(userId)
  })
})
