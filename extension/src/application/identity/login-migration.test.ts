import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getOrCreateLocalProfileMock,
  listOwnerBucketSummariesMock,
  listAllByOwnerIdMock,
  remapOwnerIdByTypeMock,
  replaceOwnerItemsMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  listOwnerBucketSummariesMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  remapOwnerIdByTypeMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn()
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
    replaceOwnerItems: replaceOwnerItemsMock
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
const otherAccountId = '33333333-3333-4333-8333-333333333333'

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

  it('无本地档摘录时不 pending', async () => {
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
    await expect(summarizeLoginMigration(accountId)).resolves.toMatchObject({
      pending: false,
      excerptCount: 0,
      localBookmarkCount: 1,
      sourceOwnerIds: []
    })
  })

  it('本地档有摘录时 pending', async () => {
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

  it('外账号桶摘录不计入门闸（退出应已清）', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    await expect(summarizeLoginMigration(accountId)).resolves.toMatchObject({
      pending: false,
      excerptCount: 0,
      sourceOwnerIds: []
    })
    expect(listAllByOwnerIdMock).toHaveBeenCalledWith(localProfileId, { includeDeleted: false })
    expect(listOwnerBucketSummariesMock).not.toHaveBeenCalled()
    void otherAccountId
  })

  it('Import 迁本地档摘录与书签', async () => {
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt', ownerId: localProfileId },
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
    remapOwnerIdByTypeMock.mockResolvedValueOnce(1).mockResolvedValueOnce(1)

    await expect(importLoginMigration(accountId)).resolves.toEqual({
      importedExcerpts: 1,
      remappedLocalBookmarks: 1
    })
    expect(remapOwnerIdByTypeMock).toHaveBeenNthCalledWith(
      1,
      localProfileId,
      accountId,
      'text_excerpt'
    )
    expect(remapOwnerIdByTypeMock).toHaveBeenNthCalledWith(2, localProfileId, accountId, 'bookmark')
  })

  it('Delete 用 replaceOwnerItems 清本地档摘录', async () => {
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt', ownerId: localProfileId },
      { id: 'e2', type: 'text_excerpt', ownerId: localProfileId, deletedAt: 'x' },
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
    replaceOwnerItemsMock.mockResolvedValue(1)

    await expect(deleteLoginMigrationExcerpts(accountId)).resolves.toEqual({ deletedCount: 2 })
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(localProfileId, [
      { id: 'b1', type: 'bookmark', ownerId: localProfileId }
    ])
  })
})
