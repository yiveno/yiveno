import { describe, expect, mock, test } from 'bun:test'

import { handleScheduledCleanup } from './scheduled-cleanup'
import type { Env } from '../types/env'

describe('scheduled-cleanup', () => {
  test('关闭开关时跳过清理', async () => {
    const spy = mock(() => Promise.resolve())

    await handleScheduledCleanup(
      {
        cron: '17 19 * * *',
        scheduledTime: Date.parse('2026-08-05T19:17:00.000Z')
      },
      { CLEANUP_SCHEDULED_ENABLED: 'false' } as Env,
      spy as never
    )

    expect(spy).not.toHaveBeenCalled()
  })

  test('默认开启并执行清理', async () => {
    const spy = mock(() =>
      Promise.resolve({
        deletedBackupRows: 1,
        deletedPaymentRecordRows: 2,
        deletedSubscriptionRows: 3
      })
    )

    await handleScheduledCleanup(
      {
        cron: '17 19 * * *',
        scheduledTime: Date.parse('2026-08-05T19:17:00.000Z')
      },
      {} as Env,
      spy as never
    )

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
