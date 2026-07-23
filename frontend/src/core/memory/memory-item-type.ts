import { z } from 'zod'

/** v4 支持写入的 MemoryItem 类型。 */
export const SupportedMemoryItemTypeSchema = z.enum(['bookmark', 'text_excerpt'])

export type SupportedMemoryItemType = z.infer<typeof SupportedMemoryItemTypeSchema>

/** 架构预留类型：image / video / note / file（MVP 不可写入）。 */
