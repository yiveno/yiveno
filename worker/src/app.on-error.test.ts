import { describe, expect, test } from 'bun:test'

import { createApp } from './app'
import type { Env } from './types/env'

describe('createApp onError', () => {
  test('未捕获异常 → 500 且 body 含 requestId', async () => {
    const app = createApp()
    app.get('/__test_on_error', () => {
      throw new Error('boom_for_on_error')
    })

    const res = await app.request(
      '/__test_on_error',
      { headers: { 'cf-ray': 'test-ray-123' } },
      {} as Env
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string; requestId?: string }
    expect(body.error).toBe('Internal Server Error')
    expect(body.requestId).toBe('test-ray-123')
    expect(res.headers.get('x-request-id')).toBe('test-ray-123')
  })
})
