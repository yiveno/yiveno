import { describe, expect, it } from 'vitest'

import {
  deriveGettingStartedExcerptPhase,
  deriveGettingStartedProgress,
  isGettingStartedInventorySettling,
  shouldRefreshGettingStartedProgress
} from '@/pages/getting-started/getting-started-progress'
import {
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  FIRST_RECALL_OPEN_DONE_LOCAL_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'

describe('getting-started-progress', () => {
  it('有书签且召回成功 → ready + allDone', () => {
    expect(
      deriveGettingStartedProgress({
        bookmarkCount: 3,
        firstRecallOpenDone: true,
        inventorySettling: false
      })
    ).toEqual({
      canRecall: true,
      recallDone: true,
      allDone: true,
      libraryPhase: 'ready'
    })
  })

  it('有书签未召回 → ready 可点 Try recalling', () => {
    expect(
      deriveGettingStartedProgress({
        bookmarkCount: 1,
        firstRecallOpenDone: false,
        inventorySettling: true
      })
    ).toEqual({
      canRecall: true,
      recallDone: false,
      allDone: false,
      libraryPhase: 'ready'
    })
  })

  it('无书签且仍 settling → importing', () => {
    expect(
      deriveGettingStartedProgress({
        bookmarkCount: 0,
        firstRecallOpenDone: false,
        inventorySettling: true
      }).libraryPhase
    ).toBe('importing')
  })

  it('无书签且已结算 → empty', () => {
    expect(
      deriveGettingStartedProgress({
        bookmarkCount: 0,
        firstRecallOpenDone: false,
        inventorySettling: false
      }).libraryPhase
    ).toBe('empty')
  })

  it('仅 firstRecallOpenDone 即可 allDone（不要求 Capture）', () => {
    expect(
      deriveGettingStartedProgress({
        bookmarkCount: 0,
        firstRecallOpenDone: true,
        inventorySettling: false
      }).allDone
    ).toBe(true)
  })

  it('isGettingStartedInventorySettling：导入中为 true，完成/失败为 false', () => {
    expect(
      isGettingStartedInventorySettling({
        coldStartStatus: 'running',
        coldStartStage: 'import',
        importStatus: 'running'
      })
    ).toBe(true)
    expect(
      isGettingStartedInventorySettling({
        coldStartStatus: 'ready',
        coldStartStage: 'done',
        importStatus: 'completed'
      })
    ).toBe(false)
    expect(
      isGettingStartedInventorySettling({
        coldStartStatus: null,
        coldStartStage: null,
        importStatus: 'failed'
      })
    ).toBe(false)
  })

  it('deriveGettingStartedExcerptPhase：0=empty，有摘录=ready', () => {
    expect(deriveGettingStartedExcerptPhase(0)).toBe('empty')
    expect(deriveGettingStartedExcerptPhase(2)).toBe('ready')
  })

  it('shouldRefreshGettingStartedProgress 关心 firstRecall、摘录次数与 settings', () => {
    expect(
      shouldRefreshGettingStartedProgress(
        { [FIRST_RECALL_OPEN_DONE_LOCAL_KEY]: { newValue: true } },
        'local'
      )
    ).toBe(true)
    expect(
      shouldRefreshGettingStartedProgress(
        { [EXCERPT_CAPTURE_COUNT_LOCAL_KEY]: { newValue: 1 } },
        'local'
      )
    ).toBe(true)
    expect(
      shouldRefreshGettingStartedProgress({ 'yiveno.userSettings': { newValue: {} } }, 'local')
    ).toBe(true)
    expect(shouldRefreshGettingStartedProgress({}, 'session')).toBe(false)
  })
})
