import { describe, expect, test } from 'bun:test'

import { isDeepSeekAiGatewayEnabled, resolveDeepSeekChatCompletionsUrl } from './ai-hosted'

describe('resolveDeepSeekChatCompletionsUrl', () => {
  test('未配 Gateway → 直连 DeepSeek /v1/chat/completions', () => {
    expect(resolveDeepSeekChatCompletionsUrl({})).toBe(
      'https://api.deepseek.com/v1/chat/completions'
    )
    expect(
      resolveDeepSeekChatCompletionsUrl({
        DEEPSEEK_API_BASE: 'https://api.deepseek.com/'
      })
    ).toBe('https://api.deepseek.com/v1/chat/completions')
    expect(isDeepSeekAiGatewayEnabled({})).toBe(false)
  })

  test('已配 account + gateway → AI Gateway DeepSeek 路径', () => {
    const env = {
      AI_GATEWAY_ACCOUNT_ID: 'acc123',
      AI_GATEWAY_ID: 'yiveno',
      // Gateway 优先，直连 base 被忽略
      DEEPSEEK_API_BASE: 'https://api.deepseek.com'
    }
    expect(isDeepSeekAiGatewayEnabled(env)).toBe(true)
    expect(resolveDeepSeekChatCompletionsUrl(env)).toBe(
      'https://gateway.ai.cloudflare.com/v1/acc123/yiveno/deepseek/chat/completions'
    )
  })

  test('DEEPSEEK_API_BASE 已是 Gateway provider 根时补 chat/completions', () => {
    expect(
      resolveDeepSeekChatCompletionsUrl({
        DEEPSEEK_API_BASE: 'https://gateway.ai.cloudflare.com/v1/acc/gw/deepseek'
      })
    ).toBe('https://gateway.ai.cloudflare.com/v1/acc/gw/deepseek/chat/completions')
  })
})
