import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter-weights'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

const recordOpenConfirmOutcomePair = vi.fn()
const handleRecordMemoryOpen = vi.fn()
const navigateTabToUrl = vi.fn()
const openRecallSidePanel = vi.fn()
const showVoiceRecallNotification = vi.fn()
const showVoiceRecallPageOrNotify = vi.fn()
const writeVoiceRecallHandoff = vi.fn()
const getUserSettings = vi.fn()
const recallWithClue = vi.fn()
const ensureOffscreenDocumentForUserMedia = vi.fn()
const getVoiceCommandCacheSnapshot = vi.fn()
const loadVoiceCommandCache = vi.fn()
const patchVoiceCommandCacheMicGranted = vi.fn()
const writeVoiceMicGranted = vi.fn()

vi.mock('@/application/recall/record-open-confirm-outcome', () => ({
  recordOpenConfirmOutcomePair: (...args: unknown[]) => recordOpenConfirmOutcomePair(...args)
}))

vi.mock('@/background/handlers/memory-handler', () => ({
  handleRecordMemoryOpen: (...args: unknown[]) => handleRecordMemoryOpen(...args)
}))

vi.mock('@/infrastructure/browser/navigate-tab', () => ({
  navigateTabToUrl: (...args: unknown[]) => navigateTabToUrl(...args)
}))

vi.mock('@/infrastructure/browser/side-panel', () => ({
  openRecallSidePanel: (...args: unknown[]) => openRecallSidePanel(...args)
}))

vi.mock('@/infrastructure/browser/voice-recall-notification', () => ({
  showVoiceRecallNotification: (...args: unknown[]) => showVoiceRecallNotification(...args)
}))

vi.mock('@/infrastructure/browser/voice-recall-page-feedback', () => ({
  showVoiceRecallPageOrNotify: (...args: unknown[]) => showVoiceRecallPageOrNotify(...args)
}))

vi.mock('@/infrastructure/storage/voice-recall-handoff-storage', () => ({
  writeVoiceRecallHandoff: (...args: unknown[]) => writeVoiceRecallHandoff(...args)
}))

vi.mock('@/infrastructure/storage/voice-mic-granted-storage', () => ({
  writeVoiceMicGranted: (...args: unknown[]) => writeVoiceMicGranted(...args)
}))

vi.mock('@/infrastructure/browser/voice-command-cache', () => ({
  getVoiceCommandCacheSnapshot: (...args: unknown[]) => getVoiceCommandCacheSnapshot(...args),
  loadVoiceCommandCache: (...args: unknown[]) => loadVoiceCommandCache(...args),
  patchVoiceCommandCacheMicGranted: (...args: unknown[]) =>
    patchVoiceCommandCacheMicGranted(...args)
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: (...args: unknown[]) => getUserSettings(...args)
}))

vi.mock('@/application/recall/recall-service', () => ({
  recallService: {
    recallWithClue: (...args: unknown[]) => recallWithClue(...args)
  }
}))

