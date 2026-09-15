import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureChromeBookmarksImportedMock,
  getChromeBookmarkImportStatusMock,
  ensureMemoryEnrichmentBackfilledMock,
  runSilentMemoryEmbeddingMaintenanceMock,
  scheduleSilentMemoryEmbeddingMaintenanceMock,
  scheduleAsyncMemoryLlmEnrichmentMock,
  getAuthSessionMock,
  getUserSettingsMock,
  listByOwnerMock,
  readChromeStorageLocalMock,
  writeChromeStorageLocalMock,
  readInstallOnboardingDoneMock
} = vi.hoisted(() => ({
  ensureChromeBookmarksImportedMock: vi.fn(),
  getChromeBookmarkImportStatusMock: vi.fn(),
  ensureMemoryEnrichmentBackfilledMock: vi.fn(),
  runSilentMemoryEmbeddingMaintenanceMock: vi.fn(),
  scheduleSilentMemoryEmbeddingMaintenanceMock: vi.fn(),
  scheduleAsyncMemoryLlmEnrichmentMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  listByOwnerMock: vi.fn(),
  readChromeStorageLocalMock: vi.fn(),
  writeChromeStorageLocalMock: vi.fn(),
  readInstallOnboardingDoneMock: vi.fn()
}))

vi.mock('@/application/capture/import-chrome-bookmarks-service', () => ({
  ensureChromeBookmarksImported: ensureChromeBookmarksImportedMock,
  getChromeBookmarkImportStatus: getChromeBookmarkImportStatusMock
}))

vi.mock('@/application/memory/ensure-memory-enrichment-backfill', () => ({
  ensureMemoryEnrichmentBackfilled: ensureMemoryEnrichmentBackfilledMock
}))

vi.mock('@/application/memory/ensure-memory-embedding-maintenance', () => ({
  runSilentMemoryEmbeddingMaintenance: runSilentMemoryEmbeddingMaintenanceMock,
  scheduleSilentMemoryEmbeddingMaintenance: scheduleSilentMemoryEmbeddingMaintenanceMock
}))

vi.mock('@/application/memory/schedule-async-memory-llm-enrichment', () => ({
  scheduleAsyncMemoryLlmEnrichment: scheduleAsyncMemoryLlmEnrichmentMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listByOwner: listByOwnerMock
  }
}))

vi.mock('@/infrastructure/storage/chrome-storage-local', () => ({
  readChromeStorageLocal: readChromeStorageLocalMock,
  writeChromeStorageLocal: writeChromeStorageLocalMock
}))

vi.mock('@/infrastructure/storage/install-onboarding-storage', () => ({
  readInstallOnboardingDone: readInstallOnboardingDoneMock
}))

vi.mock('@/core/memory/should-request-llm-memory-enrichment', () => ({
  shouldRequestLlmMemoryEnrichment: () => true
}))

import {
  resetColdStartPipelineForTests,
  runColdStartPipeline
} from '@/application/onboarding/cold-start-pipeline-service'
import { COLD_START_PIPELINE_STORAGE_KEY } from '@/core/memory/cold-start-pipeline-state'

