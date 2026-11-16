/**
 * 本地 Backup 恢复（merge/upsert · newer-wins · 含 L3）。
 */

import {
  LocalMemoryBackupParseError,
  parseLocalMemoryBackup
} from '@/core/memory/parse-local-memory-export'
import type { LocalMemoryImportErrorCode } from '@/core/memory/local-memory-import-error'
import { MemoryItemSchema, type MemoryItem } from '@/core/memory/memory-item'
import { invalidateBookmarkSyncAlignmentCache } from '@/application/memory/bookmark-sync-alignment-cache'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { memoryNotesMetaRepository } from '@/infrastructure/indexeddb/memory-notes-meta-repository'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'
import {
  buildMemoryNoteId,
  MemoryNoteRecordSchema,
  MemoryNotesMetaSchema,
  type MemoryNoteRecord,
  type MemoryNotesMeta
} from '@/infrastructure/indexeddb/memory-notes-types'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { bumpMemoryLibraryRevision } from '@/infrastructure/storage/memory-library-revision-storage'

export class LocalMemoryImportError extends Error {
  readonly errorCode: LocalMemoryImportErrorCode

  constructor(errorCode: LocalMemoryImportErrorCode, message?: string) {
    super(message ?? errorCode)
    this.name = 'LocalMemoryImportError'
    this.errorCode = errorCode
  }
}

export type LocalMemoryImportResult = {
  restoredItems: number
  skippedItems: number
  restoredNotes: number
  skippedNotes: number
}

let importInFlight: Promise<LocalMemoryImportResult> | null = null

function mapParseError(error: unknown): LocalMemoryImportError {
  if (error instanceof LocalMemoryBackupParseError) {
    return new LocalMemoryImportError(error.errorCode)
  }
  if (error instanceof LocalMemoryImportError) {
    return error
  }
  return new LocalMemoryImportError('LOCAL_IMPORT_FAILED')
}

/** 从命题 id 第三段解析序号；解析失败返回 null。 */
export function parsePropositionIndexFromNoteId(noteId: string): number | null {
  const parts = noteId.split('\0')
  if (parts.length < 3) {
    return null
  }
  const raw = parts[parts.length - 1]
  if (raw == null || raw === '') {
    return null
  }
  const index = Number(raw)
  if (!Number.isInteger(index) || index < 0) {
    return null
  }
  return index
}

/** 导入本地 Backup JSON（Settings 恢复）。 */
export async function importLocalMemoryBackup(input: {
  content: string
}): Promise<LocalMemoryImportResult> {
  if (importInFlight) {
    throw new LocalMemoryImportError('LOCAL_IMPORT_IN_PROGRESS')
  }

  importInFlight = runImport(input).finally(() => {
    importInFlight = null
  })
  return importInFlight
}

