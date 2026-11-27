/**
 * AiProviderError：分类 / Retry-After / 脱敏。
 */
import { describe, expect, test } from 'bun:test'
import {
  AiProviderError,
  classifyAiProviderError,
  classifyFetchFailure,
  parseRetryAfterMs,
  pickRateLimitHeaders,
  sanitizeAiProviderDetails
} from './ai-provider-error'

describe('classifyAiProviderError', () => {
  test('402 / 余额不足 → payment_required', () => {
    expect(classifyAiProviderError({ status: 402, message: 'Payment Required' })).toBe(
      'payment_required'
    )
    expect(
      classifyAiProviderError({
        status: 400,
        message: 'Insufficient Balance',
        vendorCode: 'insufficient_quota'
      })
    ).toBe('payment_required')
  })

  test('401 / 403 → auth_failed', () => {
    expect(classifyAiProviderError({ status: 401, vendorCode: '2009' })).toBe('auth_failed')
    expect(classifyAiProviderError({ status: 403, message: 'forbidden' })).toBe('auth_failed')
  })

  test('429 + 日额度语义 → quota_exhausted_daily；其余 429 → rate_limit_minute', () => {
    expect(
      classifyAiProviderError({
        status: 429,
        vendorCode: 'quota_exceeded',
        details: { reason: 'GenerateRequestsPerDay' }
      })
    ).toBe('quota_exhausted_daily')
    expect(
      classifyAiProviderError({
        status: 429,
        message: 'You exceeded your current quota per day'
      })
    ).toBe('quota_exhausted_daily')
    expect(
      classifyAiProviderError({
        status: 429,
        vendorCode: 'rate_limit_exceeded',
        message: 'Rate limit reached for RPM'
      })
    ).toBe('rate_limit_minute')
    expect(classifyAiProviderError({ status: 429 })).toBe('rate_limit_minute')
  })

  test('408 / 超时文案 → timeout；5xx → upstream_5xx', () => {
    expect(classifyAiProviderError({ status: 408 })).toBe('timeout')
    expect(classifyAiProviderError({ status: 504, message: 'gateway timeout' })).toBe('timeout')
    expect(classifyAiProviderError({ status: 503, message: 'overloaded' })).toBe('upstream_5xx')
    expect(classifyAiProviderError({ status: 500 })).toBe('upstream_5xx')
  })

  test('forcedKind 覆盖 status', () => {
    expect(classifyAiProviderError({ status: 429, forcedKind: 'empty_response' })).toBe(
      'empty_response'
    )
    expect(classifyAiProviderError({ status: 200, forcedKind: 'invalid_response' })).toBe(
      'invalid_response'
    )
    expect(classifyAiProviderError({ status: 200, forcedKind: 'misconfigured' })).toBe(
      'misconfigured'
    )
    expect(classifyAiProviderError({ forcedKind: 'network' })).toBe('network')
    expect(classifyAiProviderError({ forcedKind: 'unknown' })).toBe('unknown')
  })
})

describe('classifyFetchFailure', () => {
  test('AbortError → timeout；其余 → network', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(classifyFetchFailure(abort)).toBe('timeout')
    expect(classifyFetchFailure(new Error('fetch failed'))).toBe('network')
  })
})

describe('parseRetryAfterMs', () => {
  test('Retry-After 秒数', () => {
    expect(parseRetryAfterMs({ 'retry-after': '21' })).toBe(21_000)
    expect(parseRetryAfterMs(new Headers({ 'Retry-After': '1.5' }))).toBe(1500)
  })

  test('Retry-After HTTP 日期', () => {
    const future = new Date(Date.now() + 30_000).toUTCString()
    const ms = parseRetryAfterMs({ 'retry-after': future })
    expect(ms).toBeDefined()
    expect(ms!).toBeGreaterThan(20_000)
    expect(ms!).toBeLessThanOrEqual(35_000)
  })

  test('Google details.retryDelay 形如 21s', () => {
    expect(
      parseRetryAfterMs(null, {
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '21s' }]
      })
    ).toBe(21_000)
    expect(parseRetryAfterMs(undefined, { retryDelay: '500ms' })).toBe(500)
  })

  test('解析失败 → undefined', () => {
    expect(parseRetryAfterMs({ 'retry-after': 'not-a-date' })).toBeUndefined()
    expect(parseRetryAfterMs(null, { foo: 'bar' })).toBeUndefined()
  })
})

describe('sanitizeAiProviderDetails / pickRateLimitHeaders', () => {
  test('假 key / Authorization / prompt 被剥离或打码', () => {
    const fakeKey = 'sk-testFAKEKEY1234567890abcdef'
    const sanitized = sanitizeAiProviderDetails({
      code: 'rate_limit_exceeded',
      api_key: fakeKey,
      authorization: `Bearer ${fakeKey}`,
      prompt: 'secret user prompt body',
      message: `quota hit with ${fakeKey}`,
      retryDelay: '21s',
      remaining: 0
    }) as Record<string, unknown>

    const blob = JSON.stringify(sanitized)
    expect(blob).not.toContain(fakeKey)
    expect(blob).not.toContain('secret user prompt body')
    expect(blob).not.toContain('Bearer ')
    expect(sanitized).not.toHaveProperty('api_key')
    expect(sanitized).not.toHaveProperty('authorization')
    expect(sanitized).not.toHaveProperty('prompt')
    expect(sanitized.code).toBe('rate_limit_exceeded')
    expect(sanitized.retryDelay).toBe('21s')
    expect(sanitized.remaining).toBe(0)
  })

  test('限额头只保留白名单键', () => {
    const headers = pickRateLimitHeaders(
      new Headers({
        'Retry-After': '12',
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-remaining-tokens': '100',
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '2s',
        authorization: 'Bearer secret',
        'x-request-id': 'abc'
      })
    )
    expect(headers).toEqual({
      'retry-after': '12',
      'x-ratelimit-remaining-requests': '0',
      'x-ratelimit-remaining-tokens': '100',
      'x-ratelimit-reset-requests': '1s',
      'x-ratelimit-reset-tokens': '2s'
    })
    expect(JSON.stringify(headers)).not.toContain('Bearer')
    expect(JSON.stringify(headers)).not.toContain('abc')
  })
})

describe('AiProviderError', () => {
  test('message === causeMessage；字段可机读', () => {
    const err = new AiProviderError({
      kind: 'rate_limit_minute',
      providerId: 'gateway-compat',
      vendor: 'groq',
      model: 'groq/llama',
      status: 429,
      vendorCode: 'rate_limit_exceeded',
      retryAfterMs: 12_000,
      causeMessage: 'gateway_compat_upstream_groq:slow down'
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AiProviderError')
    expect(err.message).toBe('gateway_compat_upstream_groq:slow down')
    expect(err.causeMessage).toBe(err.message)
    expect(err.kind).toBe('rate_limit_minute')
    expect(err.status).toBe(429)
    expect(err.vendorCode).toBe('rate_limit_exceeded')
    expect(err.retryAfterMs).toBe(12_000)
  })
})
