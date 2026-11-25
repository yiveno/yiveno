import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { RECALL_TOP_PICK_MIN_SCORE } from '@/core/recall/keyword-filter-weights'
import type { RecallResult } from '@/core/recall/recall-result'

const recordOpenConfirmOutcomePair = vi.fn()
const handleRecordMemoryOpen = vi.fn()
const navigateTabToUrl = vi.fn()
const openRecallSidePanel = vi.fn()
const showVoiceRecallNotification = vi.fn()
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

function topPickResult(overrides?: Partial<RecallResult>): RecallResult {
  const item = createBookmarkMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    payload: { title: 'Retention', url: 'https://example.com/retention' },
    clues: {}
  })
  return {
    outcome: 'top_pick',
    topPick: {
      item,
      score: RECALL_TOP_PICK_MIN_SCORE + 20,
      matchedFields: ['title']
    },
    alsoPossible: [],
    totalRankedCount: 1,
    clue: 'retention notes',
    ...overrides
  }
}

function needClueResult(): RecallResult {
  const item = createBookmarkMemoryItem({
    ownerId: OWNER,
    sourceLocalProfileId: PROFILE,
    payload: { title: 'Maybe', url: 'https://example.com/maybe' },
    clues: {}
  })
  return {
    outcome: 'need_a_clue',
    topPick: {
      item,
      score: RECALL_TOP_PICK_MIN_SCORE - 5,
      matchedFields: ['title']
    },
    alsoPossible: [
      {
        item,
        score: RECALL_TOP_PICK_MIN_SCORE - 8,
        matchedFields: ['title']
      }
    ],
    totalRankedCount: 2,
    clue: 'vague clue'
  }
}

describe('voice-recall-open 手势安全与学习信号', () => {
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
  })

  it('自动打开成功：不写 open_confirm；导航成功后写一次 memory open', async () => {
    navigateTabToUrl.mockResolvedValueOnce({ id: 42 })
    const { autoOpenRecallTopPick } = await import('@/application/recall/voice-recall-open')
    const result = topPickResult()
    const out = await autoOpenRecallTopPick(result, 'retention notes')
    expect(out.opened).toBe(true)
    expect(recordOpenConfirmOutcomePair).not.toHaveBeenCalled()
    expect(handleRecordMemoryOpen).toHaveBeenCalledTimes(1)
    expect(handleRecordMemoryOpen).toHaveBeenCalledWith({ id: result.topPick!.item.id })
    expect(navigateTabToUrl).toHaveBeenCalledWith(
      'https://example.com/retention',
      'newForegroundTab'
    )
    expect(showVoiceRecallNotification).toHaveBeenCalled()
  })

  it('自动打开导航失败：不写 open_confirm / memory open；交接通知不开面板', async () => {
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(true)
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
    expect(showVoiceRecallNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'candidates ready',
        openSidePanelOnClick: true
      })
    )
    expect(openRecallSidePanel).not.toHaveBeenCalled()
  })

  it('no_match 零候选：只通知，不触发面板交接', async () => {
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(true)
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

    expect(showVoiceRecallNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'no match' })
    )
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
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

  it('缓存 micGranted=true 且听写 aborted：只发 unclear 通知，不开面板', async () => {
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(true)
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: false,
      error: 'aborted'
    }))

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await handleVoiceRecallOpenCommand()

    expect(showVoiceRecallNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unclear' })
    )
    expect(openRecallSidePanel).not.toHaveBeenCalled()
    expect(writeVoiceRecallHandoff).not.toHaveBeenCalled()
    expect(patchVoiceCommandCacheMicGranted).not.toHaveBeenCalled()
  })

  it('低置信：写 show_result + 候选通知，不开面板，命令不抛', async () => {
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(true)
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      ok: true,
      transcript: 'vague clue',
      path: 'offscreen'
    }))
    recallWithClue.mockResolvedValueOnce(needClueResult())

    const { handleVoiceRecallOpenCommand } = await import('@/application/recall/voice-recall-open')
    await expect(handleVoiceRecallOpenCommand()).resolves.toBeUndefined()

    expect(writeVoiceRecallHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'show_result', clue: 'vague clue' })
    )
    expect(showVoiceRecallNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'candidates ready',
        openSidePanelOnClick: true
      })
    )
    expect(openRecallSidePanel).not.toHaveBeenCalled()
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
    ensureOffscreenDocumentForUserMedia.mockResolvedValueOnce(true)
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
})
