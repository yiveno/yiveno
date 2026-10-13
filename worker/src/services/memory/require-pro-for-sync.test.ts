import { describe, expect, mock, test } from 'bun:test'
import type { Env } from '../../types/env'

describe('denyUnlessActivePro', () => {
  test('非 Pro → pro_required', async () => {
    mock.module('../ai/require-pro-user', () => ({
      isActiveProUser: async () => false
    }))
    const { denyUnlessActivePro } = await import('./require-pro-for-sync')
    const denied = await denyUnlessActivePro({} as Env, 'user_1')
    expect(denied).toEqual({ error: 'pro_required' })
  })

  test('有效 Pro → null', async () => {
    mock.module('../ai/require-pro-user', () => ({
      isActiveProUser: async () => true
    }))
    const { denyUnlessActivePro } = await import('./require-pro-for-sync')
    const denied = await denyUnlessActivePro({} as Env, 'user_1')
    expect(denied).toBeNull()
  })
})
