import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getUserSettingsMock,
  updateUserSettingsMock,
  ensureChromeBookmarksImportedMock,
  refreshClueLlmCompleterFromDevConfigMock,
  syncChromeBookmarkSyncListenersWithSyncSettingMock,
  ensureLinkStatusSweepAlarmMock
} = vi.hoisted(() => ({
  getUserSettingsMock: vi.fn(),
  updateUserSettingsMock: vi.fn(),
  ensureChromeBookmarksImportedMock: vi.fn(async () => undefined),
  refreshClueLlmCompleterFromDevConfigMock: vi.fn(async () => undefined),
  syncChromeBookmarkSyncListenersWithSyncSettingMock: vi.fn(async () => undefined),
  ensureLinkStatusSweepAlarmMock: vi.fn(async () => undefined)
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
  syncChromeBookmarkSyncListenersWithSyncSetting: syncChromeBookmarkSyncListenersWithSyncSettingMock
}))

vi.mock('@/infrastructure/sync/link-status-sweep-alarm', () => ({
  ensureLinkStatusSweepAlarm: ensureLinkStatusSweepAlarmMock
}))

import {
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'

const fullSettings = {
  selectionToolbarEnabled: true,
  aiFeaturesEnabled: true,
  contentExtractEnabled: false,
  linkStatusSweepEnabled: true,
  chromeBookmarkIngestEnabled: true,
  chromeBookmarkSyncEnabled: false,
  mcpReadOnlyEnabled: false,
  recallOutcomePairSoftAdjustEnabled: true,
  dualThreadLocalLearningEnabled: false,
  dualThreadContributeAggregatesEnabled: false,
  uiLocalePreference: 'system' as const,
  voiceRecallOpenEnabled: true
}

describe('settings-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserSettingsMock.mockResolvedValue(fullSettings)
  })

  it('handleGetUserSettings 返回当前设置', async () => {
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
    expect(syncChromeBookmarkSyncListenersWithSyncSettingMock).not.toHaveBeenCalled()
  })

  it('开启书签导入授权时只跑导入不挂监听', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: true
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkIngestEnabled: true })
    expect(response.ok).toBe(true)
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ chromeBookmarkIngestEnabled: true })
    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
    expect(syncChromeBookmarkSyncListenersWithSyncSettingMock).not.toHaveBeenCalled()
  })

  it('开启书签同步时挂监听并 ensure；若 ingest 未开则一并置 ingest', async () => {
    getUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: false,
      chromeBookmarkSyncEnabled: false
    })
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkIngestEnabled: true,
      chromeBookmarkSyncEnabled: true
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkSyncEnabled: true })
    expect(response.ok).toBe(true)
    expect(updateUserSettingsMock).toHaveBeenCalledWith({
      chromeBookmarkSyncEnabled: true,
      chromeBookmarkIngestEnabled: true
    })
    expect(syncChromeBookmarkSyncListenersWithSyncSettingMock).toHaveBeenCalledWith(true)
    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
  })

  it('关闭书签同步时卸载监听且不改 ingest、不触发导入', async () => {
    updateUserSettingsMock.mockResolvedValue({
      ...fullSettings,
      chromeBookmarkSyncEnabled: false
    })

    const response = await handleUpdateUserSettings({ chromeBookmarkSyncEnabled: false })
    expect(response.ok).toBe(true)
    expect(updateUserSettingsMock).toHaveBeenCalledWith({ chromeBookmarkSyncEnabled: false })
    expect(syncChromeBookmarkSyncListenersWithSyncSettingMock).toHaveBeenCalledWith(false)
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
    expect(syncChromeBookmarkSyncListenersWithSyncSettingMock).not.toHaveBeenCalled()
  })
})
