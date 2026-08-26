import { describe, expect, it } from 'vitest'

import { resolveThreadFindTitle, truncateThreadFindTitle } from './resolve-thread-anchor-label'

describe('truncateThreadFindTitle', () => {
  it('短标题原样返回', () => {
    expect(truncateThreadFindTitle('JavaScript')).toBe('JavaScript')
  })

  it('超长截断并加省略号', () => {
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
