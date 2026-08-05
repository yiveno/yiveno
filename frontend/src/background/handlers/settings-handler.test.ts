import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getUserSettingsMock,
  updateUserSettingsMock,
  ensureChromeBookmarksImportedMock,
  refreshClueLlmCompleterFromDevConfigMock
} = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  ensureChromeBookmarksImportedMock: vi.fn(async () => undefined),
  refreshClueLlmCompleterFromDevConfigMock: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock,
  updateUserSettings: updateUserSettingsMock
}))

vi.mock('@/application/recall/refresh-clue-llm-completer', () => ({
  refreshClueLlmCompleterFromDevConfig: refreshClueLlmCompleterFromDevConfigMock
}))

vi.mock('@/application/capture/import-chrome-bookmarks-service', () => ({
  ensureChromeBookmarksImported: ensureChromeBookmarksImportedMock
}))

import {
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'

const fullSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  chromeBookmarkIngestEnabled: true
}

describe('settings-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handleGetUserSettings 返回当前设置', async () => {
    getUserSettingsMock.mockResolvedValue(fullSettings)

    const response = await handleGetUserSettings()
    expect(response).toEqual({
      ok: true,
      settings: fullSettings
    })
  })

  it('handleUpdateUserSettings 校验并写入', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      selectionToolbarEnabled: false
    })

    const response = await handleUpdateUserSettings({ selectionToolbarEnabled: false })
    expect(response).toEqual({
      ok: true,
      settings: { ...fullSettings, selectionToolbarEnabled: false }
    })
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ selectionToolbarEnabled: false })
    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()
  })

  it('重新开启书签灌库时触发 ensureChromeBookmarksImported', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: true
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkIngestEnabled: true })
    expect(response.ok).toBe(true)
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ chromeBookmarkIngestEnabled: true })
    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
  })
})
