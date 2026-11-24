/**
 * Phase 4.1：命题向量生产批量 / 模型门控 / 重算复用 / 回填 fail-open。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  requestWorkerEmbeddingsMock,
  gateWorkerEmbedRequestMock,
  tripEmbedQuotaBreakerFromErrorMock,
  putRecordMock,
  listByOwnerUpdatedMock,
  listByOwnerEmbedMock,
  getWorkerApiAccessTokenMock,
  getUserSettingsMock,
  getCurrentOwnerIdMock
} = vi.hoisted(() => ({
  requestWorkerEmbeddingsMock: vi.fn(),
  gateWorkerEmbedRequestMock: vi.fn(),
  tripEmbedQuotaBreakerFromErrorMock: vi.fn(),
  putRecordMock: vi.fn(),
  listByOwnerUpdatedMock: vi.fn(),
  listByOwnerEmbedMock: vi.fn(),
  getWorkerApiAccessTokenMock: vi.fn(),
  getUserSettingsMock: vi.fn(),
  getCurrentOwnerIdMock: vi.fn()
}))

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  WORKER_EMBEDDING_MODEL: '@cf/baai/bge-m3',
  requestWorkerEmbeddings: requestWorkerEmbeddingsMock
}))

vi.mock('@/infrastructure/ai/embed-quota-circuit-breaker', () => ({
  gateWorkerEmbedRequest: gateWorkerEmbedRequestMock,
  tripEmbedQuotaBreakerFromError: tripEmbedQuotaBreakerFromErrorMock
}))

vi.mock('@/infrastructure/indexeddb/memory-note-embedding-repository', () => ({
  memoryNoteEmbeddingRepository: {
    putRecord: putRecordMock,
    listByOwner: listByOwnerEmbedMock,
    listBySource: vi.fn(async () => []),
    deleteBySource: vi.fn(async () => 0)
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-notes-repository', () => ({
  memoryNotesRepository: {
    listByOwnerUpdated: listByOwnerUpdatedMock
  }
}))

vi.mock('@/infrastructure/identity/worker-api-access-token', () => ({
  getWorkerApiAccessToken: getWorkerApiAccessTokenMock
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: getUserSettingsMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock
}))

import {
  backfillPropositionEmbeddingsTick,
  embedPropositionsForWrittenNotes
} from '@/application/dreaming/schedule-proposition-embeddings'
import type { MemoryNoteEmbeddingLoaded } from '@/infrastructure/indexeddb/memory-note-embedding-types'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function makeNoteInput(index: number, text: string) {
  return {
    noteId: `${OWNER}\0${SOURCE}\0${index}`,
    ownerId: OWNER,
    sourceMemoryItemId: SOURCE,
    text,
    sourceQuote: `quote-${index}`
  }
}

describe('schedule-proposition-embeddings', () => {
  beforeEach(() => {
    requestWorkerEmbeddingsMock.mockReset()
    gateWorkerEmbedRequestMock.mockReset()
    tripEmbedQuotaBreakerFromErrorMock.mockReset()
    putRecordMock.mockReset()
    listByOwnerUpdatedMock.mockReset()
    listByOwnerEmbedMock.mockReset()
    getWorkerApiAccessTokenMock.mockReset()
    getUserSettingsMock.mockReset()
    getCurrentOwnerIdMock.mockReset()
    putRecordMock.mockResolvedValue({})
    gateWorkerEmbedRequestMock.mockResolvedValue({ allow: true })
    getUserSettingsMock.mockResolvedValue({ aiFeaturesEnabled: true })
    getWorkerApiAccessTokenMock.mockResolvedValue('tok')
    getCurrentOwnerIdMock.mockResolvedValue(OWNER)
  })

  it('向量生产批量 8 条/请求', async () => {
    const notes = Array.from({ length: 10 }, (_v, i) =>
      makeNoteInput(i, `Proposition text number ${i} about travel costs.`)
    )
    requestWorkerEmbeddingsMock.mockImplementation(async (_token: string, texts: string[]) => ({
      model: '@cf/baai/bge-m3',
      dim: 4,
      embeddings: texts.map(() => [0.1, 0.2, 0.3, 0.4])
    }))

    const result = await embedPropositionsForWrittenNotes({
      accessToken: 'tok',
      notes
    })

    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(2)
    expect(requestWorkerEmbeddingsMock.mock.calls[0]![1]).toHaveLength(8)
    expect(requestWorkerEmbeddingsMock.mock.calls[1]![1]).toHaveLength(2)
    expect(result.written).toBe(10)
    expect(result.reused).toBe(0)
  })

  it('模型门控：模型变则重算', async () => {
    const note = makeNoteInput(0, 'Hostel near the beach costs thirty dollars.')
    const previous = new Map<string, MemoryNoteEmbeddingLoaded>([
      [
        note.noteId,
        {
          id: note.noteId,
          ownerId: OWNER,
          sourceMemoryItemId: SOURCE,
          inputText: `${note.text}\n${note.sourceQuote}`,
          embedding: new Float32Array([1, 0, 0, 0]),
          embeddingModel: 'old-model',
          embeddingDim: 4,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    ])
    requestWorkerEmbeddingsMock.mockResolvedValue({
      model: '@cf/baai/bge-m3',
      dim: 4,
      embeddings: [[0.2, 0.2, 0.2, 0.2]]
    })

    const result = await embedPropositionsForWrittenNotes({
      accessToken: 'tok',
      notes: [note],
      previousByNoteId: previous
    })

    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(1)
    expect(result.written).toBe(1)
    expect(result.reused).toBe(0)
  })

  it('重算复用：文本 + 模型未变跳过', async () => {
    const note = makeNoteInput(0, 'Hostel near the beach costs thirty dollars.')
    const inputText = `${note.text}\n${note.sourceQuote}`
    const previous = new Map<string, MemoryNoteEmbeddingLoaded>([
      [
        note.noteId,
        {
          id: note.noteId,
          ownerId: OWNER,
          sourceMemoryItemId: SOURCE,
          inputText,
          embedding: new Float32Array([1, 0, 0, 0]),
          embeddingModel: '@cf/baai/bge-m3',
          embeddingDim: 4,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    ])

    const result = await embedPropositionsForWrittenNotes({
      accessToken: 'tok',
      notes: [note],
      previousByNoteId: previous
    })

    expect(requestWorkerEmbeddingsMock).not.toHaveBeenCalled()
    expect(result.reused).toBe(1)
    expect(result.written).toBe(0)
    expect(putRecordMock).toHaveBeenCalledTimes(1)
  })

  it('回填失败 fail-open（无向量命题仍可继续；本 tick 记 failed）', async () => {
    listByOwnerUpdatedMock.mockResolvedValue([
      {
        id: `${OWNER}\0${SOURCE}\0${0}`,
        ownerId: OWNER,
        sourceMemoryItemId: SOURCE,
        sourceType: 'text_excerpt',
        text: 'A gap proposition without embedding yet.',
        sourceQuote: 'gap quote',
        topicAnchor: [],
        dreamRunId: 'run',
        version: 1,
        schemaVersion: 1,
        sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ])
    listByOwnerEmbedMock.mockResolvedValue([])
    requestWorkerEmbeddingsMock.mockRejectedValue(new Error('quota_exceeded'))

    const result = await backfillPropositionEmbeddingsTick()
    expect(result.skipped).toBe(false)
    expect(result.failed).toBe(1)
    expect(result.written).toBe(0)
  })

  it('回填 pacing：单次不超过 BACKFILL_BATCH_LIMIT 条缺口', async () => {
    const gaps = Array.from({ length: 45 }, (_v, i) => ({
      id: `${OWNER}\0${SOURCE}\0${i}`,
      ownerId: OWNER,
      sourceMemoryItemId: SOURCE,
      sourceType: 'text_excerpt' as const,
      text: `Gap proposition ${i} about lodging prices near water.`,
      sourceQuote: `quote ${i}`,
      topicAnchor: [],
      dreamRunId: 'run',
      version: 1,
      schemaVersion: 1,
      sourceUpdatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }))
    listByOwnerUpdatedMock.mockResolvedValue(gaps)
    listByOwnerEmbedMock.mockResolvedValue([])
    requestWorkerEmbeddingsMock.mockImplementation(async (_token: string, texts: string[]) => ({
      model: '@cf/baai/bge-m3',
      dim: 4,
      embeddings: texts.map(() => [0.1, 0.2, 0.3, 0.4])
    }))

    const result = await backfillPropositionEmbeddingsTick()
    expect(result.written).toBe(40)
    // 40 / 8 = 5 次请求
    expect(requestWorkerEmbeddingsMock).toHaveBeenCalledTimes(5)
  })
})
