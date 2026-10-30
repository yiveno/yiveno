import { describe, expect, it } from 'vitest'

import { classifyParseGoldFailure } from '@/core/recall/eval/classify-parse-gold-failure'

describe('classifyParseGoldFailure', () => {
  it('通过 → none', () => {
    expect(classifyParseGoldFailure({ passed: true, detail: 'ok' })).toBe('none')
  })

  it('解析失败前缀 → schema', () => {
    expect(
      classifyParseGoldFailure({
        passed: false,
        detail: '解析失败: Expected object, received null'
      })
    ).toBe('schema')
  })

  it('解析跳过前缀 → skip', () => {
    expect(
      classifyParseGoldFailure({
        passed: false,
        detail: '解析跳过: Invalid Authentication'
      })
    ).toBe('skip')
  })

  it('槽位 expect 文案 → slot', () => {
    expect(
      classifyParseGoldFailure({
        passed: false,
        detail: 'confidence 期望 high，实际 medium'
      })
    ).toBe('slot')
  })
})
