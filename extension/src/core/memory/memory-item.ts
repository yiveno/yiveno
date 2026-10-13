import { z } from 'zod'

import { MemoryCluesSchema } from '@/core/memory/clues'
import { BookmarkPayloadSchema, TextExcerptPayloadSchema } from '@/core/memory/payload'

const memoryItemBaseSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  sourceLocalProfileId: z.uuid(),
  clues: MemoryCluesSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable().optional()
})

/** Bookmark 类型 MemoryItem。 */
export const BookmarkMemoryItemSchema = memoryItemBaseSchema.extend({
  type: z.literal('bookmark'),
  payload: BookmarkPayloadSchema
})

export type BookmarkMemoryItem = z.infer<typeof BookmarkMemoryItemSchema>

/** Text Excerpt 类型 MemoryItem。 */
export const TextExcerptMemoryItemSchema = memoryItemBaseSchema.extend({
  type: z.literal('text_excerpt'),
  payload: TextExcerptPayloadSchema
})

export type TextExcerptMemoryItem = z.infer<typeof TextExcerptMemoryItemSchema>

/** MVP 可持久化的 MemoryItem 联合类型。 */
export const MemoryItemSchema = z.discriminatedUnion('type', [
  BookmarkMemoryItemSchema,
  TextExcerptMemoryItemSchema
])

export type MemoryItem = z.infer<typeof MemoryItemSchema>

/** 安全解析；失败时返回 null。 */
export function safeParseMemoryItem(value: unknown): MemoryItem | null {
  const parsed = MemoryItemSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
