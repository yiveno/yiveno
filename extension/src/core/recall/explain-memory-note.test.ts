/**
 * Dreaming Phase 4 · memory_note Explain（sole-corroboration / token）。
 */

import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  explainRecallMatch,
  findMatchedClueToken,
  pickPrimaryMatchedField
} from '@/core/recall/explain-recall-match'

const t = testTranslateEn

describe('explain-memory-note', () => {
  it('sole 时 primary 强制为 memory_note（即使 embedding 也在场）', () => {
    expect(
      pickPrimaryMatchedField(['embedding', 'memory_note'], { soleNoteCorroboration: true })
    ).toBe('memory_note')

    const explanation = explainRecallMatch(
      {
        clue: 'rottnest quokka',
        matchedFields: ['embedding', 'memory_note'],
        noteMatchedTerms: ['rottnest', 'quokka'],
        soleNoteCorroboration: true
      },
      t
    )
    expect(explanation.primary.toLowerCase()).toContain('restated note')
    expect(explanation.primary.toLowerCase()).toContain('rottnest')
  })

  it('token 取 matchedTerms[0]', () => {
    expect(
      findMatchedClueToken({
        clue: 'rottnest quokka wildlife',
        primaryField: 'memory_note',
        noteMatchedTerms: ['rottnest', 'quokka']
      })
    ).toBe('rottnest')
  })

  it('无 matchedTerms 时走不带 token 的字段相关文案，不编造 token', () => {
    expect(
      findMatchedClueToken({
        clue: 'rottnest quokka',
        primaryField: 'memory_note'
      })
    ).toBeNull()

    const explanation = explainRecallMatch(
      {
        clue: 'rottnest quokka',
        matchedFields: ['memory_note'],
        soleNoteCorroboration: true
      },
      t
    )
    expect(explanation.primary.toLowerCase()).toContain('restated note')
    expect(explanation.primary.toLowerCase()).not.toContain('rottnest')
  })
})
