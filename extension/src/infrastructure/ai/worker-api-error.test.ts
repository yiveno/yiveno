import { describe, expect, it } from 'vitest'

import {
  WorkerApiError,
  buildWorkerApiErrorDetail,
  parseWorkerErrorResponse
} from '@/infrastructure/ai/worker-api-error'

describe('buildWorkerApiErrorDetail', () => {
  it('quota_exceeded free/pro 今日用量', () => {
    expect(
      buildWorkerApiErrorDetail({
        code: 'quota_exceeded',
        tier: 'free',
        used: 100,
        limit: 100
      })
    ).toBe('free，今日 100/100，UTC 午夜重置')
  })

  it('quota_exceeded anonymous 终身', () => {
    expect(
      buildWorkerApiErrorDetail({
        code: 'quota_exceeded',
        tier: 'anonymous',
        used: 30,
        limit: 30
      })
    ).toBe('匿名，终身 30/30，登录后恢复')
  })

  it('embed_failed 按 cause', () => {
    expect(buildWorkerApiErrorDetail({ code: 'embed_failed', cause: 'ai_run_failed' })).toBe(
      '上游模型调用失败'
    )
    expect(buildWorkerApiErrorDetail({ code: 'embed_failed' })).toBeUndefined()
  })

  it('invalid_token 按 reason', () => {
    expect(buildWorkerApiErrorDetail({ code: 'invalid_token', reason: 'revoked' })).toBe(
      '设备会话已撤销，请重新登录'
    )
    expect(buildWorkerApiErrorDetail({ code: 'invalid_token' })).toBeUndefined()
  })

  it('Internal Server Error 带 requestId', () => {
    expect(
      buildWorkerApiErrorDetail({
        code: 'Internal Server Error',
        requestId: 'req-1'
      })
    ).toBe('服务端内部错误，requestId: req-1')
  })
})

describe('parseWorkerErrorResponse', () => {
  it('解析配额体全字段', () => {
    const response = new Response(
      JSON.stringify({
        error: 'quota_exceeded',
        tier: 'free',
        used: 100,
        limit: 100,
        remaining: 0,
        dailyUsed: 100,
        dailyLimit: 100,
        dailyRemaining: 0
      }),
      { status: 429 }
    )
    const err = parseWorkerErrorResponse(response, {
      error: 'quota_exceeded',
      tier: 'free',
      used: 100,
      limit: 100,
      remaining: 0,
      dailyUsed: 100,
      dailyLimit: 100,
      dailyRemaining: 0
    })
    expect(err).toBeInstanceOf(WorkerApiError)
    expect(err.message).toBe('quota_exceeded')
    expect(err.status).toBe(429)
    expect(err.tier).toBe('free')
    expect(err.used).toBe(100)
    expect(err.limit).toBe(100)
    expect(err.remaining).toBe(0)
    expect(err.dailyUsed).toBe(100)
    expect(err.dailyLimit).toBe(100)
    expect(err.dailyRemaining).toBe(0)
    expect(err.detail).toBe('free，今日 100/100，UTC 午夜重置')
  })

  it('无 error 字段回退 http_<status>', () => {
    const response = new Response('{}', { status: 502 })
    const err = parseWorkerErrorResponse(response, {})
    expect(err.message).toBe('http_502')
    expect(err.status).toBe(502)
  })

  it('requestId：body 优先，header 兜底', () => {
    const withBody = parseWorkerErrorResponse(
      new Response('{}', {
        status: 500,
        headers: { 'x-request-id': 'from-header' }
      }),
      { error: 'Internal Server Error', requestId: 'from-body' }
    )
    expect(withBody.requestId).toBe('from-body')
    expect(withBody.detail).toContain('from-body')

    const withHeader = parseWorkerErrorResponse(
      new Response('{}', {
        status: 500,
        headers: { 'x-request-id': 'from-header' }
      }),
      { error: 'Internal Server Error' }
    )
    expect(withHeader.requestId).toBe('from-header')
  })
})
