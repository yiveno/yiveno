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

/** Memory 操作面向 UI 的稳定错误码。 */
export const MemoryErrorCodeSchema = z.enum([
  'MEMORY_NOT_FOUND',
  'MEMORY_DELETE_BOOKMARK_FORBIDDEN',
  'MEMORY_OPERATION_FAILED'
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

export type MemoryBackgroundMessage =
  | CaptureBookmarkMessage
  | CaptureTextExcerptMessage
  | ListMemoryItemsMessage
  | GetMemoryItemMessage
  | DeleteMemoryItemMessage

export type MemoryItemSuccessResponse = {
  ok: true
  item: MemoryItem
}

export type MemoryItemListSuccessResponse = {
  ok: true
  items: MemoryItem[]
  total: number
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
