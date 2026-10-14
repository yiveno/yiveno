import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getOrCreateLocalProfileMock,
  listOwnerBucketSummariesMock,
  listAllByOwnerIdMock,
  remapOwnerIdByTypeMock,
  hardDeleteManyMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  listOwnerBucketSummariesMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  remapOwnerIdByTypeMock: vi.fn(),
  hardDeleteManyMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listOwnerBucketSummaries: listOwnerBucketSummariesMock,
    listAllByOwnerId: listAllByOwnerIdMock,
    remapOwnerIdByType: remapOwnerIdByTypeMock,
    hardDeleteMany: hardDeleteManyMock
  }
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  deleteLoginMigrationExcerpts,
  importLoginMigration,
  summarizeLoginMigration
} from '@/application/identity/login-migration'

const accountId = '22222222-2222-4222-8222-222222222222'
const localProfileId = '11111111-1111-4111-8111-111111111111'

describe('login-migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
    getAccountBindingMock.mockResolvedValue({
      accountId,
      boundAt: '2026-08-01T00:00:00.000Z'
    })
  })

  it('无外籍摘录时不 pending', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: accountId, activeCount: 2, totalCount: 2 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([])
    await expect(summarizeLoginMigration(accountId)).resolves.toMatchObject({
      pending: false,
      excerptCount: 0,
      localBookmarkCount: 0
    })
  })

  it('本地档有摘录时 pending', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: localProfileId, activeCount: 2, totalCount: 2 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt', ownerId: localProfileId },
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
    await expect(summarizeLoginMigration(accountId)).resolves.toMatchObject({
      pending: true,
      excerptCount: 1,
      localBookmarkCount: 1,
      sourceOwnerIds: [localProfileId]
    })
  })

  it('Import 迁摘录与本地档书签', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: localProfileId, activeCount: 2, totalCount: 2 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt', ownerId: localProfileId },
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
    remapOwnerIdByTypeMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1)

    await expect(importLoginMigration(accountId)).resolves.toEqual({
      importedExcerpts: 1,
      remappedLocalBookmarks: 1
    })
    expect(remapOwnerIdByTypeMock).toHaveBeenCalledWith(localProfileId, accountId, 'text_excerpt')
    expect(remapOwnerIdByTypeMock).toHaveBeenCalledWith(localProfileId, accountId, 'bookmark')
  })

  it('Delete 硬删未归属摘录', async () => {
    listOwnerBucketSummariesMock.mockResolvedValue([
      { ownerId: localProfileId, activeCount: 1, totalCount: 1 }
    ])
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt', ownerId: localProfileId }
    ])
    hardDeleteManyMock.mockResolvedValue(1)
    await expect(deleteLoginMigrationExcerpts(accountId)).resolves.toEqual({ deletedCount: 1 })
    expect(hardDeleteManyMock).toHaveBeenCalledWith(['e1'])
  })
})