describe('runColdStartPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    resetColdStartPipelineForTests()
    writeChromeStorageLocalMock.mockImplementation(async (_key: string, value: unknown) => value)
    getUserSettingsMock.mockResolvedValue({ chromeBookmarkIngestEnabled: true })
    ensureMemoryEnrichmentBackfilledMock.mockResolvedValue({
      status: 'completed',
      scanned: 3,
      updated: 1,
      version: 3
    })
    runSilentMemoryEmbeddingMaintenanceMock.mockResolvedValue({
      attempted: 0,
      written: 0,
      failed: 0,
      scanned: 0,
      quotaHit: false
    })
    listByOwnerMock.mockResolvedValue([])
    getAuthSessionMock.mockResolvedValue({ accessToken: 'tok' })
    readInstallOnboardingDoneMock.mockResolvedValue(true)
  })

  it('存量已导入且引导已完成 → migrated_existing，不跑 import', async () => {
    readChromeStorageLocalMock.mockResolvedValue(null)
    getChromeBookmarkImportStatusMock.mockResolvedValue({
      status: 'completed',
      importedCount: 12,
      totalCount: 12
    })

    const promise = runColdStartPipeline()
    await vi.runAllTimersAsync()
    const state = await promise

    expect(state.status).toBe('ready')
    expect(state.releaseReason).toBe('migrated_existing')
    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()
    expect(scheduleSilentMemoryEmbeddingMaintenanceMock).toHaveBeenCalled()
    expect(writeChromeStorageLocalMock).toHaveBeenCalledWith(
      COLD_START_PIPELINE_STORAGE_KEY,
      expect.objectContaining({ status: 'ready' })
    )
  })

  it('首装引导未完成时即使 import completed 也不迁移，走门禁流水线', async () => {
    readInstallOnboardingDoneMock.mockResolvedValue(false)
    let stored: Record<string, unknown> | null = null
    readChromeStorageLocalMock.mockImplementation(async () => stored)
    writeChromeStorageLocalMock.mockImplementation(
      async (_key: string, value: Record<string, unknown>) => {
        stored = value
        return value
      }
    )
    getChromeBookmarkImportStatusMock.mockResolvedValue({
      status: 'completed',
      importedCount: 12,
      totalCount: 12
    })
    ensureChromeBookmarksImportedMock.mockResolvedValue({
      status: 'completed',
      importedCount: 12,
      totalCount: 12
    })

    const promise = runColdStartPipeline()
    await vi.runAllTimersAsync()
    const state = await promise

    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalled()
    expect(state.releaseReason).not.toBe('migrated_existing')
    expect(state.status).toBe('ready')
  })

  it('灌库关闭：不调 ensure，ingest_disabled 放行', async () => {
    getUserSettingsMock.mockResolvedValue({ chromeBookmarkIngestEnabled: false })
    getAuthSessionMock.mockResolvedValue(null)
    listByOwnerMock.mockResolvedValue([])
    let stored: Record<string, unknown> | null = null
    readChromeStorageLocalMock.mockImplementation(async () => stored)
    writeChromeStorageLocalMock.mockImplementation(
      async (_key: string, value: Record<string, unknown>) => {
        stored = value
        return value
      }
    )
    getChromeBookmarkImportStatusMock.mockResolvedValue({
      status: 'pending',
      importedCount: 0
    })

    const promise = runColdStartPipeline()
    await vi.runAllTimersAsync()
    const state = await promise

    expect(ensureChromeBookmarksImportedMock).not.toHaveBeenCalled()
    expect(state.releaseReason).toBe('ingest_disabled')
    expect(state.status).toBe('ready')
  })

  it('灌库开启：幂等调用 ensure 作对齐/等待兜底', async () => {
    getUserSettingsMock.mockResolvedValue({ chromeBookmarkIngestEnabled: true })
    readInstallOnboardingDoneMock.mockResolvedValue(false)
    let stored: Record<string, unknown> | null = null
    readChromeStorageLocalMock.mockImplementation(async () => stored)
    writeChromeStorageLocalMock.mockImplementation(
      async (_key: string, value: Record<string, unknown>) => {
        stored = value
        return value
      }
    )
    getChromeBookmarkImportStatusMock.mockResolvedValue({
      status: 'completed',
      importedCount: 5,
      totalCount: 5
    })
    ensureChromeBookmarksImportedMock.mockResolvedValue({
      status: 'completed',
      importedCount: 5,
      totalCount: 5
    })

    const promise = runColdStartPipeline()
    await vi.runAllTimersAsync()
    const state = await promise

    expect(ensureChromeBookmarksImportedMock).toHaveBeenCalledTimes(1)
    expect(state.status).toBe('ready')
    expect(state.releaseReason).not.toBe('ingest_disabled')
  })

  it('未登录：规则后进 AI 阶段，LLM 入队、无 embed，local_ready 放行', async () => {
    getAuthSessionMock.mockResolvedValue(null)
    listByOwnerMock.mockResolvedValue([
      { id: 'item-1', title: 'Example', url: 'https://example.com' }
    ])
    let stored: Record<string, unknown> | null = null
    readChromeStorageLocalMock.mockImplementation(async () => stored)
    writeChromeStorageLocalMock.mockImplementation(
      async (_key: string, value: Record<string, unknown>) => {
        stored = value
        return value
      }
    )
    getChromeBookmarkImportStatusMock.mockResolvedValue({
      status: 'pending',
      importedCount: 0
    })
    ensureChromeBookmarksImportedMock.mockResolvedValue({
      status: 'completed',
      importedCount: 2,
      totalCount: 2
    })

    const promise = runColdStartPipeline()
    await vi.runAllTimersAsync()
    const state = await promise

    expect(runSilentMemoryEmbeddingMaintenanceMock).not.toHaveBeenCalled()
    expect(scheduleAsyncMemoryLlmEnrichmentMock).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ coldStartBatchId: expect.stringMatching(/^cold-start-llm-/) })
    )
    expect(state.releaseReason).toBe('local_ready')
    expect(state.status).toBe('ready')
    expect(state.aiLlmEnqueued).toBe(1)
    expect(state.aiEmbedAttempted).toBe(0)
  })
})
