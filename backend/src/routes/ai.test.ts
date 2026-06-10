import { describe, expect, test } from 'bun:test'
import { createApp } from '../app'
import type { Env } from '../types/env'

const baseEnv = {
  JWT_SECRET: 'test-secret',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  WEBSITE_URL: 'https://example.com',
  AI: {
    run: async (model: string, params: unknown) => ({
      model,
      params,
      answer: 'ok'
    })
  }
} as Env

describe('ai routes', () => {
  test('GET /api/ai/complete rejects request without prompt or messages', async () => {
    const app = createApp()
    const response = await app.request('/api/ai/complete', {}, baseEnv)

    expect(response.status).toBe(400)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('missing prompt or messages')
  })

  test('GET /api/ai/complete forwards prompt query to AI binding', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/complete?prompt=hello&model=test-model',
      {},
      baseEnv
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      model: string
      params: {
        prompt: string
        stream: boolean
        temperature: number
        max_tokens: number
      }
      answer: string
    }

    expect(data.model).toBe('test-model')
    expect(data.params.prompt).toBe('hello')
    expect(data.params.stream).toBe(false)
    expect(data.answer).toBe('ok')
  })

  test('POST /api/ai/complete supports messages payload', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/complete',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'summarize this' }],
          temperature: 0.2,
          max_tokens: 64
        })
      },
      baseEnv
    )

    expect(response.status).toBe(200)

    const data = (await response.json()) as {
      params: {
        messages: Array<{ role: string; content: string }>
        temperature: number
        max_tokens: number
      }
    }

    expect(data.params.messages).toEqual([{ role: 'user', content: 'summarize this' }])
    expect(data.params.temperature).toBe(0.2)
    expect(data.params.max_tokens).toBe(64)
  })

  test('GET /api/ai/complete returns event stream when stream=true', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/complete?prompt=hello&stream=true',
      {
        headers: {
          origin: 'https://ottersage.com'
        }
      },
      {
        ...baseEnv,
        AI: {
          run: async () => 'data: hello\n\n'
        }
      } as unknown as Env
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(response.headers.get('access-control-allow-origin')).toBe('https://ottersage.com')
    expect(await response.text()).toBe('data: hello\n\n')
  })

  test('POST /api/ai/complete returns 500 when AI binding throws', async () => {
    const app = createApp()
    const response = await app.request(
      '/api/ai/complete',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          prompt: 'hello'
        })
      },
      {
        ...baseEnv,
        AI: {
          run: async () => {
            throw new Error('ai backend unavailable')
          }
        }
      } as unknown as Env
    )

    expect(response.status).toBe(500)

    const data = (await response.json()) as { error: string }
    expect(data.error).toBe('ai backend unavailable')
  })
})
