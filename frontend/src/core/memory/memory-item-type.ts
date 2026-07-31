import { z } from 'zod'

/**
 * 当前可写入的 MemoryItem 类型（MVP）。预留未写入：image / video / note / file。
 * - bookmark：书签
 * - text_excerpt：文本摘录
 */
export const SupportedMemoryItemTypeSchema = z.enum([
  'bookmark', // 书签
  'text_excerpt' // 文本摘录
])

export type SupportedMemoryItemType = z.infer<typeof SupportedMemoryItemTypeSchema>
