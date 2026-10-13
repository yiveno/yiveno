import { describe, expect, it } from 'vitest'

import {
  collectThreadAnchorTerms,
  shouldOfferThreadPivotConfirm,
  THREAD_PIVOT_COOLDOWN_MS
} from './should-offer-thread-pivot-confirm'

describe('collectThreadAnchorTerms', () => {
  it('合并 accumulated 与 prior 句 contentTerms 并去重', () => {
    const terms = collectThreadAnchorTerms({
      contentTerms: ['javascript'],
      priorUserUtterances: ['JavaScript history']
    })
    expect(terms).toEqual(expect.arrayContaining(['javascript', 'history']))
  })
})

describe('shouldOfferThreadPivotConfirm', () => {
  const anchor = ['javascript']

  it('短收窄词不弹', () => {
    expect(
      shouldOfferThreadPivotConfirm({
        clue: 'history',
        anchorTerms: anchor,
        lastSubmitAtMs: 1_000,
        nowMs: 2_000
      })
    ).toBe(false)
  })

  it('与锚点有字面重叠不弹', () => {
    expect(
      shouldOfferThreadPivotConfirm({
        clue: 'eloquent javascript book',
        anchorTerms: anchor,
        lastSubmitAtMs: 1_000,
        nowMs: 2_000
      })
    ).toBe(false)
  })

  it('明显无关长线索弹确认', () => {
    expect(
      shouldOfferThreadPivotConfirm({
        clue: 'The movie I watched yesterday',
        anchorTerms: anchor,
        lastSubmitAtMs: 1_000,
        nowMs: 2_000
      })
    ).toBe(true)
  })

  it('冷却后多词无重叠弹确认', () => {
    expect(
      shouldOfferThreadPivotConfirm({
        clue: 'that purple notebook',
        anchorTerms: anchor,
        lastSubmitAtMs: 1_000,
        nowMs: 1_000 + THREAD_PIVOT_COOLDOWN_MS + 1
      })
    ).toBe(true)
  })

  it('无锚点词不弹', () => {
    expect(
      shouldOfferThreadPivotConfirm({
        clue: 'The movie I watched yesterday',
        anchorTerms: [],
        lastSubmitAtMs: null,
        nowMs: 5_000
      })
    ).toBe(false)
  })
})
