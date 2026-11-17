import { describe, expect, it } from 'vitest'

import {
  classifyClueLlmFailure,
  HostedCompleteError,
  resolveClueLlmFailureKindFromError,
  resolveClueLlmFailureQuotaFromError
} from '@/core/recall/understand/clue-llm-failure-kind'

describe('classifyClueLlmFailure', () => {
  it('missing_auth → auth', () => {
    expect(classifyClueLlmFailure({ known: 'missing_auth' })).toBe('auth')
  })

  it('empty_response → empty_response', () => {
    expect(classifyClueLlmFailure({ known: 'empty_response' })).toBe('empty_response')
  })

  it('TimeoutError → timeout', () => {
    expect(classifyClueLlmFailure({ errorName: 'TimeoutError' })).toBe('timeout')
  })

  it('AbortError → timeout', () => {
    expect(classifyClueLlmFailure({ errorName: 'AbortError' })).toBe('timeout')
  })

  it('无 status 的普通异常名 → unknown（网络失败由 hosted 显式标 network）', () => {
    expect(classifyClueLlmFailure({ errorName: 'TypeError' })).toBe('unknown')
  })

  it('429 + quota_exceeded → quota_monthly', () => {
    expect(classifyClueLlmFailure({ status: 429, workerError: 'quota_exceeded' })).toBe(
      'quota_monthly'
    )
  })

  it('429 + daily_cap_exceeded → quota_daily', () => {
    expect(classifyClueLlmFailure({ status: 429, workerError: 'daily_cap_exceeded' })).toBe(
      'quota_daily'
    )
  })

  it('429 + 其它 error → unknown', () => {
    expect(classifyClueLlmFailure({ status: 429, workerError: 'other' })).toBe('unknown')
  })

  it('401 → auth', () => {
    expect(classifyClueLlmFailure({ status: 401 })).toBe('auth')
  })

  it('503 + ai_provider_not_configured → not_configured', () => {
    expect(
      classifyClueLlmFailure({
        status: 503,
        workerError: 'ai_provider_not_configured'
      })
    ).toBe('not_configured')
  })

  it('503 + kv_not_configured → not_configured', () => {
    expect(classifyClueLlmFailure({ status: 503, workerError: 'kv_not_configured' })).toBe(
      'not_configured'
    )
  })

  it('500 → provider_error', () => {
    expect(classifyClueLlmFailure({ status: 500 })).toBe('provider_error')
  })

  it('其它 status → unknown', () => {
    expect(classifyClueLlmFailure({ status: 418, workerError: 'teapot' })).toBe('unknown')
  })
})

describe('HostedCompleteError / resolve helpers', () => {
  it('typed error 透传 kind 与配额快照', () => {
    const error = new HostedCompleteError('quota_monthly', 'quota_exceeded', {
      status: 429,
      quota: { used: 30, limit: 30, dailyUsed: 5, dailyLimit: 20 }
    })
    expect(resolveClueLlmFailureKindFromError(error)).toBe('quota_monthly')
    expect(resolveClueLlmFailureQuotaFromError(error)).toEqual({
      used: 30,
      limit: 30,
      dailyUsed: 5,
      dailyLimit: 20
    })
  })

  it('普通 TimeoutError → timeout；无配额', () => {
    const error = new Error('aborted')
    error.name = 'TimeoutError'
    expect(resolveClueLlmFailureKindFromError(error)).toBe('timeout')
    expect(resolveClueLlmFailureQuotaFromError(error)).toBeUndefined()
  })

  it('普通 Error → unknown', () => {
    expect(resolveClueLlmFailureKindFromError(new Error('boom'))).toBe('unknown')
  })
})
