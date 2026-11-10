/**
 * `memory_notes` / `memory_notes_meta` 的 Zod 形状与 key 工具。
 */

import { z } from 'zod'

import { SupportedMemoryItemTypeSchema } from '@/core/memory/memory-item-type'
import { DREAMING_SCHEMA_VERSION } from '@/core/dreaming/dreaming-constants'

/** 命题行主键：`` `${ownerId}\0${sourceMemoryItemId}\0${命题序号}` `` */
export function buildMemoryNoteId(
  ownerId: string,
  sourceMemoryItemId: string,
  propositionIndex: number
): string {
  return `${ownerId}\0${sourceMemoryItemId}\0${propositionIndex}`
}

export const MemoryNoteRecordSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  sourceMemoryItemId: z.string().uuid(),
  sourceType: SupportedMemoryItemTypeSchema,
  /** 命题正文。 */
  text: z.string().min(1),
  /**
   * 原文引用片段。无引用不入库——写函数另校；schema 允许空串以便解析脏行。
   */
  sourceQuote: z.string(),
  /** 可选 span 锚（与 sourceQuote 二选一即可满足引用门）。 */
  sourceSpan: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative()
    })
    .optional(),
  /** 命题自带 topic 词；仅检索信号，不参与 hasRecallTopicAnchor。 */
  topicAnchor: z.array(z.string()),
  embedding: z.array(z.number()).optional(),
  embeddingModel: z.string().min(1).optional(),
  embeddingDim: z.number().int().positive().optional(),
  dreamRunId: z.string().min(1),
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  /** 编译时源条目的 updatedAt；源 updatedAt 更大则命题脏。 */
  sourceUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type MemoryNoteRecord = z.infer<typeof MemoryNoteRecordSchema>

export const MemoryNotesMetaSchema = z.object({
  ownerId: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  builtAt: z.string().datetime().nullable(),
  itemCount: z.number().int().nonnegative(),
  dirty: z.boolean(),
  lastDreamRunId: z.string().nullable(),
  /** 本 run 已处理到的源 id；空串 = 尚未推进。 */
  lastCursor: z.string(),
  lastRunAt: z.string().datetime().nullable()
})

export type MemoryNotesMeta = z.infer<typeof MemoryNotesMetaSchema>

/** 新建空 meta（脏，待首次 run）。 */
export function createEmptyMemoryNotesMeta(ownerId: string): MemoryNotesMeta {
  return {
    ownerId,
    schemaVersion: DREAMING_SCHEMA_VERSION,
    builtAt: null,
    itemCount: 0,
    dirty: true,
    lastDreamRunId: null,
    lastCursor: '',
    lastRunAt: null
  }
}

/**
 * 引用门：须有非空 sourceQuote，或合法 sourceSpan（end > start）。
 * 不合规命题不得入库。
 */
export function hasMemoryNoteSourceCitation(input: {
  sourceQuote?: string | null
  sourceSpan?: { start: number; end: number } | null
}): boolean {
  const quote = typeof input.sourceQuote === 'string' ? input.sourceQuote.trim() : ''
  if (quote.length > 0) {
    return true
  }
  const span = input.sourceSpan
  if (span == null) {
    return false
  }
  return (
    Number.isFinite(span.start) &&
    Number.isFinite(span.end) &&
    span.start >= 0 &&
    span.end > span.start
  )
}