async function runImport(input: { content: string }): Promise<LocalMemoryImportResult> {
  const startedAt = flowStart('Import', '开始恢复本地 Backup')
  try {
    const parsed = parseLocalMemoryBackup(input.content)
    if (parsed.items.length === 0 && parsed.memoryNotes.length === 0) {
      throw new LocalMemoryImportError('LOCAL_IMPORT_EMPTY')
    }

    const currentOwnerId = await getCurrentOwnerId()
    const reown = parsed.ownerId !== currentOwnerId

    const localItems = await memoryItemRepository.listAllByOwnerId(currentOwnerId, {
      includeDeleted: true
    })
    const localById = new Map(localItems.map(item => [item.id, item]))

    let restoredItems = 0
    let skippedItems = 0
    const itemsToPut: MemoryItem[] = []

    for (const raw of parsed.items) {
      const withOwner =
        typeof raw === 'object' && raw != null
          ? { ...(raw as Record<string, unknown>), ownerId: currentOwnerId }
          : raw
      const itemParsed = MemoryItemSchema.safeParse(withOwner)
      if (!itemParsed.success) {
        skippedItems += 1
        logger.warn('Import', '条目 schema 失败，跳过', {
          issues: itemParsed.error.issues.slice(0, 3)
        })
        continue
      }
      const fileItem = itemParsed.data
      const local = localById.get(fileItem.id)
      if (local != null && local.updatedAt > fileItem.updatedAt) {
        skippedItems += 1
        continue
      }
      itemsToPut.push(fileItem)
      restoredItems += 1
    }

    if (itemsToPut.length > 0) {
      await memoryItemRepository.putMany(itemsToPut)
      for (const item of itemsToPut) {
        localById.set(item.id, item)
      }
    }

    // 恢复后条目集合（含软删）— 孤儿门：源须在此集合
    const restoredSourceIds = new Set(localById.keys())

    let restoredNotes = 0
    let skippedNotes = 0
    const noteIdRemap = new Map<string, string>()

    for (const raw of parsed.memoryNotes) {
      const noteParsed = MemoryNoteRecordSchema.safeParse(raw)
      if (!noteParsed.success) {
        skippedNotes += 1
        logger.warn('Import', '命题 schema 失败，跳过', {
          issues: noteParsed.error.issues.slice(0, 3)
        })
        continue
      }
      const fileNote = noteParsed.data
      if (!restoredSourceIds.has(fileNote.sourceMemoryItemId)) {
        skippedNotes += 1
        logger.info('Import', '孤儿命题跳过', {
          sourceMemoryItemId: fileNote.sourceMemoryItemId
        })
        continue
      }

      const propositionIndex = parsePropositionIndexFromNoteId(fileNote.id)
      if (propositionIndex == null) {
        skippedNotes += 1
        logger.warn('Import', '命题 id 无法解析序号，跳过', { id: fileNote.id })
        continue
      }

      const nextId = reown
        ? buildMemoryNoteId(currentOwnerId, fileNote.sourceMemoryItemId, propositionIndex)
        : fileNote.id
      if (reown) {
        noteIdRemap.set(fileNote.id, nextId)
      }

      const record: MemoryNoteRecord = {
        ...fileNote,
        id: nextId,
        ownerId: currentOwnerId
      }

      const written = await memoryNotesRepository.putNoteRecord(record)
      if (written == null) {
        skippedNotes += 1
        continue
      }
      restoredNotes += 1
    }

    if (parsed.memoryNotesMeta != null) {
      await restoreMeta({
        rawMeta: parsed.memoryNotesMeta,
        currentOwnerId,
        reown,
        noteIdRemap
      })
    }

    invalidateBookmarkSyncAlignmentCache()
    void bumpMemoryLibraryRevision().catch(error => {
      logger.warn('Import', '库修订信号更新失败', error)
    })

    const result: LocalMemoryImportResult = {
      restoredItems,
      skippedItems,
      restoredNotes,
      skippedNotes
    }
    flowOk('Import', '完成', startedAt, {
      ...result,
      reown,
      fileOwnerId: parsed.ownerId,
      currentOwnerId
    })
    return result
  } catch (error) {
    const mapped = mapParseError(error)
    flowFail('Import', '失败', startedAt, mapped)
    throw mapped
  }
}

async function restoreMeta(input: {
  rawMeta: unknown
  currentOwnerId: string
  reown: boolean
  noteIdRemap: Map<string, string>
}): Promise<void> {
  const metaParsed = MemoryNotesMetaSchema.safeParse({
    ...(typeof input.rawMeta === 'object' && input.rawMeta != null
      ? (input.rawMeta as Record<string, unknown>)
      : {}),
    ownerId: input.currentOwnerId
  })
  if (!metaParsed.success) {
    logger.warn('Import', 'meta schema 失败，跳过 meta 恢复', {
      issues: metaParsed.error.issues.slice(0, 3)
    })
    return
  }

  let noteHitCounts = { ...metaParsed.data.noteHitCounts }
  if (input.reown) {
    const remapped: Record<string, number> = {}
    for (const [oldId, count] of Object.entries(noteHitCounts)) {
      const fromMap = input.noteIdRemap.get(oldId)
      if (fromMap != null) {
        remapped[fromMap] = count
        continue
      }
      // 未写入的命中键：仍按 id 三段重建到当前 owner，避免残留外号 id
      const parts = oldId.split('\0')
      if (parts.length >= 3) {
        const sourceMemoryItemId = parts[parts.length - 2]
        const index = parsePropositionIndexFromNoteId(oldId)
        if (sourceMemoryItemId && index != null) {
          remapped[buildMemoryNoteId(input.currentOwnerId, sourceMemoryItemId, index)] = count
          continue
        }
      }
      remapped[oldId] = count
    }
    noteHitCounts = remapped
  }

  const itemCount = await memoryNotesRepository.countByOwner(input.currentOwnerId)
  const nextMeta: MemoryNotesMeta = {
    ...metaParsed.data,
    ownerId: input.currentOwnerId,
    noteHitCounts,
    // 游标重置，避免过期游标饿死缺口
    lastDreamRunId: null,
    lastCursor: '',
    lastRunAt: null,
    dirty: true,
    itemCount
  }
  await memoryNotesMetaRepository.putMeta(nextMeta)
}
