import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getOrCreateLocalProfileMock,
  remapOwnerIdByTypeMock,
  listAllByOwnerIdMock,
  replaceOwnerItemsMock
} = vi.hoisted(() => ({
  getOrCreateLocalProfileMock: vi.fn(),
  remapOwnerIdByTypeMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  replaceOwnerItemsMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
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

import { clearAccountLibraryOnSignOut } from '@/application/identity/clear-account-library-on-sign-out'

const accountId = '22222222-2222-4222-8222-222222222222'
const localProfileId = '11111111-1111-4111-8111-111111111111'

describe('clearAccountLibraryOnSignOut', () => {
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
    await expect(clearAccountLibraryOnSignOut(accountId)).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 0
    })
    expect(remapOwnerIdByTypeMock).not.toHaveBeenCalled()
  })

  it('书签回迁后清空账号桶剩余', async () => {
    remapOwnerIdByTypeMock.mockResolvedValue(4)
    listAllByOwnerIdMock.mockResolvedValue([
      { id: 'e1', type: 'text_excerpt' },
      { id: 'e2', type: 'text_excerpt' }
    ])
    replaceOwnerItemsMock.mockResolvedValue(0)

    await expect(clearAccountLibraryOnSignOut(accountId)).resolves.toEqual({
      clearedCount: 2,
      remappedBookmarks: 4
    })
    expect(remapOwnerIdByTypeMock).toHaveBeenCalledWith(accountId, localProfileId, 'bookmark')
    expect(replaceOwnerItemsMock).toHaveBeenCalledWith(accountId, [])
  })

  it('无剩余则不 replace', async () => {
    remapOwnerIdByTypeMock.mockResolvedValue(1)
    listAllByOwnerIdMock.mockResolvedValue([])
    await expect(clearAccountLibraryOnSignOut(accountId)).resolves.toEqual({
      clearedCount: 0,
      remappedBookmarks: 1
    })
    expect(replaceOwnerItemsMock).not.toHaveBeenCalled()
  })
})
