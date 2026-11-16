/**
 * 命题向量生产 / 回填（Phase 4.1）。
 * - 批量 ≤8 条/请求（不得复用条目向量 1 条/调用模式）
 * - 模型门控：embeddingModel === WORKER_EMBEDDING_MODEL
 * - 重算复用：inputText + model 未变则跳过
 * - 回填按日桶 pacing；失败 fail-open
 */

import { buildPropositionEmbeddingText } from '@/core/dreaming/build-proposition-embedding-text'
import {
  DREAMING_PROPOSITION_EMBED_BACKFILL_BATCH_LIMIT,
  DREAMING_PROPOSITION_EMBED_MAX_BATCH
} from '@/core/dreaming/dreaming-constants'
import {
  requestWorkerEmbeddings,
  WORKER_EMBEDDING_MODEL
} from '@/infrastructure/ai/embed-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryNoteEmbeddingRepository } from '@/infrastructure/indexeddb/memory-note-embedding-repository'
import type { MemoryNoteEmbeddingLoaded } from '@/infrastructure/indexeddb/memory-note-embedding-types'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

export type PropositionEmbedWriteInput = {
  noteId: string
  ownerId: string
  sourceMemoryItemId: string
  text: string
  sourceQuote: string
}

function hasCurrentModelEmbedding(
  row: MemoryNoteEmbeddingLoaded | null | undefined,
  inputText: string
): boolean {
  return (
    row != null &&
    row.embedding.length > 0 &&
    row.embeddingModel === WORKER_EMBEDDING_MODEL &&
    row.inputText === inputText
  )
}

/**
 * 为刚写入的命题补向量。
 * @param previousByNoteId 重算前快照（delete 前读出）；文本+模型未变则复用，不烧配额。
 */
export async function embedPropositionsForWrittenNotes(input: {
  accessToken: string
  notes: readonly PropositionEmbedWriteInput[]
  previousByNoteId?: ReadonlyMap<string, MemoryNoteEmbeddingLoaded>
  nowMs?: number
}): Promise<{ written: number; reused: number; skipped: number }> {
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString()
  let written = 0
  let reused = 0
  let skipped = 0

  const pending: Array<{
    note: PropositionEmbedWriteInput
    inputText: string
  }> = []

  for (const note of input.notes) {
    const inputText = buildPropositionEmbeddingText({
      text: note.text,
      sourceQuote: note.sourceQuote
    })
    if (!inputText) {
      skipped += 1
      continue
    }
    const previous = input.previousByNoteId?.get(note.noteId)
    if (hasCurrentModelEmbedding(previous, inputText)) {
      await memoryNoteEmbeddingRepository.putRecord({
        id: note.noteId,
        ownerId: note.ownerId,
        sourceMemoryItemId: note.sourceMemoryItemId,
        inputText,
        embedding: Array.from(previous!.embedding),
        embeddingModel: previous!.embeddingModel,
        embeddingDim: previous!.embeddingDim,
        createdAt: previous!.createdAt,
        updatedAt: nowIso
      })
      reused += 1
      continue
    }
    pending.push({ note, inputText })
  }

  for (let offset = 0; offset < pending.length; offset += DREAMING_PROPOSITION_EMBED_MAX_BATCH) {
    const batch = pending.slice(offset, offset + DREAMING_PROPOSITION_EMBED_MAX_BATCH)
    try {
      const result = await requestWorkerEmbeddings(
        input.accessToken,
        batch.map(row => row.inputText)
      )
      const model = result.model || WORKER_EMBEDDING_MODEL
      if (model !== WORKER_EMBEDDING_MODEL) {
        logger.warn('Dreaming', '命题向量模型不符，整批跳过', {
          expected: WORKER_EMBEDDING_MODEL,
          actual: model
        })
        skipped += batch.length
        continue
      }
      for (let i = 0; i < batch.length; i += 1) {
        const row = batch[i]!
        const vector = result.embeddings[i]
        if (!vector?.length) {
          skipped += 1
          continue
        }
        const dim = result.dim > 0 ? result.dim : vector.length
        await memoryNoteEmbeddingRepository.putRecord({
          id: row.note.noteId,
          ownerId: row.note.ownerId,
          sourceMemoryItemId: row.note.sourceMemoryItemId,
          inputText: row.inputText,
          embedding: [...vector],
          embeddingModel: model,
          embeddingDim: dim,
          createdAt: nowIso,
          updatedAt: nowIso
        })
        written += 1
      }
    } catch (error) {
      logger.warn('Dreaming', '命题向量生产失败，fail-open', {
        batchSize: batch.length,
        error: error instanceof Error ? error.message : String(error)
      })
      skipped += batch.length
    }
  }

  logger.info('Dreaming', '命题向量生产完成', { written, reused, skipped })
  return { written, reused, skipped }
}

export type PropositionEmbedBackfillResult = {
  skipped: boolean
  reason?: string
  scanned: number
  written: number
  reused: number
  failed: number
}

/**
 * 既有命题向量回填（按日桶 pacing；单次最多 BACKFILL_BATCH_LIMIT 条）。
 * 无向量的命题仍走字面——本函数失败不阻塞查询。
 */
export async function backfillPropositionEmbeddingsTick(): Promise<PropositionEmbedBackfillResult> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    return { skipped: true, reason: 'ai_disabled', scanned: 0, written: 0, reused: 0, failed: 0 }
  }
  const session = await getAuthSession()
  if (!session?.accessToken) {
    return { skipped: true, reason: 'not_signed_in', scanned: 0, written: 0, reused: 0, failed: 0 }
  }

  const ownerId = await getCurrentOwnerId()
  const notes = await memoryNotesRepository.listByOwnerUpdated({
    ownerId,
    limit: DREAMING_NOTE_SCAN_LIMIT_FOR_BACKFILL
  })
  const existing = await memoryNoteEmbeddingRepository.listByOwner(ownerId)
  const existingById = new Map(existing.map(row => [row.id, row]))

  const gaps: MemoryNoteRecord[] = []
  for (const note of notes) {
    const inputText = buildPropositionEmbeddingText({
      text: note.text,
      sourceQuote: note.sourceQuote
    })
    if (!inputText) {
      continue
    }
    if (hasCurrentModelEmbedding(existingById.get(note.id), inputText)) {
      continue
    }
    gaps.push(note)
    if (gaps.length >= DREAMING_PROPOSITION_EMBED_BACKFILL_BATCH_LIMIT) {
      break
    }
  }

  if (gaps.length === 0) {
    logger.info('Dreaming', '命题向量回填：无缺口', { ownerId })
    return { skipped: false, scanned: notes.length, written: 0, reused: 0, failed: 0 }
  }

  const result = await embedPropositionsForWrittenNotes({
    accessToken: session.accessToken,
    notes: gaps.map(note => ({
      noteId: note.id,
      ownerId: note.ownerId,
      sourceMemoryItemId: note.sourceMemoryItemId,
      text: note.text,
      sourceQuote: note.sourceQuote
    })),
    previousByNoteId: existingById
  })

  logger.info('Dreaming', '命题向量回填 tick 完成', {
    ownerId,
    scanned: notes.length,
    gaps: gaps.length,
    written: result.written,
    reused: result.reused,
    failed: result.skipped
  })

  return {
    skipped: false,
    scanned: notes.length,
    written: result.written,
    reused: result.reused,
    failed: result.skipped
  }
}

/** 回填扫描上限（与查询扫描同量级，避免一次扫爆）。 */
const DREAMING_NOTE_SCAN_LIMIT_FOR_BACKFILL = 2000 as const
