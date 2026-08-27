import { z } from 'zod'

import { CaptureEntrySchema } from '@/core/memory/capture-entry'
import { SupportedMemoryItemTypeSchema } from '@/core/memory/memory-item-type'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { EvidencePack } from '@/core/recall/evidence-pack'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

const exportEvidencePackPayloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(2).max(5)
})

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

/** §7.2：写入 settledCount（Mark / 经校准的 medium target），非裸 open。 */
const recordRecallSettlePayloadSchema = z.object({
  id: z.string().uuid()
})

/** Memory 操作面向 UI 的稳定错误码。 */
export const MemoryErrorCodeSchema = z.enum([
  'MEMORY_NOT_FOUND', // 条目不存在
  'MEMORY_DELETE_BOOKMARK_FORBIDDEN', // 禁止删书签类 Memory（应走 Chrome 书签）
  'MEMORY_OPERATION_FAILED', // 通用 Memory 操作失败
  'CAPTURE_UNSAVABLE_PAGE', // 当前页不可存
  'CAPTURE_EMPTY_SELECTION', // 无有效选区
  'BOOKMARK_INGEST_DISABLED', // 用户关闭了书签灌库
  'EMBEDDING_BACKFILL_AUTH_REQUIRED', // 回填 embedding 须登录
  'EVIDENCE_PACK_INVALID_COUNT', // evidence pack 条数须 2–5
  'EVIDENCE_PACK_ITEM_NOT_FOUND', // 所选条目不存在或已删
  'EVIDENCE_PACK_OPERATION_FAILED' // evidence pack 导出失败
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

/** 记录 Recall settled 正例（§7.2 settledCount）。 */
export type RecordRecallSettleMessage = {
  scope: BackgroundMessageScope
  type: 'RECORD_RECALL_SETTLE'
  payload: z.infer<typeof recordRecallSettlePayloadSchema>
}

/** Pro：回填本机缺失的 embedding（限量入队）。 */
export type BackfillMemoryEmbeddingsMessage = {
  scope: BackgroundMessageScope
  type: 'BACKFILL_MEMORY_EMBEDDINGS'
}

/** 多选导出 evidence pack（§5.10.4；2–5 条）。 */
export type ExportEvidencePackMessage = {
  scope: BackgroundMessageScope
  type: 'EXPORT_EVIDENCE_PACK'
  payload: z.infer<typeof exportEvidencePackPayloadSchema>
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
  | RecordRecallSettleMessage
  | BackfillMemoryEmbeddingsMessage
  | ExportEvidencePackMessage

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

export type MemoryEmbeddingBackfillSuccessResponse = {
  ok: true
  /** 已成功写回 embedding 的条数（Settings 文案沿用 enqueued 字段名） */
  enqueued: number
  scanned: number
  /** 失败条数（含配额中断） */
  failed?: number
  /** IndexedDB 配额耗尽导致中断 */
  quotaHit?: boolean
}

export type ExportEvidencePackSuccessResponse = {
  ok: true
  pack: EvidencePack
  markdown: string
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
  | MemoryEmbeddingBackfillSuccessResponse
  | ExportEvidencePackSuccessResponse
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

export function parseRecordRecallSettlePayload(value: unknown) {
  return recordRecallSettlePayloadSchema.parse(value)
}

export function parseExportEvidencePackPayload(value: unknown) {
  return exportEvidencePackPayloadSchema.parse(value)
}
