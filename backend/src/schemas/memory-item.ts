/**
 * Cloud MemoryItem Zod（与扩展 frontend MemoryItemSchema 同构）。
 * 同步 API 入站校验；禁止跨用户伪造 ownerId。
 */

import { z } from 'zod'

const CaptureEntrySchema = z.enum([
  'popup', // Popup
  'context_menu', // 右键菜单
  'selection_toolbar', // 划词浮层
  'omnibox', // 地址栏
  'shortcut', // 快捷键
  'sync', // Chrome 书签同步
  'import' // 书签导入
])

const MemoryCluesSchema = z.object({
  title: z.string().optional(),
  textExcerpt: z.string().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  entities: z.array(z.string()).default([]),
  embedding: z.array(z.number()).optional(),
  embeddingModel: z.string().optional(),
  embeddingDim: z.number().int().positive().optional(),
  sourceUrl: z.string().url().optional(),
  domain: z.string().optional(),
  captureEntry: CaptureEntrySchema.optional(),
  openCount: z.number().int().nonnegative().default(0),
  lastOpenedAt: z.string().datetime().nullable().optional(),
  dismissCount: z.number().int().nonnegative().default(0),
  lastDismissedAt: z.string().datetime().nullable().optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().optional()
})

const BookmarkPayloadSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  faviconUrl: z.string().url().optional(),
  chromeBookmarkId: z.string().optional(),
  parentFolderId: z.string().optional(),
  chromeCreatedAt: z.string().datetime().optional()
})

const TextExcerptPayloadSchema = z.object({
  selectedText: z.string().min(1),
  sourceUrl: z.string().url(),
  pageTitle: z.string(),
  domain: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional()
})

const memoryItemBaseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  sourceLocalProfileId: z.string().uuid(),
  clues: MemoryCluesSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional()
})

export const BookmarkMemoryItemSchema = memoryItemBaseSchema.extend({
  type: z.literal('bookmark'),
  payload: BookmarkPayloadSchema
})

export const TextExcerptMemoryItemSchema = memoryItemBaseSchema.extend({
  type: z.literal('text_excerpt'),
  payload: TextExcerptPayloadSchema
})

export const MemoryItemSchema = z.discriminatedUnion('type', [
  BookmarkMemoryItemSchema,
  TextExcerptMemoryItemSchema
])

export type MemoryItem = z.infer<typeof MemoryItemSchema>

/** 同步批量上限（与扩展 bulk import 对齐）。 */
export const MEMORY_SYNC_BATCH_MAX = 2000 as const

/** 单次 pull 上限（产品规模指导约 2 万）。 */
export const MEMORY_SYNC_PULL_MAX = 20000 as const
