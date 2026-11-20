import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getOrCreateLocalProfileMock,
  remapOwnerIdMock,
  remapOwnerIdByTypeMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock
} = vi.hoisted(() => ({
  getOrCreateLocalProfileMock: vi.fn(),
  remapOwnerIdMock: vi.fn(),
  remapOwnerIdByTypeMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: remapOwnerIdMock,
    remapOwnerIdByType: remapOwnerIdByTypeMock,
    listAllByOwnerId: listAllByOwnerIdMock,
    replaceOwnerItems: replaceOwnerItemsMock
  }
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  clearAccountLibraryOnSignOut,
  remapAccountLibraryToLocalProfile
} from '@/application/identity/clear-account-library-on-sign-out'

const accountId = '22222222-2222-4222-8222-222222222222'
const localProfileId = '11111111-1111-4111-8111-111111111111'

describe('remapAccountLibraryToLocalProfile / clearAccountLibraryOnSignOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
  })

  it('same_id 跳过', async () => {
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId: accountId,
      createdAt: '2026-08-01T00:00:00.000Z'
    })
    await expect(remapAccountLibraryToLocalProfile(accountId)).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 0,
      remappedExcerpts: 0
    })
    expect(remapOwnerIdMock).not.toHaveBeenCalled()
    expect(remapOwnerIdByTypeMock).not.toHaveBeenCalled()
  })

  it('默认全量回迁：摘录与书签均 remap，不删', async () => {
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'b1', type: 'bookmark' },
      { id: 'b2', type: 'bookmark' },
      { id: 'e1', type: 'text_excerpt' },
      { id: 'e2', type: 'text_excerpt' }
    ])
    remapOwnerIdMock.mockResolvedValue(4)

    await expect(clearAccountLibraryOnSignOut(accountId)).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 2,
      remappedExcerpts: 2
    })
    expect(remapOwnerIdMock).toHaveBeenCalledWith(accountId, localProfileId)
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
    expect(remapOwnerIdByTypeMock).not.toHaveBeenCalled()
  })

  it('deleteLocalExcerpts: true 走旧口径 A（书签回迁 + 删摘录）', async () => {
    remapOwnerIdByTypeMock.mockResolvedValue(4)
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt' },
      { id: 'e2', type: 'text_excerpt' }
    ])
    replaceOwnerItemsMock.mockResolvedValue(0)

    await expect(
      remapAccountLibraryToLocalProfile(accountId, { deleteLocalExcerpts: true })
    ).resolves.toEqual({
      clearedCount: 2,
      remappedBookmarks: 4,
      remappedExcerpts: 0
    })
    expect(remapOwnerIdByTypeMock).toHaveBeenCalledWith(accountId, localProfileId, 'bookmark')
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
    expect(remapOwnerIdMock).not.toHaveBeenCalled()
  })

  it('deleteLocalExcerpts: true 无剩余则不 replace', async () => {
    remapOwnerIdByTypeMock.mockResolvedValue(1)
    listAllByOwnerIdMock.mockResolvedValue([])
    await expect(
      clearAccountLibraryOnSignOut(accountId, { deleteLocalExcerpts: true })
    ).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 1,
      remappedExcerpts: 0
    })
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
  })

  it('默认空桶不调用 remapOwnerId', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    await expect(remapAccountLibraryToLocalProfile(accountId)).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 0,
      remappedExcerpts: 0
    })
    expect(remapOwnerIdMock).not.toHaveBeenCalled()
  })
})
