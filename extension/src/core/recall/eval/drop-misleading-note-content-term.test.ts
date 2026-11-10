import { describe, expect, it } from 'vitest'

import { dropMisleadingNoteContentTerm } from '@/core/recall/understand/ground-llm-parse-slots'
import { normalizeRecallText } from '@/core/recall/keyword-filter'

describe('dropMisleadingNoteContentTerm', () => {
  it('货币 × note 构造：货币名词剥掉 note，真实附注保留', () => {
    const strip = (clue: string) =>
      dropMisleadingNoteContentTerm(normalizeRecallText(clue), ['note', 'extra'])

    for (const clue of [
      'dollar note',
      'five pound note',
      'a ten dollar note',
      'million pound note',
      'pound note',
      'bank note',
      'euro note'
    ]) {
      expect(strip(clue), clue).not.toContain('note')
    }

    for (const clue of ['my note about the meeting', 'the note I left on the fridge']) {
      expect(strip(clue), clue).toContain('note')
    }
  })
})
