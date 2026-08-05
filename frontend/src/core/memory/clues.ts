import { z } from 'zod'

import { CaptureEntrySchema } from '@/core/memory/capture-entry'

/** 可寻回记忆线索；MVP 保留扩展位，写入时尽量填充内容/上下文线索。 */
export const MemoryCluesSchema = z.object({
  title: z.string().optional(),
  textExcerpt: z.string().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  embedding: z.array(z.number()).optional(),
  /** 生成 embedding 所用模型 id（如 @cf/baai/bge-m3） */
  embeddingModel: z.string().optional(),
  /** embedding 维度 */
  embeddingDim: z.number().int().positive().optional(),
  sourceUrl: z.string().url().optional(),
  domain: z.string().optional(),
  captureEntry: CaptureEntrySchema.optional(),
  openCount: z.number().int().nonnegative().default(0),
  lastOpenedAt: z.string().datetime().nullable().optional(),
  /** 用户否定「都不是这些」次数；参与排序降权。 */
  dismissCount: z.number().int().nonnegative().default(0),
  lastDismissedAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().optional()
})

export type MemoryClues = z.infer<typeof MemoryCluesSchema>

/** 创建 MemoryItem 时可部分提供的线索字段。 */
export type MemoryCluesInput = Partial<Omit<MemoryClues, 'keywords' | 'entities' | 'tags'>> & {
  keywords?: string[]
  entities?: string[]
  tags?: string[]
}
