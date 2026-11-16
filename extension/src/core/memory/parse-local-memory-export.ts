/**
 * 本地 Backup JSON 解析（Settings「数据与隐私」恢复）。
 * 文件信封版本 ≠ L3 meta.schemaVersion。
 */

import { z } from 'zod'

import type { LocalMemoryImportErrorCode } from '@/core/memory/local-memory-import-error'

export class LocalMemoryBackupParseError extends Error {
  readonly errorCode: LocalMemoryImportErrorCode

  constructor(errorCode: LocalMemoryImportErrorCode, message?: string) {
    super(message ?? errorCode)
    this.name = 'LocalMemoryBackupParseError'
    this.errorCode = errorCode
  }
}

const localMemoryBackupEnvelopeSchema = z.object({
  formatVersion: z.number().int().optional(),
  exportedAt: z.string().optional(),
  ownerId: z.string().min(1),
  items: z.array(z.unknown()),
  memoryNotes: z.array(z.unknown()).optional(),
  memoryNotesMeta: z.unknown().optional()
})

export type ParsedLocalMemoryBackup = {
  formatVersion: 1
  ownerId: string
  items: unknown[]
  memoryNotes: unknown[]
  memoryNotesMeta: unknown | null
}

/**
 * 解析 Backup 文件内容。
 * - 缺 formatVersion → 按 v1 接受（历史文件）
 * - formatVersion > 1 → UNSUPPORTED_VERSION
 * - formatVersion < 1 或非整数 → INVALID_FORMAT
 */
export function parseLocalMemoryBackup(content: string): ParsedLocalMemoryBackup {
  let raw: unknown
  try {
    raw = JSON.parse(content) as unknown
  } catch {
    throw new LocalMemoryBackupParseError('LOCAL_IMPORT_INVALID_FORMAT')
  }

  const parsed = localMemoryBackupEnvelopeSchema.safeParse(raw)
  if (!parsed.success) {
    throw new LocalMemoryBackupParseError('LOCAL_IMPORT_INVALID_FORMAT')
  }

  const { formatVersion, ownerId, items, memoryNotes, memoryNotesMeta } = parsed.data

  if (formatVersion === undefined) {
    // 历史文件：无版本视为 v1
  } else if (!Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new LocalMemoryBackupParseError('LOCAL_IMPORT_INVALID_FORMAT')
  } else if (formatVersion > 1) {
    throw new LocalMemoryBackupParseError('LOCAL_IMPORT_UNSUPPORTED_VERSION')
  }

  if (memoryNotesMeta !== undefined && memoryNotesMeta !== null) {
    if (typeof memoryNotesMeta !== 'object' || Array.isArray(memoryNotesMeta)) {
      throw new LocalMemoryBackupParseError('LOCAL_IMPORT_INVALID_FORMAT')
    }
  }

  return {
    formatVersion: 1,
    ownerId,
    items,
    memoryNotes: memoryNotes ?? [],
    memoryNotesMeta: memoryNotesMeta === undefined ? null : memoryNotesMeta
  }
}
