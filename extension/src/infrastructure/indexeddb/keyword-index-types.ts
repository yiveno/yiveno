/**
 * 关键词倒排 posting / meta 的 Zod 形状与 key 工具。
 */

import { z } from 'zod'

import { KEYWORD_INDEX_SCHEMA_VERSION } from '@/infrastructure/indexeddb/constants'

export const KeywordPostingRecordSchema = z.object({
  /** `` `${ownerId}\\0${token}` `` */
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  token: z.string().min(1),
  itemIds: z.array(z.string().uuid())
})

export type KeywordPostingRecord = z.infer<typeof KeywordPostingRecordSchema>

export const KeywordIndexMetaSchema = z.object({
  ownerId: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  builtAt: z.string().datetime().nullable(),
  itemCount: z.number().int().nonnegative(),
  dirty: z.boolean()
})

export type KeywordIndexMeta = z.infer<typeof KeywordIndexMetaSchema>

/** posting 主键。 */
export function buildKeywordPostingId(ownerId: string, token: string): string {
  return `${ownerId}\0${token}`
}

export function createEmptyKeywordIndexMeta(ownerId: string): KeywordIndexMeta {
  return {
    ownerId,
    schemaVersion: KEYWORD_INDEX_SCHEMA_VERSION,
    builtAt: null,
    itemCount: 0,
    dirty: true
  }
}
