import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getUserSettingsMock,
  updateUserSettingsMock,
  ensureChromeBookmarksImportedMock,
  refreshClueLlmCompleterFromDevConfigMock,
  syncChromeBookmarkSyncListenersWithIngestSettingMock
} = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  ensureChromeBookmarksImportedMock: vi.fn(async () => undefined),
  refreshClueLlmCompleterFromDevConfigMock: vi.fn(async () => undefined),
  syncChromeBookmarkSyncListenersWithIngestSettingMock: vi.fn(async () => undefined)
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

vi.mock('@/background/listeners/chrome-bookmark-sync', () => ({
  syncChromeBookmarkSyncListenersWithIngestSetting:
    syncChromeBookmarkSyncListenersWithIngestSettingMock
}))

import {
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'

const fullSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  chromeBookmarkIngestEnabled: true,
  mcpReadOnlyEnabled: false,
  recallOutcomePairSoftAdjustEnabled: true,
  uiLocalePreference: 'system' as const
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
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).not.toHaveBeenCalled()
  })

  it('重新开启书签灌库时挂监听并 ensure 导入', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: true
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkIngestEnabled: true })
    expect(response.ok).toBe(true)
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ chromeBookmarkIngestEnabled: true })
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).toHaveBeenCalledWith(true)
    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
  })

  it('关闭书签灌库时卸载监听且不触发导入', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: false
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkIngestEnabled: false })
    expect(response.ok).toBe(true)
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).toHaveBeenCalledWith(false)
    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()
  })

  it('可关闭本机 Outcome 软调且不触其它副作用', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      recallOutcomePairSoftAdjustEnabled: false
    })

    const response = await handleUpdateUserSettings({
      recallOutcomePairSoftAdjustEnabled: false
    })
    expect(response).toEqual({
      ok: true,
      settings: { ...fullSettings, recallOutcomePairSoftAdjustEnabled: false }
    })
    expect(updateUserSettingsMock).toHaveBeenCalledWith({
      recallOutcomePairSoftAdjustEnabled: false
    })
    expect(refreshClueLlmCompleterFromDevConfigMock).not.toHaveBeenCalled()
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).not.toHaveBeenCalled()
  })
})
