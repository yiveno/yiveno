import { describe, expect, it } from 'vitest'

import { reinforceRecentlySavedBehavior } from '@/core/recall/parse-recall-clue'
import { normalizeRecallText } from '@/core/recall/keyword-filter'

describe('reinforceRecentlySavedBehavior', () => {
  it('近期副词 × 保存动词组合：新组合触发，填充词不触发', () => {
    const has = (clue: string) =>
      reinforceRecentlySavedBehavior(normalizeRecallText(clue), []).includes('recently_saved')

    for (const clue of [
      'freshly saved',
      'just archived',
      'recently kept',
      'recently collected',
      'just saved',
      'newly saved'
    ]) {
      expect(has(clue), clue).toBe(true)
    }

    for (const clue of [
      'saved a long time ago',
      'just the article I saved yesterday',
      'recently read the article'
    ]) {
      expect(has(clue), clue).toBe(false)
    }
  })
})
