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

const captureCurrentPagePayloadSchema = z
  .object({
    captureEntry: CaptureEntrySchema.optional()
  })
  .optional()

/** 捕获当前活动页为 Bookmark MemoryItem。 */
export type CaptureCurrentPageMessage = {
  scope: BackgroundMessageScope
  type: 'CAPTURE_CURRENT_PAGE'
  payload?: z.infer<typeof captureCurrentPagePayloadSchema>
}

/** 列出当前用户的 MemoryItem。 */
export type ListMemoryItemsMessage = {
  scope: BackgroundMessageScope
  type: 'LIST_MEMORY_ITEMS'
  payload?: z.infer<typeof listMemoryItemsPayloadSchema>
}

export type MemoryBackgroundMessage =
  | CaptureBookmarkMessage
  | CaptureTextExcerptMessage
  | CaptureCurrentPageMessage
  | ListMemoryItemsMessage

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
  error: string
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

export function parseCaptureCurrentPagePayload(value: unknown) {
  return captureCurrentPagePayloadSchema.parse(value)
}
