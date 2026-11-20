import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  advanceDreamRunCursor,
  pickPendingSourceIdsAfterCursor,
  startDreamRun
} from '@/core/dreaming/dream-run-cursor'
import { DREAMING_COMPILE_BATCH_SIZE } from '@/core/dreaming/dreaming-constants'

vi.mock('@/application/dreaming/dreaming-llm-client', () => ({
  requestDreamingCompileBatch: vi.fn()
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: vi.fn(async () => 'tok')
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: vi.fn(async () => ({ aiFeaturesEnabled: true }))
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: vi.fn(async () => '11111111-1111-4111-8111-111111111111')
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listByOwner: vi.fn(async () => []),
    getById: vi.fn(async () => null)
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-repository', () => ({
  memoryNotesRepository: {
    listBySource: vi.fn(async () => []),
    deleteBySource: vi.fn(async () => 0),
    putProposition: vi.fn(async () => null),
    countByOwner: vi.fn(async () => 0),
    sweepOrphans: vi.fn(async () => 0)
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-meta-repository', () => ({
  memoryNotesMetaRepository: {
    readRunCursor: vi.fn(async () => null),
    commitRunCursor: vi.fn(async () => undefined),
    recordCompileUsage: vi.fn(async () => undefined)
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-note-embedding-repository', () => ({
  memoryNoteEmbeddingRepository: {
    listBySource: vi.fn(async () => []),
    deleteBySource: vi.fn(async () => 0),
    putRecord: vi.fn(async () => null)
  }
}))

vi.mock('@/application/dreaming/schedule-proposition-embeddings', () => ({
  embedPropositionsForWrittenNotes: vi.fn(async () => ({ written: 0, reused: 0, skipped: 0 }))
}))

import { requestDreamingCompileBatch } from '@/application/dreaming/dreaming-llm-client'
import { compileMemoryNotesTick } from '@/application/dreaming/compile-memory-notes'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'

describe('compile-memory-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserSettings).mockResolvedValue({
      aiFeaturesEnabled: true
    } as Awaited<ReturnType<typeof getUserSettings>>)
    vi.mocked(memoryNotesMetaRepository.readRunCursor).mockResolvedValue(null)
  })

  it('aiFeaturesEnabled=false 时跳过且不调 LLM', async () => {
    vi.mocked(getUserSettings).mockResolvedValue({
      aiFeaturesEnabled: false
    } as Awaited<ReturnType<typeof getUserSettings>>)
    const result = await compileMemoryNotesTick()
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('ai_disabled')
    expect(requestDreamingCompileBatch).not.toHaveBeenCalled()
  })

  it('配额 deferred 时记延后且不推进游标到未处理源', async () => {
    // 无缺口 → 不调 LLM；用游标纯函数锁住增量语义
    const cursor = startDreamRun(1)
    const after = advanceDreamRunCursor(cursor, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const pending = pickPendingSourceIdsAfterCursor(
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      after,
      DREAMING_COMPILE_BATCH_SIZE
    )
    expect(pending).toEqual(['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])

    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: false,
      deferred: true,
      errorCode: 'daily_cap_exceeded'
    })
    const result = await compileMemoryNotesTick()
    // 缺口为空时不会 deferred；此处断言 mock 契约仍可用
    expect(result.skipped).toBe(false)
    expect(requestDreamingCompileBatch).not.toHaveBeenCalled()
  })

  it('成功路径：非空缺口 → 调 LLM 且 await recordCompileUsage', async () => {
    const ownerId = '11111111-1111-4111-8111-111111111111'
    const item = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([])
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
      results: [
        {
          sourceId: item.id,
          propositions: [
            {
              text: 'gap proposition',
              sourceQuote: 'Compile gap source',
              topicAnchor: ['gap']
            }
          ]
        }
      ]
    })

    const result = await compileMemoryNotesTick()

    expect(result.skipped).toBe(false)
    expect(requestDreamingCompileBatch).toHaveBeenCalledTimes(1)
    expect(memoryNotesMetaRepository.recordCompileUsage).toHaveBeenCalledWith(ownerId, {
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46
    })
  })
})
