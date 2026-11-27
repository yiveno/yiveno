/**
 * 夜间命题编译主路径（暗线）：缺口扫描 → 分片 → LLM → 引用校验写库 → 游标提交。
 * 本 Phase 不进 Recall。
 */

import {
  advanceDreamRunCursor,
  pickPendingSourceIdsAfterCursor,
  startDreamRun,
  type DreamRunCursor
} from '@/core/dreaming/dream-run-cursor'
import {
  DREAMING_COMPILE_BATCH_SIZE,
  DREAMING_COMPILE_MAX_BATCHES_PER_TICK,
  DREAMING_MAX_PROPOSITIONS_PER_SOURCE
} from '@/core/dreaming/dreaming-constants'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  requestDreamingCompileBatch,
  type DreamingCompileResultRow,
  type DreamingCompileSourceInput,
  type DreamingCompileSourceStatus
} from '@/application/dreaming/dreaming-llm-client'
import { embedPropositionsForWrittenNotes } from '@/application/dreaming/schedule-proposition-embeddings'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNoteEmbeddingRepository } from '@/infrastructure/indexeddb/memory-note-embedding-repository'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

const CANDIDATE_SCAN_LIMIT = 500

function buildSourceText(item: MemoryItem): string | null {
  if (item.type === 'text_excerpt') {
    const text = item.payload.selectedText.trim()
    return text.length > 0 ? text.slice(0, 4000) : null
  }
  const title = item.payload.title.trim()
  const url = item.payload.url.trim()
  const combined = [title, url].filter(Boolean).join('\n')
  return combined.length > 0 ? combined.slice(0, 4000) : null
}

function toCompileInput(item: MemoryItem): DreamingCompileSourceInput | null {
  const text = buildSourceText(item)
  if (!text) {
    return null
  }
  const title =
    item.type === 'text_excerpt'
      ? item.payload.pageTitle?.trim() || item.clues.title?.trim()
      : item.payload.title.trim()
  const note = item.clues.note?.trim()
  return {
    id: item.id,
    type: item.type,
    text,
    ...(title ? { title } : {}),
    ...(note ? { note } : {})
  }
}

async function listGapSourceIds(ownerId: string): Promise<string[]> {
  const items = await memoryItemRepository.listByOwner({
    limit: CANDIDATE_SCAN_LIMIT
  })
  const owned = items.filter(item => item.ownerId === ownerId && item.deletedAt == null)
  const gapIds: string[] = []
  for (const item of owned) {
    const notes = await memoryNotesRepository.listBySource({
      ownerId,
      sourceMemoryItemId: item.id
    })
    if (notes.length === 0) {
      gapIds.push(item.id)
      continue
    }
    const stale = notes.some(note => item.updatedAt > note.sourceUpdatedAt)
    if (stale) {
      gapIds.push(item.id)
    }
  }
  gapIds.sort((left, right) => left.localeCompare(right))
  return gapIds
}

async function writePropositionsForSource(input: {
  ownerId: string
  item: MemoryItem
  dreamRunId: string
  propositions: Array<{ text: string; sourceQuote: string; topicAnchor: string[] }>
  accessToken: string
}): Promise<number> {
  // 重算复用：先删后写前快照旧向量（文本+模型未变则跳过重烧）
  const previousRows = await memoryNoteEmbeddingRepository.listBySource({
    ownerId: input.ownerId,
    sourceMemoryItemId: input.item.id
  })
  const previousByNoteId = new Map(previousRows.map(row => [row.id, row]))

  await memoryNotesRepository.deleteBySource({
    ownerId: input.ownerId,
    sourceMemoryItemId: input.item.id
  })
  await memoryNoteEmbeddingRepository.deleteBySource({
    ownerId: input.ownerId,
    sourceMemoryItemId: input.item.id
  })

  let written = 0
  const writtenRows: MemoryNoteRecord[] = []
  const capped = input.propositions.slice(0, DREAMING_MAX_PROPOSITIONS_PER_SOURCE)
  for (let index = 0; index < capped.length; index += 1) {
    const prop = capped[index]!
    const row = await memoryNotesRepository.putProposition({
      ownerId: input.ownerId,
      sourceMemoryItemId: input.item.id,
      sourceType: input.item.type,
      text: prop.text,
      sourceQuote: prop.sourceQuote,
      topicAnchor: prop.topicAnchor,
      dreamRunId: input.dreamRunId,
      sourceUpdatedAt: input.item.updatedAt,
      propositionIndex: index
    })
    if (row != null) {
      written += 1
      writtenRows.push(row)
    }
  }

  if (writtenRows.length > 0) {
    await embedPropositionsForWrittenNotes({
      accessToken: input.accessToken,
      notes: writtenRows.map(row => ({
        noteId: row.id,
        ownerId: row.ownerId,
        sourceMemoryItemId: row.sourceMemoryItemId,
        text: row.text,
        sourceQuote: row.sourceQuote
      })),
      previousByNoteId
    })
  }

  return written
}

/**
 * 解析某 source 的编译行状态。
 * 缺行 → omitted；有行则用行内 status（客户端已兼容旧 Worker）。
 */
export function resolveCompileSourceStatus(
  row: DreamingCompileResultRow | undefined
): DreamingCompileSourceStatus {
  if (row == null) {
    return 'omitted'
  }
  return row.status
}