vi.mock('@/infrastructure/browser/ensure-offscreen-document', () => ({
  ensureOffscreenDocumentForUserMedia: (...args: unknown[]) =>
    ensureOffscreenDocumentForUserMedia(...args)
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'

function bookmarkMatch(title: string, url: string, score: number): RecallMatch {
  const item = createBookmarkMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    payload: { title, url },
    clues: {}
  })
  return { item, score, matchedFields: ['title'] }
}

function topPickResult(overrides?: Partial<RecallResult>): RecallResult {
  return {
    outcome: 'top_pick',
    topPick: bookmarkMatch(
      'Retention',
      'https://example.com/retention',
      RECALL_TOP_PICK_MIN_SCORE + 20
    ),
    alsoPossible: [],
    totalRankedCount: 1,
    clue: 'retention notes',
    ...overrides
  }
}

describe('voice-recall-open 无信度门 + 学习信号', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://id/${path}`,
        sendMessage: vi.fn()
      },
      i18n: {
        getMessage: (key: string, subs?: string | string[]) => {
          if (key === 'voice_recall_notification_opened_body') {
            return `Heard: ${Array.isArray(subs) ? subs[0] : subs}`
          }
          if (key === 'voice_recall_notification_no_match') {
            return 'no match'
          }
          if (key === 'voice_recall_notification_unclear') {
            return 'unclear'
          }
          if (key === 'voice_recall_notification_mic_grant_guide') {
            return 'mic guide'
          }
          if (key === 'voice_recall_notification_candidates_ready') {
            return 'candidates ready'
          }
          return key
        },
        getUILanguage: () => 'en-US'
      }
    })
    getUserSettings.mockResolvedValue({
      voiceRecallOpenEnabled: true,
      uiLocalePreference: 'system'
    })
    getVoiceCommandCacheSnapshot.mockReturnValue({
      ready: true,
      voiceRecallOpenEnabled: true,
      micGranted: true
    })
    loadVoiceCommandCache.mockResolvedValue(undefined)
    handleRecordMemoryOpen.mockResolvedValue({ ok: true })
    writeVoiceRecallHandoff.mockResolvedValue(undefined)
    writeVoiceMicGranted.mockResolvedValue(undefined)
    openRecallSidePanel.mockResolvedValue(undefined)
    showVoiceRecallNotification.mockResolvedValue(true)
    showVoiceRecallPageOrNotify.mockResolvedValue('banner')
    navigateTabToUrl.mockResolvedValue({ id: 42 })
    ensureOffscreenDocumentForUserMedia.mockResolvedValue(true)
  })

  it('pickVoiceRecallOpenCandidate：topPick 优先，否则 alsoPossible[0]', async () => {
    const { pickVoiceRecallOpenCandidate } = await import('@/application/recall/voice-recall-open')
    const top = bookmarkMatch('A', 'https://a.example', 50)
    const also = bookmarkMatch('B', 'https://b.example', 40)
    expect(
      pickVoiceRecallOpenCandidate(topPickResult({ topPick: top, alsoPossible: [also] }))
    ).toBe(top)
    expect(
      pickVoiceRecallOpenCandidate({
        outcome: 'need_a_clue',
        topPick: null,
        alsoPossible: [also],
        totalRankedCount: 1,
        clue: 'x'
      })
    ).toBe(also)
    expect(
      pickVoiceRecallOpenCandidate({
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: 'x'
      })
    ).toBeNull()
  })

  it('自动打开成功：不写 open_confirm；导航成功后写一次 memory open', async () => {
    const { autoOpenRecallCandidate, pickVoiceRecallOpenCandidate } =
      await import('@/application/recall/voice-recall-open')
    const result = topPickResult()
    const candidate = pickVoiceRecallOpenCandidate(result)!
    const out = await autoOpenRecallCandidate(candidate, 'retention notes')
    expect(out.opened).toBe(true)
    expect(recordOpenConfirmOutcomePair).not.toHaveBeenCalled()
    expect(handleRecordMemoryOpen).toHaveBeenCalledTimes(1)
    expect(handleRecordMemoryOpen).toHaveBeenCalledWith({ id: candidate.item.id })
    expect(navigateTabToUrl).toHaveBeenCalledWith(
      'https://example.com/retention',
      'newForegroundTab'
    )
    expect(showVoiceRecallNotification).toHaveBeenCalled()
  })

  it('分差 9：仍自动打开首选（无信度门）', async () => {
    const top = bookmarkMatch('A', 'https://a.example/gap9', RECALL_TOP_PICK_MIN_SCORE + 9)
    const second = bookmarkMatch('B', 'https://b.example', RECALL_TOP_PICK_MIN_SCORE)
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'gap nine',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce(
      topPickResult({
        topPick: top,
        alsoPossible: [second],
        totalRankedCount: 2,
        clue: 'gap nine'
      })
    )

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(navigateTabToUrl).toHaveBeenCalledWith('https://a.example/gap9', 'newForegroundTab')
    expect(handleRecordMemoryOpen).toHaveBeenCalledWith({ id: top.item.id })
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
  })

  it('低分 topPick：仍自动打开', async () => {
    const low = bookmarkMatch('Low', 'https://low.example', RECALL_TOP_PICK_MIN_SCORE - 20)
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'low score',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce(
      topPickResult({
        outcome: 'need_a_clue',
        topPick: low,
        alsoPossible: [],
        totalRankedCount: 1,
        clue: 'low score'
      })
    )

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(navigateTabToUrl).toHaveBeenCalledWith('https://low.example', 'newForegroundTab')
    expect(handleRecordMemoryOpen).toHaveBeenCalledWith({ id: low.item.id })
  })

  it('仅 alsoPossible：打开第一个', async () => {
    const first = bookmarkMatch('Only', 'https://only.example', 12)
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'only also',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce({
      outcome: 'need_a_clue',
      topPick: null,
      alsoPossible: [first],
      totalRankedCount: 1,
      clue: 'only also'
    } satisfies RecallResult)

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(navigateTabToUrl).toHaveBeenCalledWith('https://only.example', 'newForegroundTab')
    expect(handleRecordMemoryOpen).toHaveBeenCalledWith({ id: first.item.id })
  })

  it('零候选：只通知 no_match，不打开', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'zzzz nothing',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce({
      outcome: 'no_match',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 0,
      clue: 'zzzz nothing'
    } satisfies RecallResult)

    const { handleVoiceRecallOpenCommand, isVoiceRecallEmptyNoMatch } =
      await import('@/application/recall/voice-recall-open')
    expect(
      isVoiceRecallEmptyNoMatch({
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: 'x'
      })
    ).toBe(true)

    await handleVoiceRecallOpenCommand()

    expect(showVoiceRecallPageOrNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'no match' })
    )
    expect(showVoiceRecallNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'no match' })
    )
    expect(navigateTabToUrl).not.toHaveBeenCalled()
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
    expect(openRecallSidePanel).not.toHaveBeenCalled()
  })

  it('自动打开导航失败：不写 open_confirm / memory open；交接反馈不开面板', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'retention notes',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce(topPickResult())
    navigateTabToUrl.mockRejectedValueOnce(new Error('NAVIGATE_URL_INVALID'))

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(recordOpenConfirmOutcomePair).not.toHaveBeenCalled()
    expect(handleRecordMemoryOpen).not.toHaveBeenCalled()
    expect(showVoiceRecallNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Heard:')
      })
    )
    expect(writeVoiceRecallHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'show_result', clue: 'retention notes' })
    )
    expect(showVoiceRecallPageOrNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'candidates ready',
        openSidePanelOnClick: true
      })
    )
    expect(openRecallSidePanel).not.toHaveBeenCalled()
  })

  it('缓存 micGranted=false：同步开面板并写 start_dictation，不调 offscreen', async () => {
    getVoiceCommandCacheSnapshot.mockReturnValue({
      ready: true,
      voiceRecallOpenEnabled: true,
      micGranted: false
    })
    let openCalledBeforeHandoff = false
    openRecallSidePanel.mockImplementation(() => {
      openCalledBeforeHandoff = !writeVoiceRecallHandoff.mock.calls.length
      return Promise.resolve()
    })

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(openCalledBeforeHandoff).toBe(true)
    expect(openRecallSidePanel).toHaveBeenCalledTimes(1)
    expect(writeVoiceRecallHandoff).toHaveBeenCalledWith({ kind: 'start_dictation' })
    expect(ensureOffscreenDocumentForUserMedia).not.toHaveBeenCalled()
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('缓存 micGranted=true 且听写 aborted：只发 unclear 页内反馈，不开面板', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: false,
      error: 'aborted'
    }))

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(showVoiceRecallPageOrNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unclear' })
    )
    expect(openRecallSidePanel).not.toHaveBeenCalled()
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
    expect(patchVoiceCommandCacheMicGranted).not.toHaveBeenCalled()
  })

  it('缓存未 ready：补载后走 offscreen，仍不开面板', async () => {
    getVoiceCommandCacheSnapshot
      .mockReturnValueOnce({
        ready: false,
        voiceRecallOpenEnabled: true,
        micGranted: null
      })
      .mockReturnValueOnce({
        ready: true,
        voiceRecallOpenEnabled: true,
        micGranted: false
      })
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: false,
      error: 'not_allowed'
    }))

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(loadVoiceCommandCache).toHaveBeenCalled()
    expect(ensureOffscreenDocumentForUserMedia).toHaveBeenCalled()
    expect(openRecallSidePanel).not.toHaveBeenCalled()
    expect(showVoiceRecallNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mic guide',
        openSidePanelOnClick: true
      })
    )
  })

  it('offscreen 文档创建失败：只发 unclear 页内反馈，不开面板、不写 handoff', async () => {
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(false)

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(ensureOffscreenDocumentForUserMedia).toHaveBeenCalled()
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
    expect(openRecallSidePanel).not.toHaveBeenCalled()
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
    expect(showVoiceRecallPageOrNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unclear' })
    )
  })
})
