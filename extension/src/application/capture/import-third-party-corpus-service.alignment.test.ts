import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  hardDeleteByCorpusSourceMock,
  clearThirdPartyCorpusImportStateMock,
  invalidateBookmarkSyncAlignmentCacheMock,
  upsertBookmarkFromThirdPartyCorpusMock,
  writeThirdPartyCorpusImportStateMock,
  parseThirdPartyCorpusExportMock
} = vi.hoisted(() => ({
  hardDeleteByCorpusSourceMock: vi.fn(),
  clearThirdPartyCorpusImportStateMock: vi.fn(),
  invalidateBookmarkSyncAlignmentCacheMock: vi.fn(),
  upsertBookmarkFromThirdPartyCorpusMock: vi.fn(),
  writeThirdPartyCorpusImportStateMock: vi.fn(),
  parseThirdPartyCorpusExportMock: vi.fn()
}))

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    hardDeleteByCorpusSource: hardDeleteByCorpusSourceMock,
    upsertBookmarkFromThirdPartyCorpus: upsertBookmarkFromThirdPartyCorpusMock
  }
}))

vi.mock('@/application/memory/bookmark-sync-alignment-cache', () => ({
  invalidateBookmarkSyncAlignmentCache: invalidateBookmarkSyncAlignmentCacheMock
}))

vi.mock('@/infrastructure/storage/third-party-corpus-import-storage', () => ({
  clearThirdPartyCorpusImportState: clearThirdPartyCorpusImportStateMock,
  writeThirdPartyCorpusImportState: writeThirdPartyCorpusImportStateMock,
  readThirdPartyCorpusImportState: vi.fn()
}))

vi.mock('@/core/memory/parse-third-party-corpus-export', () => ({
  parseThirdPartyCorpusExport: parseThirdPartyCorpusExportMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  deleteThirdPartyCorpusBySource,
  importThirdPartyCorpusExport
} from '@/application/capture/import-third-party-corpus-service'

describe('import-third-party-corpus-service 对齐缓存（已有失效）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('按来源删除后调用失效', async () => {
    hardDeleteByCorpusSourceMock.mockResolvedValue(3)
    clearThirdPartyCorpusImportStateMock.mockResolvedValue(undefined)

    await deleteThirdPartyCorpusBySource('raindrop')
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
  })

  it('导入完成后调用失效', async () => {
    parseThirdPartyCorpusExportMock.mockReturnValue([
      { title: 'A', url: 'https://a.example.com', remoteId: '1' }
    ])
    writeThirdPartyCorpusImportStateMock.mockResolvedValue(undefined)
    upsertBookmarkFromThirdPartyCorpusMock.mockResolvedValue({ id: 'x' })

    await importThirdPartyCorpusExport({
      source: 'pocket',
      content: 'dummy'
    })
    expect(invalidateBookmarkSyncAlignmentCacheMock).toHaveBeenCalledOnce()
  })
})
