import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useRecallOutcomeSession } from '@/pages/sidepanel/use-recall-outcome-session'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

const BASE_MISS = 'Nothing close enough turned up.'
const AI_PREFIX = 'Also: AI off. Please '
const AI_LINK = 'open Settings to turn on AI assistance'
const SIGN_PREFIX = 'Also: not signed in. Please '
const SIGN_LINK = 'open Settings to sign in'
const SUFFIX = ' first, then come back and find it.'
const STALE_PREFIX_TEMPLATE = 'Also: $COUNT$ new bookmarks. Please '
const BOOKMARK_LINK = 'Sync bookmarks'
const NOT_IMPORTED_PREFIX = 'Also: bookmarks not imported. Please '
const MISSING_TOPIC = 'Need a topic.'

function session(opts: {
  bookmarkCount?: number | null
  unsynced?: number | null
  fuel?: 'ingest_off' | 'importing' | 'ingest_on_empty'
}) {
  return useRecallOutcomeSession({
    bookmarkFuel: ref(opts.fuel ?? 'ingest_off'),
    bookmarkCount: ref(opts.bookmarkCount ?? 12),
    unsyncedBookmarkCount: ref(opts.unsynced ?? null),
    recallTelemetry: { recordUserConfirmed: vi.fn() } as never,
    onCompleteNewFindSession: vi.fn()
  })
}

describe('resolveMissAssistantCopy · 降级 + stale', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_miss: { message: BASE_MISS },
      popup_reply_miss_after_simpler_pass: { message: 'Simpler pass miss.' },
      popup_reply_miss_missing_topic: { message: MISSING_TOPIC },
      popup_miss_degraded_ai_off_prefix: { message: AI_PREFIX },
      popup_miss_degraded_ai_off_link: { message: AI_LINK },
      popup_miss_degraded_not_signed_in_prefix: { message: SIGN_PREFIX },
      popup_miss_degraded_not_signed_in_link: { message: SIGN_LINK },
      popup_miss_bookmarks_not_imported_prefix: { message: NOT_IMPORTED_PREFIX },
      popup_miss_bookmarks_not_imported_suffix: { message: SUFFIX },
      popup_miss_bookmarks_stale_prefix: {
        message: STALE_PREFIX_TEMPLATE,
        placeholders: { COUNT: { content: '$1' } }
      },
      popup_empty_import_bookmarks: { message: BOOKMARK_LINK },
      popup_empty_import_bookmarks_aria: { message: 'Open Settings for bookmarks' },
      popup_empty_library_empty_title: { message: 'Empty' },
      popup_empty_library_empty_body: { message: 'Empty body' },
      popup_empty_library_empty_body_prefix: { message: 'Your library is empty. ' },
      popup_empty_library_empty_body_suffix: {
        message: ' or save an excerpt first.'
      }
    })
  })

  it('ai_off → 降级段含 open_ai_settings', () => {
    const { resolveMissAssistantCopy } = session({})
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'that thing',
      degradedReason: 'ai_off'
    })
    expect(copy.text).toBe(`${BASE_MISS} ${AI_PREFIX}${AI_LINK}${SUFFIX}`)
    expect(copy.textSegments?.some(s => s.kind === 'open_ai_settings')).toBe(true)
  })

  it('not_signed_in → 降级段含 open_account_settings', () => {
    const { resolveMissAssistantCopy } = session({})
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'that thing',
      degradedReason: 'not_signed_in'
    })
    expect(copy.text).toBe(`${BASE_MISS} ${SIGN_PREFIX}${SIGN_LINK}${SUFFIX}`)
    expect(copy.textSegments?.some(s => s.kind === 'open_account_settings')).toBe(true)
  })

  it('stale：$COUNT$ 插值 + 书签链', () => {
    const { resolveMissAssistantCopy } = session({ unsynced: 3 })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'new bookmark'
    })
    expect(copy.text).toBe(`${BASE_MISS} Also: 3 new bookmarks. Please ${BOOKMARK_LINK}${SUFFIX}`)
    expect(copy.textSegments?.some(s => s.kind === 'open_bookmark_ingest_settings')).toBe(true)
  })

  it('降级 + stale 同时出现', () => {
    const { resolveMissAssistantCopy } = session({ unsynced: 2 })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'x',
      degradedReason: 'ai_off'
    })
    expect(copy.text).toContain(AI_LINK)
    expect(copy.text).toContain('Also: 2 new bookmarks')
    expect(copy.textSegments?.some(s => s.kind === 'open_ai_settings')).toBe(true)
    expect(copy.textSegments?.some(s => s.kind === 'open_bookmark_ingest_settings')).toBe(true)
  })

  it('两者都不成立 → 不追加', () => {
    const { resolveMissAssistantCopy } = session({ unsynced: 0 })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'x'
    })
    expect(copy.text).toBe(BASE_MISS)
    expect(copy.textSegments).toBeUndefined()
  })

  it('unsynced null → 不追加 stale 且不抛错', () => {
    const { resolveMissAssistantCopy } = session({ unsynced: null })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'x'
    })
    expect(copy.text).toBe(BASE_MISS)
  })

  it('空库 → 不追加降级段', () => {
    const { resolveMissAssistantCopy } = session({ bookmarkCount: 0, fuel: 'ingest_off' })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'empty',
      clue: 'x',
      degradedReason: 'ai_off'
    })
    expect(copy.text).not.toContain(AI_LINK)
  })

  it('missing_topic → 不追加降级段', () => {
    const { resolveMissAssistantCopy } = session({})
    const copy = resolveMissAssistantCopy({
      emptyKind: 'missing_topic',
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'x',
      degradedReason: 'ai_off'
    })
    expect(copy.text).toBe(MISSING_TOPIC)
  })

  it('书签未导入 + stale 同时成立时都显示', () => {
    const { resolveMissAssistantCopy } = session({
      bookmarkCount: 0,
      unsynced: 4,
      fuel: 'ingest_off'
    })
    const copy = resolveMissAssistantCopy({
      hasRelatedGuess: false,
      library: 'ready',
      clue: 'youtube'
    })
    expect(copy.text).toContain(NOT_IMPORTED_PREFIX)
    expect(copy.text).toContain('Also: 4 new bookmarks')
  })
})
