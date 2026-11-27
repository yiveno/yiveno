import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  advanceDreamRunCursor,
  pickPendingSourceIdsAfterCursor,
  startDreamRun,
  type DreamRunCursor
} from '@/core/dreaming/dream-run-cursor'
import { DREAMING_COMPILE_BATCH_SIZE } from '@/core/dreaming/dreaming-constants'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

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
import { memoryNoteEmbeddingRepository } from '@/infrastructure/indexeddb/memory-note-embedding-repository'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'

const OWNER_ID = '11111111-1111-4111-8111-111111111111'

function makeStaleNote(sourceId: string, sourceUpdatedAt: string): MemoryNoteRecord {
  return {
    id: `${OWNER_ID}\0${sourceId}\0${0}`,
    ownerId: OWNER_ID,
    sourceMemoryItemId: sourceId,
    sourceType: 'bookmark',
    text: 'old proposition keep me',
    sourceQuote: 'Compile gap source',
    topicAnchor: ['old'],
    dreamRunId: 'dream_old',
    version: 1,
    schemaVersion: 1,
    sourceUpdatedAt,
    createdAt: '2026-07-21T06:00:00.000Z',
    updatedAt: '2026-07-21T06:00:00.000Z'
  }
}

describe('compile-memory-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUserSettings).mockResolvedValue({
      aiFeaturesEnabled: true
    } as Awaited<ReturnType<typeof getUserSettings>>)
    vi.mocked(memoryNotesMetaRepository.readRunCursor).mockResolvedValue(null)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([])
    vi.mocked(memoryNotesRepository.deleteBySource).mockResolvedValue(0)
    vi.mocked(memoryNoteEmbeddingRepository.deleteBySource).mockResolvedValue(0)
    vi.mocked(memoryNotesRepository.putProposition).mockResolvedValue(null)
  })

  it('aiFeaturesEnabled=false 时跳过且不调 LLM', async () => {
    vi.mocked(getUserSettings).mockResolvedValue({
      aiFeaturesEnabled: false
    } as Awaited<ReturnType<typeof getUserSettings>>)
    const result = await compileMemoryNotesTick()
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('ai_disabled')
    expect(result.failedSources).toBe(0)
    expect(result.restartedRunForRetry).toBe(false)
    expect(requestDreamingCompileBatch).not.toHaveBeenCalled()
  })

  it('配额 deferred 时记延后且不推进游标到未处理源', async () => {
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
    expect(result.skipped).toBe(false)
    expect(requestDreamingCompileBatch).not.toHaveBeenCalled()
  })

  it('成功路径：非空缺口 → 调 LLM 且 await recordCompileUsage', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
      results: [
        {
          sourceId: item.id,
          status: 'ok',
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
    expect(result.processedSources).toBe(1)
    expect(result.failedSources).toBe(0)
    expect(result.restartedRunForRetry).toBe(false)
    expect(requestDreamingCompileBatch).toHaveBeenCalledTimes(1)
    expect(memoryNotesMetaRepository.recordCompileUsage).toHaveBeenCalledWith(OWNER_ID, {
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46
    })
    expect(memoryNotesRepository.deleteBySource).toHaveBeenCalled()
  })

  it('omitted 时旧 notes 不删，并开新 run 供重试', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const oldNote = makeStaleNote(item.id, '2026-07-21T06:00:00.000Z')
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([oldNote])
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      results: []
    })

    const result = await compileMemoryNotesTick()

    expect(result.processedSources).toBe(0)
    expect(result.failedSources).toBe(1)
    expect(result.restartedRunForRetry).toBe(true)
    expect(memoryNotesRepository.deleteBySource).not.toHaveBeenCalled()
    expect(memoryNoteEmbeddingRepository.deleteBySource).not.toHaveBeenCalled()
    const lastCommit = vi.mocked(memoryNotesMetaRepository.commitRunCursor).mock.calls.at(-1)
    expect(lastCommit?.[1].lastCursor).toBe('')
    expect(lastCommit?.[1].dreamRunId).not.toBe('dream_old')
  })

  it('dropped 时旧 notes 不删，并开新 run 供重试', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const oldNote = makeStaleNote(item.id, '2026-07-21T06:00:00.000Z')
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([oldNote])
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      results: [
        {
          sourceId: item.id,
          status: 'dropped',
          propositions: []
        }
      ]
    })

    const result = await compileMemoryNotesTick()

    expect(result.processedSources).toBe(0)
    expect(result.failedSources).toBe(1)
    expect(result.restartedRunForRetry).toBe(true)
    expect(memoryNotesRepository.deleteBySource).not.toHaveBeenCalled()
    expect(memoryNoteEmbeddingRepository.deleteBySource).not.toHaveBeenCalled()
  })

  it('empty 时旧 notes 被删', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const oldNote = makeStaleNote(item.id, '2026-07-21T06:00:00.000Z')
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([oldNote])
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      results: [
        {
          sourceId: item.id,
          status: 'empty',
          propositions: []
        }
      ]
    })

    const result = await compileMemoryNotesTick()

    expect(result.processedSources).toBe(1)
    expect(result.failedSources).toBe(0)
    expect(result.restartedRunForRetry).toBe(false)
    expect(memoryNotesRepository.deleteBySource).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      sourceMemoryItemId: item.id
    })
    expect(memoryNoteEmbeddingRepository.deleteBySource).toHaveBeenCalled()
  })

  it('ok 时旧 notes 被替换', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const oldNote = makeStaleNote(item.id, '2026-07-21T06:00:00.000Z')
    const written = makeStaleNote(item.id, item.updatedAt)
    written.text = 'new proposition'
    written.dreamRunId = 'dream_new'
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([oldNote])
    vi.mocked(memoryNotesRepository.putProposition).mockResolvedValue(written)
    vi.mocked(requestDreamingCompileBatch).mockResolvedValue({
      ok: true,
      model: 'test-model',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      results: [
        {
          sourceId: item.id,
          status: 'ok',
          propositions: [
            {
              text: 'new proposition',
              sourceQuote: 'Compile gap source',
              topicAnchor: ['new']
            }
          ]
        }
      ]
    })

    const result = await compileMemoryNotesTick()

    expect(result.processedSources).toBe(1)
    expect(result.failedSources).toBe(0)
    expect(result.writtenPropositions).toBe(1)
    expect(result.restartedRunForRetry).toBe(false)
    expect(memoryNotesRepository.deleteBySource).toHaveBeenCalled()
    expect(memoryNotesRepository.putProposition).toHaveBeenCalled()
  })

  it('dropped source 下一 tick 被重新编译，重试成功前旧 notes 不变', async () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER_ID,
      sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
      payload: { title: 'Compile gap source', url: 'https://example.com/gap' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    const oldNote = makeStaleNote(item.id, '2026-07-21T06:00:00.000Z')
    vi.mocked(memoryItemRepository.listByOwner).mockResolvedValue([item])
    vi.mocked(memoryItemRepository.getById).mockResolvedValue(item)
    vi.mocked(memoryNotesRepository.listBySource).mockResolvedValue([oldNote])

    const cursorBox: { current: DreamRunCursor | null } = { current: null }
    vi.mocked(memoryNotesMetaRepository.commitRunCursor).mockImplementation(
      async (_ownerId, cursor) => {
        cursorBox.current = { ...cursor }
      }
    )
    vi.mocked(memoryNotesMetaRepository.readRunCursor).mockImplementation(
      async () => cursorBox.current
    )

    vi.mocked(requestDreamingCompileBatch)
      .mockResolvedValueOnce({
        ok: true,
        model: 'test-model',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        results: [{ sourceId: item.id, status: 'dropped', propositions: [] }]
      })
      .mockResolvedValueOnce({
        ok: true,
        model: 'test-model',
        usage: { promptTokens: 2, completionTokens: 2, totalTokens: 4 },
        results: [
          {
            sourceId: item.id,
            status: 'ok',
            propositions: [
              {
                text: 'retry proposition',
                sourceQuote: 'Compile gap source',
                topicAnchor: ['retry']
              }
            ]
          }
        ]
      })

    const first = await compileMemoryNotesTick()
    expect(first.failedSources).toBe(1)
    expect(first.restartedRunForRetry).toBe(true)
    expect(memoryNotesRepository.deleteBySource).not.toHaveBeenCalled()
    expect(cursorBox.current?.lastCursor).toBe('')

    const written = makeStaleNote(item.id, item.updatedAt)
    written.text = 'retry proposition'
    vi.mocked(memoryNotesRepository.putProposition).mockResolvedValue(written)

    const second = await compileMemoryNotesTick()
    expect(requestDreamingCompileBatch).toHaveBeenCalledTimes(2)
    expect(second.processedSources).toBe(1)
    expect(second.failedSources).toBe(0)
    expect(second.writtenPropositions).toBe(1)
    expect(second.restartedRunForRetry).toBe(false)
    expect(memoryNotesRepository.deleteBySource).toHaveBeenCalledTimes(1)
  })
})
