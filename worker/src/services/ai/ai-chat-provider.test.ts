import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import { resolveAiChatProvider } from './ai-chat-provider'
import { AiProviderError } from './ai-provider-error'

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

  test('gateway-compat → gateway compat adapter', () => {
    expect(resolveAiChatProvider(env({ AI_PROVIDER: 'gateway-compat' })).id).toBe('gateway-compat')
    expect(resolveAiChatProvider(env({ AI_PROVIDER: 'Gateway-Compat' })).id).toBe('gateway-compat')
  })

  test('未知 provider 抛 AiProviderError(misconfigured)', () => {
    try {
      resolveAiChatProvider(env({ AI_PROVIDER: 'openai' }))
      expect.unreachable('应抛错')
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError)
      const e = err as AiProviderError
      expect(e.kind).toBe('misconfigured')
      expect(e.message).toBe('ai_provider_unsupported:openai')
    }
  })
})
