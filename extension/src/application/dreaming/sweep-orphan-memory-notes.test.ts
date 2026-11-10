import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: vi.fn(async () => '11111111-1111-4111-8111-111111111111')
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listAllByOwnerId: vi.fn()
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-repository', () => ({
  memoryNotesRepository: {
    sweepOrphans: vi.fn()
  }
}))

import { sweepOrphanMemoryNotes } from '@/application/dreaming/sweep-orphan-memory-notes'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'

describe('sweep-orphan-memory-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('只把未软删源 id 交给 sweepOrphans', async () => {
    vi.mocked(memoryItemRepository.listAllByOwnerId).mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', deletedAt: null },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', deletedAt: '2026-11-10T00:00:00.000Z' }
    ] as never)
    vi.mocked(memoryNotesRepository.sweepOrphans).mockResolvedValue(2)

    const result = await sweepOrphanMemoryNotes('11111111-1111-4111-8111-111111111111')
    expect(result.deleted).toBe(2)
    expect(memoryNotesRepository.sweepOrphans).toHaveBeenCalledWith({
      ownerId: '11111111-1111-4111-8111-111111111111',
      existingSourceIds: new Set(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'])
    })
  })
})
