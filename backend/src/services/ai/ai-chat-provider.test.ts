import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import { resolveAiChatProvider } from './ai-chat-provider'

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    DEEPSEEK_API_KEY: 'k',
    ...overrides
  } as unknown as Env
}

describe('resolveAiChatProvider', () => {
  test('默认 / 空 / deepseek → deepseek adapter', () => {
    expect(resolveAiChatProvider(env()).id).toBe('deepseek')
    expect(resolveAiChatProvider(env({ AI_PROVIDER: '' })).id).toBe('deepseek')
    expect(resolveAiChatProvider(env({ AI_PROVIDER: 'DeepSeek' })).id).toBe('deepseek')
  })

  test('未知 provider 抛错', () => {
    expect(() => resolveAiChatProvider(env({ AI_PROVIDER: 'openai' }))).toThrow(
      'ai_provider_unsupported:openai'
    )
  })
})
