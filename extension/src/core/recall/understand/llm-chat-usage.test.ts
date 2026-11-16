import { describe, expect, it } from 'vitest'

import { EMPTY_LLM_CHAT_USAGE, parseLlmChatUsage } from '@/core/recall/understand/llm-chat-usage'

describe('parseLlmChatUsage', () => {
  it('空 / 非对象 → 全 null', () => {
    expect(parseLlmChatUsage(null)).toEqual(EMPTY_LLM_CHAT_USAGE)
    expect(parseLlmChatUsage(undefined)).toEqual(EMPTY_LLM_CHAT_USAGE)
  })

  it('snake_case 拆分（上游 OpenAI 兼容）', () => {
    expect(
      parseLlmChatUsage({
        prompt_tokens: 12,
        completion_tokens: 34,
        total_tokens: 46
      })
    ).toEqual({ promptTokens: 12, completionTokens: 34, totalTokens: 46 })
  })

  it('camelCase / tokensUsed（Worker 响应）', () => {
    expect(
      parseLlmChatUsage({
        promptTokens: 7,
        completionTokens: 3,
        tokensUsed: 10
      })
    ).toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 10 })
  })

  it('缺字段记 null，禁止推算', () => {
    expect(parseLlmChatUsage({ prompt_tokens: 5 })).toEqual({
      promptTokens: 5,
      completionTokens: null,
      totalTokens: null
    })
  })
})
