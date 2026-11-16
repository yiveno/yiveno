/**
 * Phase 4.1：merge 双重门控（prefer-read OFF / 语义子开关 OFF → 无语义）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCurrentOwnerIdMock, getMetaMock, findNoteMatchesForQueryMock, getByIdMock } = vi.hoisted(
  () => ({
    getCurrentOwnerIdMock: vi.fn(),
    getMetaMock: vi.fn(),
    findNoteMatchesForQueryMock: vi.fn(),
    getByIdMock: vi.fn()
  })
)

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-meta-repository', () => ({
  memoryNotesMetaRepository: {
    getMeta: getMetaMock
  }
}))

vi.mock('@/core/recall/note-match', async () => {
  const actual = await vi.importActual<typeof import('@/core/recall/note-match')>(
    '@/core/recall/note-match'
  )
  return {
    ...actual,
    findNoteMatchesForQuery: findNoteMatchesForQueryMock
  }
})

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    getById: getByIdMock
  }
}))

import { mergeNoteMatchesForRecall } from '@/application/recall/note-match-merge'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('mergeNoteMatchesForRecall · 语义双重门控', () => {
  beforeEach(() => {
    getCurrentOwnerIdMock.mockReset()
    getMetaMock.mockReset()
    findNoteMatchesForQueryMock.mockReset()
    getByIdMock.mockReset()
    getCurrentOwnerIdMock.mockResolvedValue(OWNER)
    getMetaMock.mockResolvedValue({ itemCount: 3 })
    findNoteMatchesForQueryMock.mockResolvedValue([])
  })

  it('prefer-read OFF 时不扫命题（即使语义子开关 ON）', async () => {
    await mergeNoteMatchesForRecall({
      listedItems: [],
      listedSource: 'scan',
      contentTerms: ['cheap', 'stay'],
      preferReadEnabled: false,
      semanticEnabled: true,
      queryVector: [0.1, 0.2, 0.3]
    })
    expect(findNoteMatchesForQueryMock).not.toHaveBeenCalled()
  })

  it('语义子开关 OFF 时不传 semanticEnabled（即使有 queryVector）', async () => {
    await mergeNoteMatchesForRecall({
      listedItems: [],
      listedSource: 'scan',
      contentTerms: ['cheap', 'stay'],
      preferReadEnabled: true,
      semanticEnabled: false,
      queryVector: [0.1, 0.2, 0.3]
    })
    expect(findNoteMatchesForQueryMock).toHaveBeenCalledTimes(1)
    const arg = findNoteMatchesForQueryMock.mock.calls[0]![0]
    expect(arg.semanticEnabled).toBeUndefined()
    expect(arg.queryVector).toBeUndefined()
  })

  it('双重门控 ON + queryVector → 打开语义匹配', async () => {
    await mergeNoteMatchesForRecall({
      listedItems: [],
      listedSource: 'scan',
      contentTerms: ['cheap', 'stay'],
      preferReadEnabled: true,
      semanticEnabled: true,
      semanticMinSimilarity: 0.66,
      queryVector: [0.1, 0.2, 0.3]
    })
    const arg = findNoteMatchesForQueryMock.mock.calls[0]![0]
    expect(arg.semanticEnabled).toBe(true)
    expect(arg.queryVector).toEqual([0.1, 0.2, 0.3])
    expect(arg.semanticMinSimilarity).toBe(0.66)
  })
})
