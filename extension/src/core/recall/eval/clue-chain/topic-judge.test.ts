import { describe, expect, it } from 'vitest'

import {
  buildTopicJudgeUserMessage,
  parseTopicJudgeResponse
} from '@/core/recall/eval/clue-chain/topic-judge'

describe('clue-chain topic-judge（无真 LLM）', () => {
  it('解析标准 JSON', () => {
    const result = parseTopicJudgeResponse('{"match":true,"reason":"same subject"}')
    expect(result.match).toBe(true)
    expect(result.reason).toContain('same')
  })

  it('容忍前后杂质文本', () => {
    const result = parseTopicJudgeResponse('Here you go:\n{"match":false,"reason":"different"}\n')
    expect(result.match).toBe(false)
  })

  it('畸形 → match false', () => {
    const result = parseTopicJudgeResponse('not json')
    expect(result.match).toBe(false)
    expect(result.reason).toContain('judge 解析失败')
  })

  it('user message 含 clue / expected / actual', () => {
    const text = buildTopicJudgeUserMessage({
      clue: '鸡胸肉视频',
      expectedTopic: '嫩鸡胸肉',
      actualTopicTerms: ['鸡胸肉', '煎']
    })
    expect(text).toContain('鸡胸肉视频')
    expect(text).toContain('嫩鸡胸肉')
    expect(text).toContain('鸡胸肉')
  })
})