export type CompileMemoryNotesTickResult = {
  skipped: boolean
  reason?: string
  /** 仅 ok + empty（已写库替换） */
  processedSources: number
  /** dropped + omitted（跳过写入、旧命题保留） */
  failedSources: number
  writtenPropositions: number
  deferred: boolean
  dreamRunId: string | null
  /** 本 tick 因 failed source 开了新 run，供下一 tick 重试 */
  restartedRunForRetry: boolean
}

function skippedTickResult(reason: string, deferred: boolean): CompileMemoryNotesTickResult {
  return {
    skipped: true,
    reason,
    processedSources: 0,
    failedSources: 0,
    writtenPropositions: 0,
    deferred,
    dreamRunId: null,
    restartedRunForRetry: false
  }
}

/** 一次 alarm tick：有界批次数；中断后续跑靠游标。 */
export async function compileMemoryNotesTick(): Promise<CompileMemoryNotesTickResult> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    logger.info('Dreaming', '编译跳过：aiFeaturesEnabled=false')
    return skippedTickResult('ai_disabled', false)
  }

  const accessToken = await getWorkerApiAccessToken()
  if (!accessToken) {
    logger.info('Dreaming', '编译跳过：未登录（Embed/托管门）')
    return skippedTickResult('not_signed_in', true)
  }

  const ownerId = await getCurrentOwnerId()
  const existingCursor = await memoryNotesMetaRepository.readRunCursor(ownerId)
  let cursor: DreamRunCursor = existingCursor ?? startDreamRun()
  if (existingCursor == null) {
    await memoryNotesMetaRepository.commitRunCursor(ownerId, cursor)
  }

  const gapIds = await listGapSourceIds(ownerId)
  logger.info('Dreaming', '缺口扫描完成', {
    ownerId,
    gapCount: gapIds.length,
    dreamRunId: cursor.dreamRunId,
    lastCursor: cursor.lastCursor || '(empty)'
  })

  let processedSources = 0
  let failedSources = 0
  let writtenPropositions = 0
  let deferred = false

  for (let batchIndex = 0; batchIndex < DREAMING_COMPILE_MAX_BATCHES_PER_TICK; batchIndex += 1) {
    const pending = pickPendingSourceIdsAfterCursor(gapIds, cursor, DREAMING_COMPILE_BATCH_SIZE)
    if (pending.length === 0) {
      break
    }

    const items: MemoryItem[] = []
    for (const id of pending) {
      const item = await memoryItemRepository.getById(id, ownerId)
      if (item != null && item.deletedAt == null) {
        items.push(item)
      }
    }
    const compileInputs = items
      .map(toCompileInput)
      .filter((row): row is DreamingCompileSourceInput => row != null)

    if (compileInputs.length === 0) {
      // 推进游标跳过空文本源
      for (const id of pending) {
        cursor = advanceDreamRunCursor(cursor, id)
      }
      await memoryNotesMetaRepository.commitRunCursor(ownerId, cursor)
      continue
    }

    const llm = await requestDreamingCompileBatch(compileInputs)
    if (!llm.ok) {
      if (llm.deferred) {
        deferred = true
        logger.info('Dreaming', '编译延后到下次 run', {
          errorCode: llm.errorCode,
          dreamRunId: cursor.dreamRunId
        })
      }
      break
    }

    // Q7：累计编译 prompt/completion token（与 commitRunCursor 串行，避免丢更新）
    await memoryNotesMetaRepository.recordCompileUsage(ownerId, llm.usage)

    const bySource = new Map(llm.results.map(row => [row.sourceId, row]))
    for (const item of items) {
      const row = bySource.get(item.id)
      const status = resolveCompileSourceStatus(row)

      if (status === 'ok' || status === 'empty') {
        writtenPropositions += await writePropositionsForSource({
          ownerId,
          item,
          dreamRunId: cursor.dreamRunId,
          propositions: row?.propositions ?? [],
          accessToken
        })
        processedSources += 1
      } else {
        // dropped / omitted：不删旧 notes / embeddings，保持可重试
        failedSources += 1
        logger.info('Dreaming', '编译跳过写入（保留旧命题）', {
          sourceId: item.id,
          status
        })
      }

      cursor = advanceDreamRunCursor(cursor, item.id)
      await memoryNotesMetaRepository.commitRunCursor(ownerId, cursor)
    }
  }

  // 有 failed source 时开新 run：下一 tick 重新扫 gap 并重试（避免游标越过后永不重试）
  let restartedRunForRetry = false
  if (failedSources > 0) {
    cursor = startDreamRun()
    restartedRunForRetry = true
    logger.info('Dreaming', '因 failed source 开新 run 供重试', {
      failedSources,
      dreamRunId: cursor.dreamRunId
    })
  }

  const itemCount = await memoryNotesRepository.countByOwner(ownerId)
  await memoryNotesMetaRepository.commitRunCursor(ownerId, cursor, itemCount)

  logger.info('Dreaming', '编译 tick 完成', {
    dreamRunId: cursor.dreamRunId,
    processedSources,
    failedSources,
    writtenPropositions,
    deferred,
    restartedRunForRetry,
    itemCount
  })

  return {
    skipped: false,
    processedSources,
    failedSources,
    writtenPropositions,
    deferred,
    dreamRunId: cursor.dreamRunId,
    restartedRunForRetry
  }
}
