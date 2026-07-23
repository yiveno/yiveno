import { z } from 'zod'

/** 当前可写入的 MemoryItem 类型（MVP）。预留未写入：image / video / note / file。 */
export const SupportedMemoryItemTypeSchema = z.enum(['bookmark', 'text_excerpt'])

export type SupportedMemoryItemType = z.infer<typeof SupportedMemoryItemTypeSchema>
