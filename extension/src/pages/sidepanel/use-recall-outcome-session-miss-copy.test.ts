import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useRecallOutcomeSession } from '@/pages/sidepanel/use-recall-outcome-session'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

const REJECTED_NOISE_COPY =
  "That didn't look like a memory clue. Try describing what you remember — what it was about, or when you saw it."

describe('resolveMissAssistantCopy · rejected_noise', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_miss_rejected_noise: { message: REJECTED_NOISE_COPY },
      popup_empty_library_empty_title: { message: 'Nothing saved yet' },
      popup_empty_library_empty_body: {
        message: 'Your library is empty. Sync bookmarks or save an excerpt first.'
      },
      popup_empty_library_empty_body_prefix: { message: 'Your library is empty. ' },
      popup_empty_library_empty_body_suffix: {
        message: ' or save an excerpt first, then try again in your own words.'
      },
      popup_empty_import_bookmarks: { message: 'Sync bookmarks' },
      popup_empty_import_bookmarks_aria: { message: 'Open Settings to turn on bookmark sync' },
      popup_reply_miss: { message: 'Nothing close enough turned up.' }
    })
  })

  it('空库 + rejected_noise：专属文案，不回显 clue', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      recallTelemetry: {
        recordUserConfirmed: vi.fn()
      } as never,
      onCompleteNewFindSession: vi.fn()
    })

    const clue = 'asdfg aksdjhaksjhd'
    const copy = resolveMissAssistantCopy({
      emptyKind: 'rejected_noise',
      hasRelatedGuess: false,
      library: 'empty',
      clue
    })

    expect(copy.text).toBe(REJECTED_NOISE_COPY)
    expect(copy.text).not.toContain(clue)
    expect(copy.textSegments).toBeUndefined()
  })
})

describe('resolveMissAssistantCopy · chitchat', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_miss_rejected_noise: { message: REJECTED_NOISE_COPY },
      popup_empty_library_empty_title: { message: 'Nothing saved yet' },
      popup_empty_library_empty_body: {
        message: 'Your library is empty. Sync bookmarks or save an excerpt first.'
      },
      popup_empty_library_empty_body_prefix: { message: 'Your library is empty. ' },
      popup_empty_library_empty_body_suffix: {
        message: ' or save an excerpt first, then try again in your own words.'
      },
      popup_empty_import_bookmarks: { message: 'Sync bookmarks' },
      popup_empty_import_bookmarks_aria: { message: 'Open Settings to turn on bookmark sync' },
      popup_reply_miss: { message: 'Nothing close enough turned up.' }
    })
  })

  it('chitchat + 有 assistantReply → 返回该回复原文，不回显 clue', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      recallTelemetry: {
        recordUserConfirmed: vi.fn()
      } as never,
      onCompleteNewFindSession: vi.fn()
    })

    const clue = '今天天气不错'
    const reply = '天气不错——有想找的东西吗？'
    const copy = resolveMissAssistantCopy({
      emptyKind: 'chitchat',
      hasRelatedGuess: false,
      library: 'ready',
      clue,
      assistantReply: reply
    })

    expect(copy.text).toBe(reply)
    expect(copy.text).not.toContain(clue)
    expect(copy.textSegments).toBeUndefined()
  })

  it('chitchat + 无 assistantReply → 回落通用 miss 文案（不 crash）', () => {
    const { resolveMissAssistantCopy } = useRecallOutcomeSession({
      bookmarkFuel: ref('ingest_off'),
      recallTelemetry: {
        recordUserConfirmed: vi.fn()
      } as never,
      onCompleteNewFindSession: vi.fn()
    })

    const copy = resolveMissAssistantCopy({
      emptyKind: 'chitchat',
      hasRelatedGuess: false,
      library: 'ready',
      clue: '今天天气不错'
    })

    expect(copy.text).toBe('Nothing close enough turned up.')
  })
})
