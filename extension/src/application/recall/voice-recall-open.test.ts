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

describe('voice-recall-open 学习信号与退路', () => {
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
          return key
        },
        getUILanguage: () => 'en-US'
      }
    })
    getUserSettings.mockResolvedValue({
      voiceRecallOpenEnabled: true,
      uiLocalePreference: 'system'
    })
    handleRecordMemoryOpen.mockResolvedValue({ ok: true })
    writeVoiceRecallHandoff.mockResolvedValue(undefined)
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

  it('自动打开导航失败：不写 open_confirm / memory open；命令退回面板', async () => {
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
    expect(openRecallSidePanel).toHaveBeenCalled()
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
})
