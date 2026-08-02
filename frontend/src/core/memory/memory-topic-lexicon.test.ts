import { describe, expect, it } from 'vitest'

import { detectTopicsFromText, expandRecallContentTerms } from '@/core/memory/memory-topic-lexicon'

describe('detectTopicsFromText', () => {
  it('希特勒标题 → wwii keywords + Hitler 实体', () => {
    const result = detectTopicsFromText('希特勒死亡80年後 － BBC News 中文')
    expect(result.keywords).toEqual(expect.arrayContaining(['wwii', 'world war ii']))
    expect(result.entities).toEqual(expect.arrayContaining(['Hitler', 'BBC']))
  })

  it('仅「二战」→ wwii，不挂 Hitler 实体', () => {
    const result = detectTopicsFromText('二战纪录片剪辑')
    expect(result.keywords).toEqual(expect.arrayContaining(['wwii']))
    expect(result.entities).not.toContain('Hitler')
  })

  it('长春 + 失去增长 → economy + Changchun', () => {
    const result = detectTopicsFromText('长春会成为第一座破产省会吗？正在失去增长能力')
    expect(result.keywords).toEqual(expect.arrayContaining(['economy', 'city', 'growth']))
    expect(result.entities).toContain('Changchun')
  })
})

describe('expandRecallContentTerms', () => {
  it('二战扩成 English canonical，并保留原词', () => {
    expect(expandRecallContentTerms(['二战'])).toEqual(['二战', 'wwii', 'world war ii'])
  })

  it('wwii 扩成 world war ii', () => {
    expect(expandRecallContentTerms(['wwii'])).toEqual(['wwii', 'world war ii'])
  })
})
