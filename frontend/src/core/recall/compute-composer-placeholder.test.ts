import { describe, expect, it } from 'vitest'

import {
  COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED,
  computeComposerPlaceholder
} from '@/core/recall/compute-composer-placeholder'

describe('computeComposerPlaceholder', () => {
  it('空闲 → idle e.g. 模板', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: true,
        rankedTotalCount: 0,
        chipsPresent: false
      })
    ).toEqual({
      mode: 'idle',
      messageKey: 'popup_clue_placeholder',
      messageArgs: []
    })
  })

  it('有芯片 → neutral 让位（即使 N 很大）', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'uncertain',
        rankedTotalCount: 20,
        chipsPresent: true,
        narrowExamples: ['code', 'video']
      })
    ).toEqual({
      mode: 'neutral',
      messageKey: 'popup_clue_placeholder_neutral',
      messageArgs: []
    })
  })

  it('miss → neutral', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'miss',
        rankedTotalCount: 0,
        chipsPresent: false
      }).mode
    ).toBe('neutral')
  })

  it(`宽邻域 N≥${COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED} 无芯片 → narrow generic（P0a）`, () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'confident',
        rankedTotalCount: COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED,
        chipsPresent: false
      })
    ).toEqual({
      mode: 'narrow',
      messageKey: 'popup_clue_placeholder_narrow_generic',
      messageArgs: []
    })
  })

  it('宽邻域 + 两个举例 → narrow 插值 key', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'confident',
        rankedTotalCount: 11,
        chipsPresent: false,
        narrowExamples: ['code', 'video']
      })
    ).toEqual({
      mode: 'narrow',
      messageKey: 'popup_clue_placeholder_narrow',
      messageArgs: ['code', 'video']
    })
  })

  it('N 不足 → neutral', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'confident',
        rankedTotalCount: 5,
        chipsPresent: false
      }).mode
    ).toBe('neutral')
  })

  it('有线程锚点 → narrow 点名文案', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'confident',
        rankedTotalCount: 11,
        chipsPresent: false,
        narrowExamples: ['history', 'eloquent'],
        threadLabel: 'JavaScript'
      })
    ).toEqual({
      mode: 'narrow',
      messageKey: 'popup_clue_placeholder_narrow_threaded',
      messageArgs: ['JavaScript', 'history', 'eloquent']
    })
  })

  it('有线程锚点 + 芯片 → neutral 点名', () => {
    expect(
      computeComposerPlaceholder({
        isIdle: false,
        assistantTone: 'uncertain',
        rankedTotalCount: 3,
        chipsPresent: true,
        threadLabel: 'JavaScript'
      })
    ).toEqual({
      mode: 'neutral',
      messageKey: 'popup_clue_placeholder_neutral_threaded',
      messageArgs: ['JavaScript']
    })
  })
})
