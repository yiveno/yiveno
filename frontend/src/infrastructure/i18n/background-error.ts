import type { CommandsErrorCode } from '@/core/messaging/commands-messages'
import type { ImportErrorCode } from '@/core/messaging/import-messages'
import type { ChromeBookmarkImportErrorCode } from '@/core/memory/chrome-bookmark-import-state'
import type { RecallErrorCode } from '@/core/messaging/recall-messages'
import type { SettingsErrorCode } from '@/core/messaging/settings-messages'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'

const SETTINGS_ERROR_MESSAGE_KEYS: Record<SettingsErrorCode, MessageKey> = {
  SETTINGS_READ_FAILED: 'settings_error_load',
  SETTINGS_UPDATE_FAILED: 'settings_error_update'
}

const RECALL_ERROR_MESSAGE_KEYS: Record<RecallErrorCode, MessageKey> = {
  RECALL_FAILED: 'popup_recall_failed'
}

const IMPORT_ERROR_MESSAGE_KEYS: Record<ImportErrorCode, MessageKey> = {
  IMPORT_STATUS_READ_FAILED: 'error_import_status_read_failed',
  LIBRARY_TREE_READ_FAILED: 'library_load_failed'
}

const COMMANDS_ERROR_MESSAGE_KEYS: Record<CommandsErrorCode, MessageKey> = {
  COMMANDS_READ_FAILED: 'settings_error_load_commands',
  SHORTCUTS_PAGE_OPEN_FAILED: 'settings_error_open_shortcuts'
}

const IMPORT_STATE_ERROR_MESSAGE_KEYS: Record<ChromeBookmarkImportErrorCode, MessageKey> = {
  BOOKMARK_IMPORT_FAILED: 'popup_import_failed_fallback'
}

/** Settings errorCode → 用户文案。 */
export function tSettingsError(errorCode: SettingsErrorCode): string {
  return t(SETTINGS_ERROR_MESSAGE_KEYS[errorCode])
}

/** Recall errorCode → 用户文案。 */
export function tRecallError(errorCode: RecallErrorCode): string {
  return t(RECALL_ERROR_MESSAGE_KEYS[errorCode])
}

/** Import / 书签树 API errorCode → 用户文案。 */
export function tImportError(errorCode: ImportErrorCode): string {
  return t(IMPORT_ERROR_MESSAGE_KEYS[errorCode])
}

/** Commands errorCode → 用户文案。 */
export function tCommandsError(errorCode: CommandsErrorCode): string {
  return t(COMMANDS_ERROR_MESSAGE_KEYS[errorCode])
}

/** 书签导入状态 errorCode → 用户文案。 */
export function tImportStateError(errorCode: ChromeBookmarkImportErrorCode): string {
  return t(IMPORT_STATE_ERROR_MESSAGE_KEYS[errorCode])
}
