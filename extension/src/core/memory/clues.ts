import { z } from 'zod'

import { CaptureEntrySchema } from '@/core/memory/capture-entry'

/** 可寻回记忆线索；MVP 保留扩展位，写入时尽量填充内容/上下文线索。 */
export const MemoryCluesSchema = z.object({
  /** 标题（书签名 / 页标题等） */
  title: z.string().optional(),
  /** 摘录正文（text_excerpt 主内容） */
  textExcerpt: z.string().optional(),
  /** 摘要（enrichment / 展示） */
  summary: z.string().optional(),
  /** 关键词（规则 / enrichment） */
  keywords: z.array(z.string()).default([]),
  /** 实体词（enrichment） */
  entities: z.array(z.string()).default([]),
  /** 内容 embedding 向量（Hybrid 语义路） */
  embedding: z.array(z.number()).optional(),
  /** 生成 embedding 所用模型 id（如 @cf/baai/bge-m3） */
  embeddingModel: z.string().optional(),
  /** embedding 维度 */
  embeddingDim: z.number().int().positive().optional(),
  /** 来源 URL */
  sourceUrl: z.url().optional(),
  /** 来源域名（无路径） */
  domain: z.string().optional(),
  /** Capture 入口（右键 / 划词 / 书签同步等） */
  captureEntry: CaptureEntrySchema.optional(),
  /** 打开原文次数（行为信号） */
  openCount: z.number().int().nonnegative().default(0),
  /** 最近打开时间 */
  lastOpenedAt: z.iso.datetime().nullable().optional(),
  /**
   * 会话 settled / Mark 等正例次数（§7.2）。
   * `often_opened` 软加权只读本字段，不读裸 openCount。
   */
  settledCount: z.number().int().nonnegative().default(0),
  /** 最近 settled 时间 */
  lastSettledAt: z.iso.datetime().nullable().optional(),
  /** 用户否定「都不是这些」次数；参与排序降权。 */
  dismissCount: z.number().int().nonnegative().default(0),
  /** 最近 dismiss 时间 */
  lastDismissedAt: z.iso.datetime().nullable().optional(),
  /** 标签（enrichment / 用户） */
  tags: z.array(z.string()).default([]),
  /** 用户附注（产品面「附注」· MemoryItem.clues.note） */
  note: z.string().optional()
})

export type MemoryClues = z.infer<typeof MemoryCluesSchema>

/** 创建 MemoryItem 时可部分提供的线索字段。 */
export type MemoryCluesInput = Partial<Omit<MemoryClues, 'keywords' | 'entities' | 'tags'>> & {
  keywords?: string[]
  entities?: string[]
  tags?: string[]
}
