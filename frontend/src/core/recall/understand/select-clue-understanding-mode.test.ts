import { describe, expect, it } from 'vitest'

import {
  selectClueUnderstandingMode,
  shouldEscalateLexicalNoMatch
} from '@/core/recall/understand/select-clue-understanding-mode'

describe('selectClueUnderstandingMode', () => {
  it('短英文专名 / URL → lexical', () => {
    expect(selectClueUnderstandingMode('Cloudflare Workers')).toBe('lexical')
    expect(selectClueUnderstandingMode('github.com/cqw')).toBe('lexical')
    expect(selectClueUnderstandingMode('https://example.com/a')).toBe('lexical')
  })

  it('长口语 / 疑问 → semantic', () => {
    expect(
      selectClueUnderstandingMode(
        "I recently came across a news article about a legal case. I've forgotten all the other details. Could you please help me find it?"
      )
    ).toBe('semantic')
    expect(selectClueUnderstandingMode('The movie that I watched yesterday')).toBe('semantic')
  })

  it('中文相对时间 / 短口语 → semantic（避免无空格被当成单 token 词面）', () => {
    expect(selectClueUnderstandingMode('前天的电影')).toBe('semantic')
    expect(selectClueUnderstandingMode('昨天看的那篇文章')).toBe('semantic')
    expect(selectClueUnderstandingMode('帮我找上周的代码')).toBe('semantic')
  })

  it('孤立短汉字类型词仍 lexical（避免「电影」二字误升）', () => {
    expect(selectClueUnderstandingMode('电影')).toBe('lexical')
    expect(selectClueUnderstandingMode('文章')).toBe('lexical')
  })
})

describe('shouldEscalateLexicalNoMatch', () => {
  it('口语 / 时间信号 / 中文短句可升', () => {
    expect(shouldEscalateLexicalNoMatch('前天的电影')).toBe(true)
    expect(shouldEscalateLexicalNoMatch('day before yesterday movie')).toBe(true)
    expect(shouldEscalateLexicalNoMatch('obscure legal phrase here')).toBe(true)
  })

  it('URL 与短英文专名不升', () => {
    expect(shouldEscalateLexicalNoMatch('https://example.com')).toBe(false)
    expect(shouldEscalateLexicalNoMatch('Cloudflare Workers')).toBe(false)
    expect(shouldEscalateLexicalNoMatch('电影')).toBe(false)
  })
})
