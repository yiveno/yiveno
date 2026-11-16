import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getAccountBindingMock,
  getOrCreateLocalProfileMock,
  listAllByOwnerIdMock,
  countByOwnerMock,
  listByOwnerUpdatedMock,
  getMetaMock
} = vi.hoisted(() => ({
  getAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  listAllByOwnerIdMock: vi.fn(),
  countByOwnerMock: vi.fn(),
  listByOwnerUpdatedMock: vi.fn(),
  getMetaMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: getAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock,
  clearAccountBinding: vi.fn(),
  setAccountBinding: vi.fn()
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listAllByOwnerId: listAllByOwnerIdMock
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-repository', () => ({
  memoryNotesRepository: {
    countByOwner: countByOwnerMock,
    listByOwnerUpdated: listByOwnerUpdatedMock
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-meta-repository', () => ({
  memoryNotesMetaRepository: {
    getMeta: getMetaMock
  }
}))

import { handleExportLocalMemory } from '@/background/handlers/account-sync-handler'

const LOCAL_PROFILE = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-07T00:00:00.000Z',
  schemaVersion: 1
}

const SAMPLE_ITEM = { id: 'item-1', ownerId: LOCAL_PROFILE.localProfileId }
const SAMPLE_NOTE = {
  id: [LOCAL_PROFILE.localProfileId, 'item-1', '0'].join('\u0000'),
  ownerId: LOCAL_PROFILE.localProfileId,
  sourceMemoryItemId: 'item-1'
}
const SAMPLE_META = {
  ownerId: LOCAL_PROFILE.localProfileId,
  schemaVersion: 1,
  dirty: false
}

describe('handleExportLocalMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAccountBindingMock.mockResolvedValue(null)
    getOrCreateLocalProfileMock.mockResolvedValue(LOCAL_PROFILE)
    listAllByOwnerIdMock.mockResolvedValue([SAMPLE_ITEM])
    countByOwnerMock.mockResolvedValue(1)
    listByOwnerUpdatedMock.mockResolvedValue([SAMPLE_NOTE])
    getMetaMock.mockResolvedValue(SAMPLE_META)
  })

  it('成功返回 items + notes + meta，且 listAll 含软删', async () => {
    const response = await handleExportLocalMemory()
    expect(response).toEqual({
      ok: true,
      ownerId: LOCAL_PROFILE.localProfileId,
      items: [SAMPLE_ITEM],
      memoryNotes: [SAMPLE_NOTE],
      memoryNotesMeta: SAMPLE_META
    })
    expect(listAllByOwnerIdMock).toHaveBeenCalledWith(LOCAL_PROFILE.localProfileId, {
      includeDeleted: true
    })
  })

  it('listByOwnerUpdated 的 limit 经 countByOwner 定', async () => {
    countByOwnerMock.mockResolvedValue(3)
    listByOwnerUpdatedMock.mockResolvedValue([SAMPLE_NOTE, SAMPLE_NOTE, SAMPLE_NOTE])

    const response = await handleExportLocalMemory()
    expect(response.ok).toBe(true)
    expect(countByOwnerMock).toHaveBeenCalledWith(LOCAL_PROFILE.localProfileId)
    expect(listByOwnerUpdatedMock).toHaveBeenCalledWith({
      ownerId: LOCAL_PROFILE.localProfileId,
      limit: 3
    })
  })

  it('meta null 时响应 meta 为 null', async () => {
    getMetaMock.mockResolvedValue(null)
    countByOwnerMock.mockResolvedValue(0)

    const response = await handleExportLocalMemory()
    expect(response).toEqual({
      ok: true,
      ownerId: LOCAL_PROFILE.localProfileId,
      items: [SAMPLE_ITEM],
      memoryNotes: [],
      memoryNotesMeta: null
    })
    expect(listByOwnerUpdatedMock).not.toHaveBeenCalled()
  })

  it('有绑定账号时 ownerId 用 accountId', async () => {
    getAccountBindingMock.mockResolvedValue({
      accountId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      boundAt: '2026-08-07T00:00:00.000Z'
    })
    listAllByOwnerIdMock.mockResolvedValue([])
    countByOwnerMock.mockResolvedValue(0)
    getMetaMock.mockResolvedValue(null)

    const response = await handleExportLocalMemory()
    expect(response.ok).toBe(true)
    if (response.ok) {
      expect(response.ownerId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    }
    expect(listAllByOwnerIdMock).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      includeDeleted: true
    })
    expect(getOrCreateLocalProfileMock).not.toHaveBeenCalled()
  })

  it('notes 读取失败 → LOCAL_EXPORT_FAILED', async () => {
    countByOwnerMock.mockRejectedValue(new Error('notes boom'))
    const response = await handleExportLocalMemory()
    expect(response).toEqual({
      ok: false,
      errorCode: 'LOCAL_EXPORT_FAILED',
      error: 'notes boom'
    })
  })

  it('meta 读取失败 → LOCAL_EXPORT_FAILED', async () => {
    getMetaMock.mockRejectedValue(new Error('meta boom'))
    const response = await handleExportLocalMemory()
    expect(response).toEqual({
      ok: false,
      errorCode: 'LOCAL_EXPORT_FAILED',
      error: 'meta boom'
    })
  })

  it('空库 → 空数组 + meta null', async () => {
    listAllByOwnerIdMock.mockResolvedValue([])
    countByOwnerMock.mockResolvedValue(0)
    getMetaMock.mockResolvedValue(null)

    const response = await handleExportLocalMemory()
    expect(response).toEqual({
      ok: true,
      ownerId: LOCAL_PROFILE.localProfileId,
      items: [],
      memoryNotes: [],
      memoryNotesMeta: null
    })
  })
})
