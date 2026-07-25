import type { MemoryErrorCode } from '@/core/messaging/memory-messages'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'

const MEMORY_ERROR_MESSAGE_KEYS: Record<MemoryErrorCode, MessageKey> = {
  MEMORY_NOT_FOUND: 'error_memory_not_found',
  MEMORY_DELETE_BOOKMARK_FORBIDDEN: 'error_memory_delete_bookmark_forbidden',
  MEMORY_OPERATION_FAILED: 'error_memory_operation_failed',
  CAPTURE_UNSAVABLE_PAGE: 'error_capture_unsavable_page',
  CAPTURE_EMPTY_SELECTION: 'error_capture_empty_selection'
}

/** 将 Memory errorCode 转为用户可见文案。 */
export function tMemoryError(errorCode: MemoryErrorCode): string {
  return t(MEMORY_ERROR_MESSAGE_KEYS[errorCode])
}
