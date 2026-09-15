import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatLogTimestamp, logger, summarizeLogError } from '@/infrastructure/logging/logger'

describe('formatLogTimestamp', () => {
  it('formats local wall clock as YYYY-MM-DD HH:mm:ss', () => {
    expect(formatLogTimestamp(new Date(2026, 8, 11, 9, 5, 12))).toBe('2026-09-11 09:05:12')
  })
})

describe('summarizeLogError', () => {
  it('reads Error.message', () => {
    expect(summarizeLogError(new Error('missing_authorization'))).toBe('missing_authorization')
  })

  it('reads nested flowFail error object', () => {
    expect(
      summarizeLogError({
        durationMs: 12,
        error: { name: 'Error', message: 'http_401' }
      })
    ).toBe('http_401')
  })
})

describe('logger.error', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 9, 5, 12))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('appends error message to the first log line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('Subscription', '拉取云端订阅：失败', {
      durationMs: 8,
      error: { name: 'Error', message: 'missing_authorization' }
    })
    expect(spy).toHaveBeenCalledWith(
      '[2026-09-11 09:05:12] [Yiveno:Subscription] 拉取云端订阅：失败 — missing_authorization',
      {
        durationMs: 8,
        error: { name: 'Error', message: 'missing_authorization' }
      }
    )
    spy.mockRestore()
  })

  it('supports raw Error as data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('startup_failed')
    logger.error('Background', '启动初始化失败', error)
    expect(spy).toHaveBeenCalledWith(
      '[2026-09-11 09:05:12] [Yiveno:Background] 启动初始化失败 — startup_failed',
      error
    )
    spy.mockRestore()
  })
})
