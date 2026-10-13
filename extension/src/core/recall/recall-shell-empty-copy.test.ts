import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  getRecallShellIdleEmptyCopy,
  getRecallShellNoMatchCopy
} from '@/core/recall/recall-shell-empty-copy'

/** Cold-start copy must not drift into assistant-style profiling. */
const FORBIDDEN =
  /get to know you|what you like|i['’]ll remember|assistant|decide for you|chat casually/i

describe('recall-shell-empty-copy', () => {
  it('empty library idle: save a trace first', () => {
    const copy = getRecallShellIdleEmptyCopy('empty', false, testTranslateEn)
    expect(copy?.title).toBe('Save a first trace')
    expect(copy?.body).toMatch(/highlight|save selection/i)
    expect(copy?.body).toMatch(/recall/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('empty library while importing: saving is still encouraged', () => {
    const copy = getRecallShellIdleEmptyCopy('empty', true, testTranslateEn)
    expect(copy?.title).toBe('Save a first trace')
    expect(copy?.body).toMatch(/importing/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('ready library idle does not show the empty-state block', () => {
    expect(getRecallShellIdleEmptyCopy('ready', false, testTranslateEn)).toBeNull()
  })

  it('capture-first idle shows even when library is ready', () => {
    const copy = getRecallShellIdleEmptyCopy('ready', false, testTranslateEn, {
      captureFirst: true
    })
    expect(copy?.title).toBe('Save a line first')
    expect(copy?.body).toMatch(/getting started|highlight/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('capture-first idle while importing uses importing body', () => {
    const copy = getRecallShellIdleEmptyCopy('ready', true, testTranslateEn, { captureFirst: true })
    expect(copy?.body).toMatch(/importing/i)
  })

  it('empty library no_match: honest miss plus capture guidance', () => {
    const copy = getRecallShellNoMatchCopy(
      {
        library: 'empty',
        clue: 'the song I used to love'
      },
      testTranslateEn
    )
    expect(copy.title).toBe('Nothing saved yet')
    expect(copy.body).toMatch(/trace|excerpt|note/i)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('ready library no_match: 诚实终局，不暗示缩短再试；线索全文保留', () => {
    const clue = 'a very long clue about retention analysis for public libraries'
    const copy = getRecallShellNoMatchCopy(
      {
        library: 'ready',
        clue
      },
      testTranslateEn
    )
    expect(copy.title).toContain('No match')
    expect(copy.title).toContain(clue)
    expect(copy.title).not.toMatch(/…/)
    expect(copy.body).toMatch(/trace|save/i)
    expect(copy.body).not.toMatch(/shorten|retry/i)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('R1 welcome copy stays focused on recall, not assistance', () => {
    expect(testTranslateEn('popup_welcome_title')).toBe('What do you want to recall?')
    expect(testTranslateEn('popup_welcome_body')).toMatch(/remember|detail|starter/i)
    expect(testTranslateEn('popup_welcome_body')).not.toMatch(FORBIDDEN)
  })
})
