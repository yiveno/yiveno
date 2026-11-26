import { describe, expect, it, vi } from 'vitest'

import {
  buildTopicJudgeUserMessage,
  isIndeterminateExpectedTopic,
  judgeTopicSemantic,
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

  it('indeterminate 期望识别', () => {
    expect(isIndeterminateExpectedTopic('无法确定具体主题')).toBe(true)
    expect(isIndeterminateExpectedTopic('房价相关内容，具体主题不明')).toBe(true)
    expect(isIndeterminateExpectedTopic('indeterminate / unspecified')).toBe(true)
    expect(isIndeterminateExpectedTopic('嫩鸡胸肉做法')).toBe(false)
  })

  it('D02 类：indeterminate + 空 terms → 确定性 match，不调 LLM', async () => {
    const complete = vi.fn(async () => '{"match":false,"reason":"should not run"}')
    const result = await judgeTopicSemantic({
      clue: '那个我收藏的，之前说过的那个东西，你帮我找一下。',
      expectedTopic: '无法确定具体主题',
      actualTopicTerms: [],
      complete
    })
    expect(result.match).toBe(true)
    expect(result.reason).toContain('确定性约定')
    expect(complete).not.toHaveBeenCalled()
  })

  it('具体主题 + 空 terms → 确定性失败，不调 LLM', async () => {
    const complete = vi.fn(async () => '{"match":true,"reason":"should not run"}')
    const result = await judgeTopicSemantic({
      clue: '之前那个鸡胸肉视频',
      expectedTopic: '嫩鸡胸肉做法',
      actualTopicTerms: [],
      complete
    })
    expect(result.match).toBe(false)
    expect(result.reason).toContain('为空')
    expect(complete).not.toHaveBeenCalled()
  })
})
