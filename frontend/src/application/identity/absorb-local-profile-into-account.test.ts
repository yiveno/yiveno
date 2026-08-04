import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getOrCreateLocalProfileMock, remapOwnerIdMock } = vi.hoisted(() => ({
  getOrCreateLocalProfileMock: vi.fn(),
  remapOwnerIdMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    remapOwnerId: remapOwnerIdMock
  }
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn()
}))

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'

describe('absorbLocalProfileIntoAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('localProfileId 与 accountId 相同时不 remap', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    getOrCreateLocalProfileMock.mockResolvedValue({ localProfileId: id, createdAt: 'x' })
    await expect(absorbLocalProfileIntoAccount(id)).resolves.toBe(0)
    expect(remapOwnerIdMock).not.toHaveBeenCalled()
  })

  it('将本地档 remap 到账号并返回条数', async () => {
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId: '11111111-1111-4111-8111-111111111111',
      createdAt: 'x'
    })
    remapOwnerIdMock.mockResolvedValue(3)
    await expect(
      absorbLocalProfileIntoAccount('22222222-2222-4222-8222-222222222222')
    ).resolves.toBe(3)
    expect(remapOwnerIdMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222'
    )
  })
})
