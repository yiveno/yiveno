import { describe, expect, mock, test } from 'bun:test'

import { handleScheduledAnonymousCleanup } from './scheduled-anonymous-cleanup'
import type { Env } from '../types/env'

describe('scheduled-anonymous-cleanup', () => {
  test('关闭开关时跳过', async () => {
    const listUsersPage = mock(() => Promise.resolve({ users: [], error: null }))

    await handleScheduledAnonymousCleanup(
      {
        cron: '0 3 * * SUN',
        scheduledTime: Date.parse('2026-11-22T03:00:00.000Z')
      },
      { ANON_CLEANUP_SCHEDULED_ENABLED: 'false' } as Env,
      { listUsersPage }
    )

    expect(listUsersPage).not.toHaveBeenCalled()
  })

  test('异常不抛出', async () => {
    await expect(
      handleScheduledAnonymousCleanup(
        {
          cron: '0 3 * * SUN',
          scheduledTime: Date.parse('2026-11-22T03:00:00.000Z')
        },
        {} as Env,
        {
          listUsersPage: async () => {
            throw new Error('boom')
          }
        }
      )
    ).resolves.toBeUndefined()
  })
})
