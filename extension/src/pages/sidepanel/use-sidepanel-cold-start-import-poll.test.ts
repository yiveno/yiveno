/**
 * 书签导入轮询 ↔ probe 互重启死循环回归。
 * 断言：终态不启轮询、completed 签名去重、running 正常、ingest 关不变。
 */
import { effectScope, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { DEFAULT_USER_SETTINGS } from '@/core/settings/user-settings'
import { useSidepanelColdStart, type UseSidepanelColdStartResult } from './use-sidepanel-cold-start'

const listMemoryItemsMock = vi.hoisted(() => vi.fn())
const fetchUserSettingsMock = vi.hoisted(() => vi.fn())
const fetchBookmarkSyncStalenessMock = vi.hoisted(() => vi.fn())
const fetchChromeBookmarkImportStatusMock = vi.hoisted(() => vi.fn())
const fetchColdStartStatusMock = vi.hoisted(() => vi.fn())

vi.mock('@/infrastructure/messaging/background-client', () => ({
  listMemoryItems: (...args: unknown[]) => listMemoryItemsMock(...args),
  fetchUserSettings: (...args: unknown[]) => fetchUserSettingsMock(...args),
  fetchBookmarkSyncStaleness: (...args: unknown[]) => fetchBookmarkSyncStalenessMock(...args),
  fetchChromeBookmarkImportStatus: (...args: unknown[]) =>
    fetchChromeBookmarkImportStatusMock(...args),
  fetchColdStartStatus: (...args: unknown[]) => fetchColdStartStatusMock(...args)
}))

vi.mock('@/infrastructure/i18n/t', () => ({
  t: (key: string) => key
}))

vi.mock('@/infrastructure/ui/use-app-toast', () => ({
  showAppToast: vi.fn()
}))

vi.mock('@/infrastructure/browser/extension-pages', () => ({
  openGettingStartedPage: vi.fn()
}))

vi.mock('@/infrastructure/browser/extension-tab', () => ({
  focusOrOpenSettingsTab: vi.fn()
}))

vi.mock('@/infrastructure/storage/cold-start-post-release-banner-storage', () => ({
  readColdStartPostReleaseBannerDismissedReadyAt: vi.fn(async () => null),
  writeColdStartPostReleaseBannerDismissedReadyAt: vi.fn(async () => undefined)
}))

vi.mock('@/infrastructure/storage/first-recall-onboarding-storage', () => ({
  consumeRecallPrefill: vi.fn(async () => null),
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY: 'excerpt_capture_count',
  parseRecallPrefillStorageValue: vi.fn(),
  readExcerptCaptureCount: vi.fn(async () => 0),
  RECALL_PREFILL_SESSION_KEY: 'recall_prefill'
}))

vi.mock('@/infrastructure/storage/install-onboarding-storage', () => ({
  INSTALL_ONBOARDING_DONE_LOCAL_KEY: 'install_onboarding_done',
  markInstallOnboardingDone: vi.fn(async () => undefined),
  readInstallOnboardingDone: vi.fn(async () => true)
}))

function completedImport(partial?: Partial<ChromeBookmarkImportState>): ChromeBookmarkImportState {
  return {
    status: 'completed',
    importedCount: 12,
    totalCount: 12,
    completedAt: '2026-11-27T12:00:00.000Z',
    ...partial
  }
}

function runningImport(partial?: Partial<ChromeBookmarkImportState>): ChromeBookmarkImportState {
  return {
    status: 'running',
    importedCount: 3,
    totalCount: 12,
    startedAt: '2026-11-27T11:59:00.000Z',
    ...partial
  }
}

type Harness = {
  api: UseSidepanelColdStartResult
  scope: EffectScope
}

function mountColdStart(): Harness {
  const scope = effectScope()
  const api = scope.run(() =>
    useSidepanelColdStart({
      clue: ref(''),
      clueInputRef: ref(null),
      accountDisplayName: ref(''),
      onAutoSubmitPrefill: () => undefined
    })
  )
  if (!api) {
    throw new Error('effectScope.run 未返回 cold-start api')
  }
  return { api, scope }
}

async function flushMicrotasks(times = 6): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve()
  }
}

