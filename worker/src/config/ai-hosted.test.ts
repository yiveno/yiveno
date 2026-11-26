import { describe, expect, test } from 'bun:test'

import {
  isDeepSeekAiGatewayEnabled,
  isQuotaExemptUser,
  resolveDeepSeekChatCompletionsUrl
} from './ai-hosted'

describe('isQuotaExemptUser', () => {
  test('未设 env → false', () => {
    expect(isQuotaExemptUser({}, 'user-a')).toBe(false)
  })

  test('空字符串 → false', () => {
    expect(isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: '' }, 'user-a')).toBe(false)
    expect(isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: '   ' }, 'user-a')).toBe(false)
  })

  test('单 id 命中 → true', () => {
    expect(isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'user-a' }, 'user-a')).toBe(true)
  })

  test('多 id 逗号分隔含空格命中 → true', () => {
    expect(
      isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: ' user-a , user-b ,user-c ' }, 'user-b')
    ).toBe(true)
  })

  test('名单外 → false', () => {
    expect(isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'user-a,user-b' }, 'user-z')).toBe(
      false
    )
  })

  test('子串不算命中', () => {
    expect(isQuotaExemptUser({ AI_HOSTED_QUOTA_EXEMPT_USER_IDS: 'ab' }, 'abc')).toBe(false)
  })
})

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
