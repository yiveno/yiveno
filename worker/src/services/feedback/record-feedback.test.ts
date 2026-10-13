import { describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import { recordFeedback } from './record-feedback'

function createKvMock() {
  const store = new Map<string, string>()
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string, _opts?: { expirationTtl?: number }) => {
      store.set(key, value)
    }
  }
}

describe('recordFeedback', () => {
  test('KV 成功 + 无 EMAIL → ok，email sink false', async () => {
    const kv = createKvMock()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reason: 'just_trying',
      note: 'hi'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sinks.kv).toBe(true)
    expect(result.sinks.email).toBe(false)
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    expect(keys).toHaveLength(1)
    const row = JSON.parse(kv.store.get(keys[0]!)!) as {
      source: string
      reasons: string[]
      reason: string
      note: string
    }
    expect(row.source).toBe('uninstall')
    expect(row.reasons).toEqual(['just_trying'])
    expect(row.reason).toBe('just_trying')
    expect(row.note).toBe('hi')
  })

  test('多选 reasons 写入', async () => {
    const kv = createKvMock()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reasons: ['didnt_find', 'bugs_or_slow']
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    const row = JSON.parse(kv.store.get(keys[0]!)!) as {
      reasons: string[]
      reason: string
    }
    expect(row.reasons).toEqual(['didnt_find', 'bugs_or_slow'])
    expect(row.reason).toBe('didnt_find')
  })

  test('scheduleEmail → 立即 ok 且 email deferred（不等待 send）', async () => {
    const kv = createKvMock()
    let scheduled = false
    let resolveSend!: (v: { messageId: string }) => void
    const hang = new Promise<{ messageId: string }>(resolve => {
      resolveSend = resolve
    })
    const env = {
      AI_USAGE_KV: kv,
      EMAIL: { send: async () => hang }
    } as unknown as Env
    const result = await recordFeedback(
      env,
      { source: 'uninstall', reason: 'other' },
      {
        scheduleEmail: task => {
          scheduled = true
          void task
        }
      }
    )
    expect(scheduled).toBe(true)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sinks.email).toBe('deferred')
    resolveSend({ messageId: 'msg-deferred' })
  })

  test('KV 成功 + EMAIL send → email sink true', async () => {
    const kv = createKvMock()
    const send = async () => ({ messageId: 'msg-1' })
    const env = {
      AI_USAGE_KV: kv,
      EMAIL: { send }
    } as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reason: 'didnt_find'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sinks.email).toBe(true)
  })

  test('无 KV → kv_unavailable', async () => {
    const env = {} as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reason: 'other'
    })
    expect(result).toEqual({ ok: false, error: 'kv_unavailable' })
  })

  test('EMAIL send 抛错仍整体 ok', async () => {
    const kv = createKvMock()
    const env = {
      AI_USAGE_KV: kv,
      EMAIL: {
        send: async () => {
          throw new Error('boom')
        }
      }
    } as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reason: 'other'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sinks.kv).toBe(true)
    expect(result.sinks.email).toBe(false)
  })

  test('context 写入 KV；邮件正文含运营字段且无 support@ 引导', async () => {
    const kv = createKvMock()
    let sentText = ''
    let sentHtml = ''
    const env = {
      AI_USAGE_KV: kv,
      EMAIL: {
        send: async (msg: { text: string; html: string }) => {
          sentText = msg.text
          sentHtml = msg.html
          return { messageId: 'msg-ctx' }
        }
      }
    } as unknown as Env
    const result = await recordFeedback(env, {
      source: 'uninstall',
      reasons: ['bugs_or_slow'],
      note: 'slow on open',
      context: {
        displayName: 'Ada',
        email: 'ada@example.com',
        ip: '203.0.113.9',
        userAgent: 'Mozilla/5.0 (test) Chrome/154.0.0.0',
        language: 'en-US',
        timezone: 'Asia/Shanghai',
        screen: '1440x900'
      }
    })
    expect(result.ok).toBe(true)
    const keys = [...kv.store.keys()].filter(k => k.startsWith('feedback:'))
    const row = JSON.parse(kv.store.get(keys[0]!)!) as {
      context: { displayName: string; ip: string }
    }
    expect(row.context.displayName).toBe('Ada')
    expect(row.context.ip).toBe('203.0.113.9')
    expect(sentText).toContain('Name:       Ada')
    expect(sentText).toContain('IP:         203.0.113.9')
    expect(sentText).toContain('Chrome 154.0.0.0')
    expect(sentText).toContain('Internal feedback (ops)')
    expect(sentText).not.toContain('support@yiveno.com')
    expect(sentHtml).toContain('<table')
    expect(sentHtml).toContain('Uninstall feedback')
    expect(sentHtml).toContain('Bugs or slow')
    expect(sentHtml).toContain('mailto:ada@example.com')
    expect(sentHtml).not.toContain('support@yiveno.com')
  })
})
