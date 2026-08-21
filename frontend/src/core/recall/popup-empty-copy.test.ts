import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import { getPopupIdleEmptyCopy, getPopupNoMatchCopy } from '@/core/recall/popup-empty-copy'

/** Cold-start copy must not drift into assistant-style profiling. */
const FORBIDDEN =
  /get to know you|what you like|i['’]ll remember|assistant|decide for you|chat casually/i

describe('popup-empty-copy', () => {
  it('empty library idle: save a trace first', () => {
    const copy = getPopupIdleEmptyCopy('empty', false, testTranslateEn)
    expect(copy?.title).toBe('Save a first trace')
    expect(copy?.body).toMatch(/highlight|save selection/i)
    expect(copy?.body).toMatch(/recall/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('empty library while importing: saving is still encouraged', () => {
    const copy = getPopupIdleEmptyCopy('empty', true, testTranslateEn)
    expect(copy?.title).toBe('Save a first trace')
    expect(copy?.body).toMatch(/importing/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('ready library idle does not show the empty-state block', () => {
    expect(getPopupIdleEmptyCopy('ready', false, testTranslateEn)).toBeNull()
  })

  it('capture-first idle shows even when library is ready', () => {
    const copy = getPopupIdleEmptyCopy('ready', false, testTranslateEn, { captureFirst: true })
    expect(copy?.title).toBe('Save a line first')
    expect(copy?.body).toMatch(/getting started|highlight/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('capture-first idle while importing uses importing body', () => {
    const copy = getPopupIdleEmptyCopy('ready', true, testTranslateEn, { captureFirst: true })
    expect(copy?.body).toMatch(/importing/i)
  })

  it('empty library no_match: honest miss plus capture guidance', () => {
    const copy = getPopupNoMatchCopy(
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

  it('ready library no_match: honest终局，不暗示缩短再试', () => {
    const copy = getPopupNoMatchCopy(
      {
        library: 'ready',
        clue: 'a very long clue about retention analysis'
      },
      testTranslateEn
    )
    expect(copy.title).toContain('No match')
    expect(copy.body).toMatch(/trace|save/i)
    expect(copy.body).not.toMatch(/shorten|retry/i)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('R1 welcome copy stays focused on recall, not assistance', () => {
    expect(testTranslateEn('popup_welcome_title')).toBe('What are you trying to find?')
    expect(testTranslateEn('popup_welcome_body')).toMatch(/saved|find/i)
    expect(testTranslateEn('popup_welcome_body')).not.toMatch(FORBIDDEN)
  })
})
