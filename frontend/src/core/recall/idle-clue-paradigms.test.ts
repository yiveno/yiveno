import { describe, expect, it } from 'vitest'

import {
  listIdleClueParadigmSpecs,
  shouldShowIdleClueParadigms
} from '@/core/recall/idle-clue-paradigms'

describe('idle-clue-paradigms', () => {
  it('listIdleClueParadigmSpecs 固定 3 条句式 id', () => {
    const specs = listIdleClueParadigmSpecs()
    expect(specs).toHaveLength(3)
    expect(specs.map(s => s.id)).toEqual(['content_and_time', 'note_anchor', 'saved_when'])
    expect(specs.every(s => s.clueMessageKey.startsWith('popup_idle_paradigm_'))).toBe(true)
  })

  it('shouldShowIdleClueParadigms：仅空线程 + 库 ready + 非 Capture-first', () => {
    expect(
      shouldShowIdleClueParadigms({
        hasConversationTurns: false,
        captureFirst: false,
        library: 'ready'
      })
    ).toBe(true)
    expect(
      shouldShowIdleClueParadigms({
        hasConversationTurns: true,
        captureFirst: false,
        library: 'ready'
      })
    ).toBe(false)
    expect(
      shouldShowIdleClueParadigms({
        hasConversationTurns: false,
        captureFirst: true,
        library: 'ready'
      })
    ).toBe(false)
    expect(
      shouldShowIdleClueParadigms({
        hasConversationTurns: false,
        captureFirst: false,
        library: 'empty'
      })
    ).toBe(false)
  })
})
