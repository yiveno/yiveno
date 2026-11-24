import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatLogTimestamp,
  logger,
  resetLogDedupForTests,
  summarizeLogError,
  tagExternalServiceMessage
} from '@/infrastructure/logging/logger'

describe('formatLogTimestamp', () => {
  it('formats local wall clock as YYYY-MM-DD HH:mm:ss', () => {
    expect(formatLogTimestamp(new Date(2026, 8, 11, 9, 5, 12))).toBe('2026-09-11 09:05:12')
  })
})

describe('tagExternalServiceMessage', () => {
  it('prefixes service id', () => {
    expect(tagExternalServiceMessage('supabase_auth', 'Request rate limit reached')).toBe(
      '[supabase_auth] Request rate limit reached'
    )
  })

  it('does not double-prefix', () => {
    expect(
      tagExternalServiceMessage('supabase_auth', '[supabase_auth] Request rate limit reached')
    ).toBe('[supabase_auth] Request rate limit reached')
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

  it('嵌套 error 含 message + detail → message（detail）', () => {
    expect(
      summarizeLogError({
        durationMs: 12,
        error: {
          name: 'WorkerApiError',
          message: 'quota_exceeded',
          detail: 'free，今日 100/100，UTC 午夜重置'
        }
      })
    ).toBe('quota_exceeded（free，今日 100/100，UTC 午夜重置）')
  })

  it('reads reason field (external service tagged text)', () => {
    expect(summarizeLogError({ reason: '[supabase_auth] Request rate limit reached' })).toBe(
      '[supabase_auth] Request rate limit reached'
    )
  })
})

describe('logger.error', () => {
  beforeEach(() => {
    resetLogDedupForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 9, 5, 12))
  })

  afterEach(() => {
    resetLogDedupForTests()
    vi.useRealTimers()
  })

  it('appends error message to the first log line（无对象第二参）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('Subscription', '拉取云端订阅：失败', {
      durationMs: 8,
      error: { name: 'Error', message: 'missing_authorization' }
    })
    expect(spy).toHaveBeenCalledWith(
      '[2026-09-11 09:05:12] [Yiveno:Subscription] 拉取云端订阅：失败 — missing_authorization'
    )
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('supports raw Error as data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new Error('startup_failed')
    logger.error('Background', '启动初始化失败', error)
    expect(spy).toHaveBeenCalledWith(
      '[2026-09-11 09:05:12] [Yiveno:Background] 启动初始化失败 — startup_failed'
    )
    spy.mockRestore()
  })

  it('同 key 窗口内 3 次只记 1 行', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const data = {
      error: { message: 'quota_exceeded', detail: 'free，今日 100/100，UTC 午夜重置' }
    }
    logger.error('Embed', 'Worker embed 请求：失败', data)
    logger.error('Embed', 'Worker embed 请求：失败', data)
    logger.error('Embed', 'Worker embed 请求：失败', data)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('窗口过期后记行带此前重复计数', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const data = { error: { message: 'embed_failed', detail: '上游模型调用失败' } }
    logger.error('Embed', 'Worker embed 请求：失败', data)
    logger.error('Embed', 'Worker embed 请求：失败', data)
    logger.error('Embed', 'Worker embed 请求：失败', data)
    expect(spy).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date(2026, 8, 11, 9, 10, 13))
    logger.error('Embed', 'Worker embed 请求：失败', data)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[1]?.[0]).toContain('（此前 5 分钟内重复 ×2）')
    spy.mockRestore()
  })

  it('不同 detail 分开记', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.error('Embed', 'Worker embed 请求：失败', {
      error: { message: 'quota_exceeded', detail: 'free，今日 99/100，UTC 午夜重置' }
    })
    logger.error('Embed', 'Worker embed 请求：失败', {
      error: { message: 'quota_exceeded', detail: 'free，今日 100/100，UTC 午夜重置' }
    })
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })
})

describe('logger.warn', () => {
  beforeEach(() => {
    resetLogDedupForTests()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 9, 5, 12))
  })

  afterEach(() => {
    resetLogDedupForTests()
    vi.useRealTimers()
  })

  it('首行内联摘要且无对象第二参（避免错误页 [object Object]）', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    logger.warn('i18n', '加载文案目录失败，回退 chrome.i18n', {
      locale: 'zh_CN',
      error: 'Failed to fetch'
    })
    expect(spy).toHaveBeenCalledWith(
      '[2026-09-11 09:05:12] [Yiveno:i18n] 加载文案目录失败，回退 chrome.i18n — Failed to fetch'
    )
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
