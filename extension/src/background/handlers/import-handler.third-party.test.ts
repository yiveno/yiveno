import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getThirdPartyCorpusSummaryMock,
  deleteThirdPartyCorpusBySourceMock,
  invalidateBookmarkLibraryTreeCacheMock
} = vi.hoisted(() => ({
  getThirdPartyCorpusSummaryMock: vi.fn(),
  deleteThirdPartyCorpusBySourceMock: vi.fn(),
  invalidateBookmarkLibraryTreeCacheMock: vi.fn()
}))

vi.mock('@/application/capture/import-third-party-corpus-service', () => ({
  ThirdPartyCorpusImportError: class ThirdPartyCorpusImportError extends Error {},
  getThirdPartyCorpusSummary: getThirdPartyCorpusSummaryMock,
  deleteThirdPartyCorpusBySource: deleteThirdPartyCorpusBySourceMock,
  importThirdPartyCorpusExport: vi.fn()
}))

vi.mock('@/application/memory/bookmark-library-tree-cache', () => ({
  getLastBuiltBookmarkLibraryTree: vi.fn(),
  invalidateBookmarkLibraryTreeCache: invalidateBookmarkLibraryTreeCacheMock,
  rememberBookmarkLibraryTreeBuild: vi.fn()
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: vi.fn(() => 0),
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  handleDeleteThirdPartyCorpusBySource,
  handleGetThirdPartyCorpusSummary
} from '@/background/handlers/import-handler'

describe('import-handler 第三方摘要与按来源删除', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('summary 返回两来源计数与状态', async () => {
    const sources = {
      raindrop: {
        count: 2,
        lastImport: {
          status: 'completed' as const,
          source: 'raindrop' as const,
          importedCount: 2,
          totalCount: 2,
          startedAt: '2026-11-16T10:00:00.000Z',
          finishedAt: '2026-11-16T10:00:01.000Z'
        }
      },
      pocket: { count: 0, lastImport: null }
    }
    getThirdPartyCorpusSummaryMock.mockResolvedValue(sources)

    const response = await handleGetThirdPartyCorpusSummary()
    expect(response).toEqual({ ok: true, sources })
  })

  it('delete by source 成功后返回删除数并失效书签树缓存', async () => {
    deleteThirdPartyCorpusBySourceMock.mockResolvedValue({ deletedCount: 4 })

    const response = await handleDeleteThirdPartyCorpusBySource({ source: 'pocket' })
    expect(response).toEqual({ ok: true, deletedCount: 4 })
    expect(deleteThirdPartyCorpusBySourceMock).toHaveBeenCalledWith('pocket')
    expect(invalidateBookmarkLibraryTreeCacheMock).toHaveBeenCalled()
  })
})
