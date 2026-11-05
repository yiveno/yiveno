import { z } from 'zod'

import { MemoryCluesSchema } from '@/core/memory/clues'
import { BookmarkPayloadSchema, TextExcerptPayloadSchema } from '@/core/memory/payload'

/** MemoryItem 共用字段（书签 / 摘录判别联合的底）。 */
const memoryItemBaseSchema = z.object({
  /** 条目稳定 id（UUID） */
  id: z.uuid(),
  /** 云账号所有者 id；未登录本机桶亦有占位 */
  ownerId: z.uuid(),
  /** 写入时的本机 LocalProfile id */
  sourceLocalProfileId: z.uuid(),
  /** 可寻回线索与行为信号（附注 / 词 / embedding 等） */
  clues: MemoryCluesSchema,
  /** 创建时间（ISO） */
  createdAt: z.iso.datetime(),
  /** 最近更新时间（ISO） */
  updatedAt: z.iso.datetime(),
  /** 软删时间；null/缺省 = 未删 */
  deletedAt: z.iso.datetime().nullable().optional()
})

/** Bookmark 类型 MemoryItem。 */
export const BookmarkMemoryItemSchema = memoryItemBaseSchema.extend({
  /** 类型判别：书签 */
  type: z.literal('bookmark'),
  /** 书签载荷（URL / Chrome 书签元数据等） */
  payload: BookmarkPayloadSchema
})

export type BookmarkMemoryItem = z.infer<typeof BookmarkMemoryItemSchema>

/** Text Excerpt 类型 MemoryItem。 */
export const TextExcerptMemoryItemSchema = memoryItemBaseSchema.extend({
  /** 类型判别：文本摘录 */
  type: z.literal('text_excerpt'),
  /** 摘录载荷（选区正文 / 页标题等） */
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
