import { z } from 'zod'

/** v4 支持写入的 MemoryItem 类型。 */
export const SupportedMemoryItemTypeSchema = z.enum(['bookmark', 'text_excerpt'])

export type SupportedMemoryItemType = z.infer<typeof SupportedMemoryItemTypeSchema>

/** 架构预留类型，MVP 不可写入。 */
export const ReservedMemoryItemTypeSchema = z.enum(['image', 'video', 'note', 'file'])

export type ReservedMemoryItemType = z.infer<typeof ReservedMemoryItemTypeSchema>

export const MemoryItemTypeSchema = z.union([
  SupportedMemoryItemTypeSchema,
  ReservedMemoryItemTypeSchema
])

export type MemoryItemType = z.infer<typeof MemoryItemTypeSchema>
