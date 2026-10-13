import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  scheduleColdStartPipelineMock,
  ensureSidePanelOpensOnActionClickMock,
  getCurrentOwnerIdMock,
  getOrCreateLocalProfileMock,
  initializeMemoryDatabaseMock,
  syncChromeBookmarkSyncListenersWithIngestSettingMock,
  registerContextMenuListenersMock,
  registerOmniboxListenersMock,
  registerCommandListenersMock,
  registerSelectionToolbarKeepaliveListenerMock
} = vi.hoisted(() => ({
  scheduleColdStartPipelineMock: vi.fn(),
  ensureSidePanelOpensOnActionClickMock: vi.fn(async () => undefined),
  getCurrentOwnerIdMock: vi.fn(async () => 'owner-1'),
  getOrCreateLocalProfileMock: vi.fn(async () => ({
    localProfileId: 'profile-1',
    createdAt: '2026-07-22T05:00:00.000Z',
    schemaVersion: 1
  })),
  initializeMemoryDatabaseMock: vi.fn(async () => undefined),
  syncChromeBookmarkSyncListenersWithIngestSettingMock: vi.fn(async () => undefined),
  registerContextMenuListenersMock: vi.fn(),
  registerOmniboxListenersMock: vi.fn(),
  registerCommandListenersMock: vi.fn(),
  registerSelectionToolbarKeepaliveListenerMock: vi.fn()
}))

vi.mock('@/application/onboarding/cold-start-pipeline-service', () => ({
  scheduleColdStartPipeline: scheduleColdStartPipelineMock
}))

vi.mock('@/infrastructure/browser/side-panel', () => ({
  ensureSidePanelOpensOnActionClick: ensureSidePanelOpensOnActionClickMock
}))

vi.mock('@/background/listeners/chrome-bookmark-sync', () => ({
  syncChromeBookmarkSyncListenersWithIngestSetting:
    syncChromeBookmarkSyncListenersWithIngestSettingMock
}))

vi.mock('@/background/listeners/context-menu', () => ({
  registerContextMenuListeners: registerContextMenuListenersMock
}))

vi.mock('@/background/listeners/omnibox', () => ({
  registerOmniboxListeners: registerOmniboxListenersMock
}))

vi.mock('@/background/listeners/commands', () => ({
  registerCommandListeners: registerCommandListenersMock
}))

vi.mock('@/background/listeners/selection-toolbar-keepalive', () => ({
  registerSelectionToolbarKeepaliveListener: registerSelectionToolbarKeepaliveListenerMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-db', () => ({
  initializeMemoryDatabase: initializeMemoryDatabaseMock
}))

vi.mock('@/background/listeners/memory-cloud-sync-alarm', () => ({
  registerMemoryCloudSyncAlarmListener: vi.fn()
}))

vi.mock('@/background/listeners/auth-session-lease-alarm', () => ({
  registerAuthSessionLeaseAlarmListener: vi.fn()
}))

vi.mock('@/application/recall/refresh-clue-llm-completer', () => ({
  refreshClueLlmCompleterFromDevConfig: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/auth/extension-uninstall-url', () => ({
  ensureExtensionUninstallFeedbackUrl: vi.fn(async () => undefined)
}))

import {
  ensureBackgroundBootstrapped,
  resetBackgroundBootstrapForTests
} from '@/background/bootstrap'

describe('ensureBackgroundBootstrapped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetBackgroundBootstrapForTests()
  })

  it('并发调用只 bootstrap 一次', async () => {
    await Promise.all([ensureBackgroundBootstrapped(), ensureBackgroundBootstrapped()])

    expect(ensureSidePanelOpensOnActionClickMock).toHaveBeenCalledTimes(1)
    expect(initializeMemoryDatabaseMock).toHaveBeenCalledTimes(1)
    expect(syncChromeBookmarkSyncListenersWithIngestSettingMock).toHaveBeenCalledTimes(1)
    expect(registerContextMenuListenersMock).toHaveBeenCalledTimes(1)
    expect(registerOmniboxListenersMock).toHaveBeenCalledTimes(1)
    expect(registerCommandListenersMock).toHaveBeenCalledTimes(1)
    expect(registerSelectionToolbarKeepaliveListenerMock).toHaveBeenCalledTimes(1)
  })

  it('启动时调度冷启动 pipeline', async () => {
    await ensureBackgroundBootstrapped()
    expect(scheduleColdStartPipelineMock).toHaveBeenCalledTimes(1)
  })

  it('bootstrap 失败后清空 promise，下次调用可重试', async () => {
    initializeMemoryDatabaseMock.mockRejectedValueOnce(new Error('idb_open_failed'))
    await expect(ensureBackgroundBootstrapped()).rejects.toThrow('idb_open_failed')
    initializeMemoryDatabaseMock.mockResolvedValueOnce(undefined)
    await ensureBackgroundBootstrapped()
    expect(initializeMemoryDatabaseMock).toHaveBeenCalledTimes(2)
  })
})
