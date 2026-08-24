import { describe, expect, it, vi } from 'vitest'

import { logger, summarizeLogError } from '@/infrastructure/logging/logger'

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
  it('appends error message to the first log line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('Subscription', '拉取云端订阅：失败', {
      durationMs: 8,
      error: { name: 'Error', message: 'missing_authorization' }
    })
    expect(spy).toHaveBeenCalledWith(
      '[Yiveno:Subscription] 拉取云端订阅：失败 — missing_authorization',
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
    expect(spy).toHaveBeenCalledWith('[Yiveno:Background] 启动初始化失败 — startup_failed', error)
    spy.mockRestore()
  })
})
