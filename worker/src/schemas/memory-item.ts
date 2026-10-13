/**
 * Cloud MemoryItem Zod（与 extension MemoryItemSchema 同构）。
 * 同步 API 入站校验；禁止跨用户伪造 ownerId。
 */

import { z } from 'zod'

const CaptureEntrySchema = z.enum([
  'popup', // 遗留 capture 入口（原 Action Popup 时代）
  'context_menu', // 右键菜单
  'selection_toolbar', // 划词浮层
  'omnibox', // 地址栏
  'shortcut', // 快捷键
  'sync', // Chrome 书签同步
  'import', // 书签导入
  'getting_started' // 安装引导演示页
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
  sourceUrl: z.url().optional(),
  domain: z.string().optional(),
  captureEntry: CaptureEntrySchema.optional(),
  openCount: z.number().int().nonnegative().default(0),
  lastOpenedAt: z.iso.datetime().nullable().optional(),
  /** §7.2 settled 正例次数；often_opened 只读此字段 */
  settledCount: z.number().int().nonnegative().default(0),
  lastSettledAt: z.iso.datetime().nullable().optional(),
  dismissCount: z.number().int().nonnegative().default(0),
  lastDismissedAt: z.iso.datetime().nullable().optional(),
  tags: z.array(z.string()).default([]),
  note: z.string().optional()
})

const BookmarkPayloadSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  domain: z.string().min(1),
  faviconUrl: z.url().optional(),
  chromeBookmarkId: z.string().optional(),
  parentFolderId: z.string().optional(),
  chromeCreatedAt: z.iso.datetime().optional(),
  /** 第三方语料源（与扩展 payload 对齐） */
  corpusSource: z.enum(['raindrop', 'pocket']).optional(),
  remoteId: z.string().min(1).optional(),
  sourceCreatedAt: z.iso.datetime().optional()
})

const TextExcerptPayloadSchema = z.object({
  selectedText: z.string().min(1),
  sourceUrl: z.url(),
  pageTitle: z.string(),
  domain: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional()
})

const memoryItemBaseSchema = z.object({
  id: z.uuid(),
  ownerId: z.uuid(),
  sourceLocalProfileId: z.uuid(),
  clues: MemoryCluesSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable().optional()
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
