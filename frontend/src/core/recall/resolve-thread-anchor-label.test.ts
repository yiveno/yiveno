import { describe, expect, it } from 'vitest'

import { resolveThreadFindTitle, truncateThreadFindTitle } from './resolve-thread-anchor-label'

describe('truncateThreadFindTitle', () => {
  it('短标题原样返回', () => {
    expect(truncateThreadFindTitle('JavaScript')).toBe('JavaScript')
  })

  it('默认安全上限内不截断（布局省略交给 CSS）', () => {
    const mid = 'JSTOR public libraries / civic infrastructure for communities'
    expect(truncateThreadFindTitle(mid)).toBe(mid)
  })

  it('超安全上限才尾省略', () => {
    const long = 'a'.repeat(250)
    const out = truncateThreadFindTitle(long)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBe(200)
  })

  it('显式 maxChars 仍可截断', () => {
    const long = 'a'.repeat(50)
    const out = truncateThreadFindTitle(long, 40)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBe(40)
  })
})

describe('resolveThreadFindTitle', () => {
  it('优先首轮用户句作为会话标题', () => {
    expect(
      resolveThreadFindTitle({
        priorUserUtterances: ['JavaScript', 'history'],
        contentTerms: ['other']
      })
    ).toBe('JavaScript')
  })

  it('中长首轮句保留全文（不固定 40 字截断）', () => {
    const clue = 'JSTOR public libraries / civic infrastructure for communities'
    expect(
      resolveThreadFindTitle({
        priorUserUtterances: [clue],
        contentTerms: []
      })
    ).toBe(clue)
  })

  it('无 prior 时用 contentTerms', () => {
    expect(
      resolveThreadFindTitle({
        priorUserUtterances: [],
        contentTerms: ['eloquent', 'javascript']
      })
    ).toBe('eloquent javascript')
  })

  it('全空 → null', () => {
    expect(resolveThreadFindTitle({ priorUserUtterances: [], contentTerms: [] })).toBeNull()
  })
})
