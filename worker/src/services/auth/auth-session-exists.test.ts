import { describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import { authSessionExistsById } from './auth-session-exists'

function baseEnv(): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key'
  } as unknown as Env
}

describe('authSessionExistsById', () => {
  test('缺配置 → unknown', async () => {
    expect(await authSessionExistsById({} as Env, 'u', 's')).toEqual({ status: 'unknown' })
  })

  test('PostgREST 200 + 有行 → alive', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([{ id: 'sess-1' }]), { status: 200 })) as unknown as typeof fetch
    try {
      expect(await authSessionExistsById(baseEnv(), 'user-1', 'sess-1')).toEqual({
        status: 'alive'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('PostgREST 200 + 空数组 → gone（唯一高置信不存在）', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch
    try {
      expect(await authSessionExistsById(baseEnv(), 'user-1', 'sess-1')).toEqual({
        status: 'gone'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('PostgREST 非 200 → unknown（不得当 gone，以免绕过互斥）', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    try {
      expect(await authSessionExistsById(baseEnv(), 'user-1', 'sess-1')).toEqual({
        status: 'unknown'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('PostgREST 非数组 JSON → unknown', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ id: 'x' }), { status: 200 })) as unknown as typeof fetch
    try {
      expect(await authSessionExistsById(baseEnv(), 'user-1', 'sess-1')).toEqual({
        status: 'unknown'
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
