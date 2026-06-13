import { describe, expect, it } from 'vitest'
import {
  countQueryGraphemes,
  hasAdequateSemanticQueryLength
} from '@/core/filter/semantic-query-signal'

describe('semantic-query-signal', () => {
  it('统计中文 grapheme 数', () => {
    expect(countQueryGraphemes('乐')).toBe(1)
    expect(countQueryGraphemes('历史')).toBe(2)
    expect(countQueryGraphemes(' 听歌 ')).toBe(2)
  })

  it('单字查询不足以触发语义补位', () => {
    expect(hasAdequateSemanticQueryLength('乐')).toBe(false)
    expect(hasAdequateSemanticQueryLength('1')).toBe(false)
  })

  it('双字及以上查询可触发语义补位', () => {
    expect(hasAdequateSemanticQueryLength('历史')).toBe(true)
    expect(hasAdequateSemanticQueryLength('听歌')).toBe(true)
  })
})
