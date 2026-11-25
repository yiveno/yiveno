import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import { VOICE_MIC_GRANTED_STORAGE_KEY } from '@/infrastructure/storage/voice-mic-granted-storage'

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

describe('voice-command-cache', () => {
  const onChangedAddListener = vi.fn()
  const storageGet = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    onChangedAddListener.mockClear()
    storageGet.mockReset()
    vi.stubGlobal('chrome', {
      storage: {
        local: { get: (...args: unknown[]) => storageGet(...args) },
        onChanged: { addListener: onChangedAddListener }
      }
    })
  })

  it('预载后 ready；storage 变更同步内存', async () => {
    storageGet.mockResolvedValueOnce({
      [USER_SETTINGS_STORAGE_KEY]: { voiceRecallOpenEnabled: true },
      [VOICE_MIC_GRANTED_STORAGE_KEY]: false
    })

    const {
      ensureVoiceCommandCacheWarm,
      getVoiceCommandCacheSnapshot,
      resetVoiceCommandCacheForTests
    } = await import('@/infrastructure/browser/voice-command-cache')
    resetVoiceCommandCacheForTests()

    ensureVoiceCommandCacheWarm()
    await vi.waitFor(() => {
      expect(getVoiceCommandCacheSnapshot().ready).toBe(true)
    })

    expect(getVoiceCommandCacheSnapshot()).toEqual({
      ready: true,
      voiceRecallOpenEnabled: true,
      micGranted: false
    })
    expect(onChangedAddListener).toHaveBeenCalledTimes(1)

    const listener = onChangedAddListener.mock.calls[0]?.[0] as (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => void
    listener(
      {
        [VOICE_MIC_GRANTED_STORAGE_KEY]: { newValue: true }
      },
      'local'
    )
    expect(getVoiceCommandCacheSnapshot().micGranted).toBe(true)
  })

  it('setVoiceCommandCacheForTests 仅测入口', async () => {
    const {
      setVoiceCommandCacheForTests,
      getVoiceCommandCacheSnapshot,
      resetVoiceCommandCacheForTests
    } = await import('@/infrastructure/browser/voice-command-cache')
    resetVoiceCommandCacheForTests()
    setVoiceCommandCacheForTests({
      ready: true,
      voiceRecallOpenEnabled: false,
      micGranted: true
    })
    expect(getVoiceCommandCacheSnapshot()).toEqual({
      ready: true,
      voiceRecallOpenEnabled: false,
      micGranted: true
    })
  })
})
