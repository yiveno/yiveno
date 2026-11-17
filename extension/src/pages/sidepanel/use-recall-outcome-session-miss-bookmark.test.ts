import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useRecallOutcomeSession } from '@/pages/sidepanel/use-recall-outcome-session'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

const BASE_MISS = 'Nothing close enough turned up.'
const PREFIX = 'Also: bookmarks not imported. Please '
const LINK = 'Sync bookmarks'
const SUFFIX = ' first, then come back.'
const IMPORTING = 'Also: bookmarks still importing.'

describe('resolveMissAssistantCopy · 书签语料为空追加段', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_miss: { message: BASE_MISS },
      popup_reply_miss_after_simpler_pass: { message: 'Simpler pass miss.' },
      popup_miss_bookmarks_not_imported_prefix: { message: PREFIX },
      popup_miss_bookmarks_not_imported_suffix: { message: SUFFIX },
      popup_miss_bookmarks_importing: { message: IMPORTING },
      popup_empty_import_bookmarks: { message: LINK }
    })
  })

  it('ready + 0 书签 + ingest_off → 追加导入段（含 Settings 链）', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      bookmarkCount: ref(0),
      unsyncedBookmarkCount: ref(null),
      recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
      onCompleteNewFindSession: vi.fn()
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toBe(`${BASE_MISS} ${PREFIX}${LINK}${SUFFIX}`)
    expect(copy.textSegments?.some(s => s.kind === 'open_bookmark_ingest_settings')).toBe(true)
  })

  it('ready + 0 书签 + importing → 追加导入中段（无链）', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('importing'),
      bookmarkCount: ref(0),
      unsyncedBookmarkCount: ref(null),
      recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
      onCompleteNewFindSession: vi.fn()
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toBe(`${BASE_MISS} ${IMPORTING}`)
    expect(copy.textSegments?.some(s => s.kind === 'open_bookmark_ingest_settings')).toBeFalsy()
  })

  it('ready + 0 书签 + ingest_on_empty → 不追加', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_on_empty'),
      bookmarkCount: ref(0),
      unsyncedBookmarkCount: ref(null),
      recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
      onCompleteNewFindSession: vi.fn()
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toBe(BASE_MISS)
    expect(copy.textSegments).toBeUndefined()
  })

  it('ready + 有书签 → 不追加', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      bookmarkCount: ref(12),
      unsyncedBookmarkCount: ref(null),
      recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
      onCompleteNewFindSession: vi.fn()
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toBe(BASE_MISS)
    expect(copy.textSegments).toBeUndefined()
  })

  it('计数失败（null）→ 不追加且不抛错', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      bookmarkCount: ref(null),
      unsyncedBookmarkCount: ref(null),
      recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
      onCompleteNewFindSession: vi.fn()
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toBe(BASE_MISS)
    expect(copy.textSegments).toBeUndefined()
  })
})
