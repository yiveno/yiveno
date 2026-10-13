import type { MemoryErrorCode } from '@/core/messaging/memory-messages'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'

const MEMORY_ERROR_MESSAGE_KEYS: Record<MemoryErrorCode, MessageKey> = {
  MEMORY_NOT_FOUND: 'error_memory_not_found',
  MEMORY_DELETE_BOOKMARK_FORBIDDEN: 'error_memory_delete_bookmark_forbidden',
  MEMORY_OPERATION_FAILED: 'error_memory_operation_failed',
  CAPTURE_UNSAVABLE_PAGE: 'error_capture_unsavable_page',
  CAPTURE_EMPTY_SELECTION: 'error_capture_empty_selection',
  BOOKMARK_INGEST_DISABLED: 'error_bookmark_ingest_disabled',
  EMBEDDING_BACKFILL_AUTH_REQUIRED: 'settings_ai_quota_sign_in',
  DETAIL_EXPORT_INVALID_COUNT: 'error_detail_export_invalid_count',
  DETAIL_EXPORT_ITEM_NOT_FOUND: 'error_detail_export_item_not_found',
  DETAIL_EXPORT_OPERATION_FAILED: 'error_detail_export_operation_failed'
}

/** 将 Memory errorCode 转为用户可见文案。 */
export function tMemoryError(errorCode: MemoryErrorCode): string {
  return t(MEMORY_ERROR_MESSAGE_KEYS[errorCode])
}

/** 是否为 Memory 业务 errorCode（排除 MESSAGE_DISPATCH_FAILED 等传输层码）。 */
export function isMemoryErrorCode(code: string): code is MemoryErrorCode {
  return Object.prototype.hasOwnProperty.call(MEMORY_ERROR_MESSAGE_KEYS, code)
}
