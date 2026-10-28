import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  getRecallShellIdleEmptyCopy,
  getRecallShellNoMatchCopy,
  resolveRecallShellBookmarkFuel,
  shouldShowRecallEmptyImportCta,
  shouldShowRecallEmptySetupCta
} from '@/core/recall/recall-shell-empty-copy'

/** Cold-start copy must not drift into assistant-style profiling. */
const FORBIDDEN =
  /get to know you|what you like|i['’]ll remember|assistant|decide for you|chat casually/i

describe('resolveRecallShellBookmarkFuel', () => {
  it('开关关 → ingest_off（忽略导入状态）', () => {
    expect(
      resolveRecallShellBookmarkFuel({
        bookmarkIngestEnabled: false,
        importStatus: 'running'
      })
    ).toBe('ingest_off')
  })

  it('开关开 + pending/running → importing', () => {
    expect(
      resolveRecallShellBookmarkFuel({
        bookmarkIngestEnabled: true,
        importStatus: 'pending'
      })
    ).toBe('importing')
    expect(
      resolveRecallShellBookmarkFuel({
        bookmarkIngestEnabled: true,
        importStatus: 'running'
      })
    ).toBe('importing')
  })

  it('开关开 + 终态/无状态 → ingest_on_empty', () => {
    expect(
      resolveRecallShellBookmarkFuel({
        bookmarkIngestEnabled: true,
        importStatus: 'completed'
      })
    ).toBe('ingest_on_empty')
    expect(
      resolveRecallShellBookmarkFuel({
        bookmarkIngestEnabled: true,
        importStatus: null
      })
    ).toBe('ingest_on_empty')
  })
})

describe('recall-shell-empty-copy', () => {
  it('empty library idle · ingest_off: 双路径（书签或划存）+ 导入深链片段', () => {
    const copy = getRecallShellIdleEmptyCopy('empty', testTranslateEn, {
      bookmarkFuel: 'ingest_off'
    })
    expect(copy?.title).toBe('Nothing in your library yet')
    expect(copy?.body).toMatch(/sync.*bookmark|bookmark.*sync/i)
    expect(copy?.body).toMatch(/highlight|save/i)
    expect(copy?.body).toMatch(/recall/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
    expect(copy?.bodySegments?.some(s => s.kind === 'open_bookmark_ingest_settings')).toBe(true)
    expect(
      shouldShowRecallEmptyImportCta({
        library: 'empty',
        captureFirst: false,
        bookmarkFuel: 'ingest_off'
      })
    ).toBe(true)
  })

  it('empty library idle · importing: 同步中仍鼓励划存', () => {
    const copy = getRecallShellIdleEmptyCopy('empty', testTranslateEn, {
      bookmarkFuel: 'importing'
    })
    expect(copy?.title).toBe('Nothing in your library yet')
    expect(copy?.body).toMatch(/syncing/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
    expect(
      shouldShowRecallEmptyImportCta({
        library: 'empty',
        captureFirst: false,
        bookmarkFuel: 'importing'
      })
    ).toBe(false)
  })

  it('empty library idle · ingest_on_empty: 已开仍空，导向划存/设置', () => {
    const copy = getRecallShellIdleEmptyCopy('empty', testTranslateEn, {
      bookmarkFuel: 'ingest_on_empty'
    })
    expect(copy?.body).toMatch(/empty|highlight|save|getting started/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
    expect(
      shouldShowRecallEmptySetupCta({
        library: 'empty',
        captureFirst: false,
        bookmarkFuel: 'ingest_on_empty'
      })
    ).toBe(true)
  })

  it('ready library idle does not show the empty-state block', () => {
    expect(getRecallShellIdleEmptyCopy('ready', testTranslateEn)).toBeNull()
  })

  it('capture-first idle shows even when library is ready', () => {
    const copy = getRecallShellIdleEmptyCopy('ready', testTranslateEn, {
      captureFirst: true
    })
    expect(copy?.title).toBe('Save a line first')
    expect(copy?.body).toMatch(/getting started|highlight/i)
    expect(copy?.body).not.toMatch(FORBIDDEN)
  })

  it('capture-first idle while importing uses syncing body', () => {
    const copy = getRecallShellIdleEmptyCopy('ready', testTranslateEn, {
      captureFirst: true,
      bookmarkFuel: 'importing'
    })
    expect(copy?.body).toMatch(/syncing/i)
  })

  it('empty library no_match · ingest_off: 诚实空库 + 双路径 + 导入深链', () => {
    const copy = getRecallShellNoMatchCopy(
      {
        library: 'empty',
        clue: 'the song I used to love',
        bookmarkFuel: 'ingest_off'
      },
      testTranslateEn
    )
    expect(copy.title).toBe('Nothing saved yet')
    expect(copy.body).toMatch(/empty|import|excerpt|bookmark/i)
    expect(copy.body).not.toMatch(FORBIDDEN)
    const link = copy.bodySegments?.find(s => s.kind === 'open_bookmark_ingest_settings')
    expect(link?.text).toBe('Sync bookmarks')
  })

  it('empty library no_match · importing / ingest_on_empty 分流', () => {
    const importing = getRecallShellNoMatchCopy(
      { library: 'empty', clue: 'x', bookmarkFuel: 'importing' },
      testTranslateEn
    )
    expect(importing.body).toMatch(/syncing/i)

    const onEmpty = getRecallShellNoMatchCopy(
      { library: 'empty', clue: 'x', bookmarkFuel: 'ingest_on_empty' },
      testTranslateEn
    )
    expect(onEmpty.body).toMatch(/highlight|save|empty/i)
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
    expect(copy.body).toMatch(/detail|stuck|trace|save/i)
    expect(copy.body).not.toMatch(/shorten|retry/i)
    expect(copy.body).not.toMatch(FORBIDDEN)
  })

  it('R1 welcome copy stays focused on recall, not assistance', () => {
    expect(testTranslateEn('popup_welcome_title')).toBe('What do you want to recall?')
    expect(testTranslateEn('popup_welcome_body')).toMatch(/remember|detail|starter/i)
    expect(testTranslateEn('popup_welcome_body')).not.toMatch(FORBIDDEN)
  })
})