describe('useSidepanelColdStart · 导入轮询 / probe 死循环', () => {
  let harness: Harness | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    listMemoryItemsMock.mockReset()
    fetchUserSettingsMock.mockReset()
    fetchBookmarkSyncStalenessMock.mockReset()
    fetchChromeBookmarkImportStatusMock.mockReset()
    fetchColdStartStatusMock.mockReset()

    listMemoryItemsMock.mockResolvedValue({ ok: true, items: [], total: 1 })
    fetchBookmarkSyncStalenessMock.mockResolvedValue({ ok: true, unsyncedCount: 0 })
    fetchColdStartStatusMock.mockResolvedValue({
      ok: true,
      state: null,
      enrichmentBatch: null
    })
  })

  afterEach(() => {
    harness?.api.stopImportPolling()
    harness?.api.stopColdStartPolling()
    harness?.scope.stop()
    harness = null
    vi.useRealTimers()
  })

  it('ingest 开 + import completed：probe 不启轮询，且不产生循环', async () => {
    fetchUserSettingsMock.mockResolvedValue({
      ok: true,
      settings: { ...DEFAULT_USER_SETTINGS, chromeBookmarkIngestEnabled: true }
    })
    fetchChromeBookmarkImportStatusMock.mockResolvedValue({
      ok: true,
      state: completedImport()
    })

    harness = mountColdStart()
    // 先走一轮轮询写入 completed，再反复 probe（模拟真机互重启前的状态）
    harness.api.startImportPolling()
    await flushMicrotasks()
    const afterFirstPoll = fetchChromeBookmarkImportStatusMock.mock.calls.length
    expect(afterFirstPoll).toBeGreaterThanOrEqual(1)
    expect(harness.api.importState.value?.status).toBe('completed')

    listMemoryItemsMock.mockClear()
    fetchUserSettingsMock.mockClear()
    fetchChromeBookmarkImportStatusMock.mockClear()

    for (let i = 0; i < 5; i += 1) {
      await harness.api.probeMemoryLibrary()
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(2500)
      await flushMicrotasks()
    }

    // probe 在终态不得再启轮询 → 状态接口调用次数有界（不应随循环膨胀）
    expect(fetchChromeBookmarkImportStatusMock.mock.calls.length).toBe(0)
    // probe 自身会打 settings / list，但不得因 import 循环额外放大到数百次
    expect(fetchUserSettingsMock.mock.calls.length).toBeLessThanOrEqual(5)
    expect(listMemoryItemsMock.mock.calls.length).toBeLessThanOrEqual(10)
  })

  it('ingest 开 + import running：轮询启动，completed 后停且只 probe 一次', async () => {
    fetchUserSettingsMock.mockResolvedValue({
      ok: true,
      settings: { ...DEFAULT_USER_SETTINGS, chromeBookmarkIngestEnabled: true }
    })
    fetchChromeBookmarkImportStatusMock
      .mockResolvedValueOnce({ ok: true, state: runningImport() })
      .mockResolvedValueOnce({ ok: true, state: runningImport({ importedCount: 6 }) })
      .mockResolvedValue({ ok: true, state: completedImport() })

    harness = mountColdStart()
    // 先写入 running，使 probe 认为导入进行中
    harness.api.startImportPolling()
    await flushMicrotasks()
    expect(harness.api.importState.value?.status).toBe('running')

    const statusCallsAfterStart = fetchChromeBookmarkImportStatusMock.mock.calls.length
    expect(statusCallsAfterStart).toBeGreaterThanOrEqual(1)

    listMemoryItemsMock.mockClear()
    // 推进 interval，直到 completed
    await vi.advanceTimersByTimeAsync(500)
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(500)
    await flushMicrotasks()
    // 再多跑几拍：同一 completed 不得反复 probe → 状态调用有界
    await vi.advanceTimersByTimeAsync(5000)
    await flushMicrotasks()

    expect(harness.api.importState.value?.status).toBe('completed')
    // completed 后 interval 已清，后续不应继续涨到「每秒数百」
    expect(fetchChromeBookmarkImportStatusMock.mock.calls.length).toBeLessThanOrEqual(6)
    // completed 签名变化只触发一次库探测（listMemoryItems 成对 all+bookmark）
    expect(listMemoryItemsMock.mock.calls.length).toBe(2)
  })

  it('ingest 关：probe 不启导入轮询', async () => {
    fetchUserSettingsMock.mockResolvedValue({
      ok: true,
      settings: { ...DEFAULT_USER_SETTINGS, chromeBookmarkIngestEnabled: false }
    })
    fetchChromeBookmarkImportStatusMock.mockResolvedValue({
      ok: true,
      state: runningImport()
    })

    harness = mountColdStart()
    // 即便缓存里曾有 running，ingest 关时 probe 也不该启轮询
    harness.api.importState.value = runningImport()
    await harness.api.probeMemoryLibrary()
    await flushMicrotasks()
    await vi.advanceTimersByTimeAsync(2000)
    await flushMicrotasks()

    expect(fetchChromeBookmarkImportStatusMock.mock.calls.length).toBe(0)
    expect(harness.api.bookmarkIngestEnabled.value).toBe(false)
  })
})
