import { z } from 'zod'

import { CaptureEntrySchema } from '@/core/memory/capture-entry'
import { SupportedMemoryItemTypeSchema } from '@/core/memory/memory-item-type'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

const captureBookmarkPayloadSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  faviconUrl: z.string().url().optional(),
  captureEntry: CaptureEntrySchema.optional()
})

const captureTextExcerptPayloadSchema = z.object({
  selectedText: z.string().min(1),
  sourceUrl: z.string().url(),
  pageTitle: z.string(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  /** 用户附注（写入 clues.note；非独立 note 类型）。 */
  note: z.string().trim().max(500).optional(),
  captureEntry: CaptureEntrySchema.optional()
})

const listMemoryItemsPayloadSchema = z
  .object({
    type: SupportedMemoryItemTypeSchema.optional(),
    limit: z.number().int().positive().max(500).optional()
  })
  .optional()

const getMemoryItemPayloadSchema = z.object({
  id: z.string().uuid()
})

const deleteMemoryItemPayloadSchema = z.object({
  id: z.string().uuid()
})

const updateMemoryNotePayloadSchema = z.object({
  id: z.string().uuid(),
  /** 空字符串表示清除备注。 */
  note: z.string().trim().max(500)
})

const recordMemoryOpenPayloadSchema = z.object({
  id: z.string().uuid()
})

const recordRecallDismissPayloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(20)
})

/** Memory 操作面向 UI 的稳定错误码。 */
export const MemoryErrorCodeSchema = z.enum([
  'MEMORY_NOT_FOUND', // 条目不存在
  'MEMORY_DELETE_BOOKMARK_FORBIDDEN', // 禁止删书签类 Memory（应走 Chrome 书签）
  'MEMORY_OPERATION_FAILED', // 通用 Memory 操作失败
  'CAPTURE_UNSAVABLE_PAGE', // 当前页不可存
  'CAPTURE_EMPTY_SELECTION', // 无有效选区
  'BOOKMARK_INGEST_DISABLED' // 用户关闭了书签灌库
])

export type MemoryErrorCode = z.infer<typeof MemoryErrorCodeSchema>

/** 捕获 Bookmark MemoryItem。 */
export type CaptureBookmarkMessage = {
  scope: BackgroundMessageScope
  type: 'CAPTURE_BOOKMARK'
  payload: z.infer<typeof captureBookmarkPayloadSchema>
}

/** 捕获 Text Excerpt MemoryItem。 */
export type CaptureTextExcerptMessage = {
  scope: BackgroundMessageScope
  type: 'CAPTURE_TEXT_EXCERPT'
  payload: z.infer<typeof captureTextExcerptPayloadSchema>
}

/** 列出当前用户的 MemoryItem。 */
export type ListMemoryItemsMessage = {
  scope: BackgroundMessageScope
  type: 'LIST_MEMORY_ITEMS'
  payload?: z.infer<typeof listMemoryItemsPayloadSchema>
}

/** 按 id 读取单条 MemoryItem。 */
export type GetMemoryItemMessage = {
  scope: BackgroundMessageScope
  type: 'GET_MEMORY_ITEM'
  payload: z.infer<typeof getMemoryItemPayloadSchema>
}

/** 软删 MemoryItem（当前仅允许 text_excerpt）。 */
export type DeleteMemoryItemMessage = {
  scope: BackgroundMessageScope
  type: 'DELETE_MEMORY_ITEM'
  payload: z.infer<typeof deleteMemoryItemPayloadSchema>
}

/** 更新 MemoryItem 的 clues.note（书签/摘录事后补注）。 */
export type UpdateMemoryNoteMessage = {
  scope: BackgroundMessageScope
  type: 'UPDATE_MEMORY_NOTE'
  payload: z.infer<typeof updateMemoryNotePayloadSchema>
}

/** 记录用户打开某条 Memory（写 openCount / lastOpenedAt）。 */
export type RecordMemoryOpenMessage = {
  scope: BackgroundMessageScope
  type: 'RECORD_MEMORY_OPEN'
  payload: z.infer<typeof recordMemoryOpenPayloadSchema>
}

/** 记录否定反馈（Need A Clue / 结果「都不是这些」）。 */
export type RecordRecallDismissMessage = {
  scope: BackgroundMessageScope
  type: 'RECORD_RECALL_DISMISS'
  payload: z.infer<typeof recordRecallDismissPayloadSchema>
}

export type MemoryBackgroundMessage =
  | CaptureBookmarkMessage
  | CaptureTextExcerptMessage
  | ListMemoryItemsMessage
  | GetMemoryItemMessage
  | DeleteMemoryItemMessage
  | UpdateMemoryNoteMessage
  | RecordMemoryOpenMessage
  | RecordRecallDismissMessage

export type MemoryItemSuccessResponse = {
  ok: true
  item: MemoryItem
}

export type MemoryItemListSuccessResponse = {
  ok: true
  items: MemoryItem[]
  total: number
}

export type MemoryDismissSuccessResponse = {
  ok: true
  updated: number
}

export type MemoryItemErrorResponse = {
  ok: false
  errorCode: MemoryErrorCode
  /** 调试用；UI 不得用于控制流或主文案。 */
  error?: string
}

export type MemoryBackgroundResponse =
  | MemoryItemSuccessResponse
  | MemoryItemListSuccessResponse
  | MemoryDismissSuccessResponse
  | MemoryItemErrorResponse

export function parseCaptureBookmarkPayload(value: unknown) {
  return captureBookmarkPayloadSchema.parse(value)
}

export function parseCaptureTextExcerptPayload(value: unknown) {
  return captureTextExcerptPayloadSchema.parse(value)
}

export function parseListMemoryItemsPayload(value: unknown) {
  return listMemoryItemsPayloadSchema.parse(value)
}

export function parseGetMemoryItemPayload(value: unknown) {
  return getMemoryItemPayloadSchema.parse(value)
}

export function parseDeleteMemoryItemPayload(value: unknown) {
  return deleteMemoryItemPayloadSchema.parse(value)
}

export function parseUpdateMemoryNotePayload(value: unknown) {
  return updateMemoryNotePayloadSchema.parse(value)
}

export function parseRecordMemoryOpenPayload(value: unknown) {
  return recordMemoryOpenPayloadSchema.parse(value)
}

export function parseRecordRecallDismissPayload(value: unknown) {
  return recordRecallDismissPayloadSchema.parse(value)
}
