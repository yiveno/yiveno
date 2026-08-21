import type { AccountSyncErrorCode } from '@/core/messaging/account-sync-messages'
import type { CommandsErrorCode } from '@/core/messaging/commands-messages'
import type { ImportErrorCode } from '@/core/messaging/import-messages'
import type { ChromeBookmarkImportErrorCode } from '@/core/memory/chrome-bookmark-import-state'
import type { RecallErrorCode } from '@/core/messaging/recall-messages'
import type { SettingsErrorCode } from '@/core/messaging/settings-messages'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'

const SETTINGS_ERROR_MESSAGE_KEYS: Record<SettingsErrorCode, MessageKey> = {
  SETTINGS_READ_FAILED: 'settings_error_load',
  SETTINGS_UPDATE_FAILED: 'settings_error_update',
  AI_HOSTED_QUOTA_AUTH_REQUIRED: 'settings_ai_quota_sign_in',
  AI_HOSTED_QUOTA_FAILED: 'settings_ai_quota_failed'
}

const ACCOUNT_SYNC_ERROR_MESSAGE_KEYS: Record<AccountSyncErrorCode, MessageKey> = {
  AUTH_NOT_CONFIGURED: 'settings_error_auth_not_configured',
  AUTH_SIGN_IN_FAILED: 'settings_error_auth_sign_in',
  AUTH_SIGN_OUT_FAILED: 'settings_error_auth_sign_out',
  AUTH_STATE_READ_FAILED: 'settings_error_auth_state',
  AUTH_PROFILE_REFRESH_FAILED: 'settings_error_auth_profile_refresh',
  SYNC_NOT_AUTHENTICATED: 'settings_error_sync_not_authenticated',
  SYNC_PRO_REQUIRED: 'settings_error_sync_pro_required',
  SYNC_STATUS_FAILED: 'settings_error_sync_status',
  SYNC_PREFS_UPDATE_FAILED: 'settings_error_sync_prefs',
  SYNC_REPLACE_LOCAL_FAILED: 'settings_error_sync_replace_local',
  SYNC_REPLACE_LOCAL_EMPTY: 'settings_error_sync_replace_local_empty',
  SYNC_REPLACE_REMOTE_FAILED: 'settings_error_sync_replace_remote',
  SYNC_MERGE_FAILED: 'settings_error_sync_merge',
  SYNC_RESTORE_BACKUP_FAILED: 'settings_error_sync_restore_backup',
  SYNC_INCREMENTAL_FAILED: 'settings_error_sync_incremental',
  PRIVACY_NOTICE_REQUIRED: 'settings_error_privacy_notice_required',
  PRIVACY_ACK_FAILED: 'settings_error_privacy_ack',
  CLOUD_DELETE_FAILED: 'settings_error_cloud_delete',
  ACCOUNT_DELETE_FAILED: 'settings_error_account_delete',
  LOCAL_EXPORT_FAILED: 'settings_error_local_export',
  LOCAL_CLEAR_FAILED: 'settings_error_local_clear',
  ORPHAN_EXPORT_FAILED: 'settings_error_orphan_export',
  ORPHAN_CLEAR_FAILED: 'settings_error_orphan_clear',
  SUBSCRIPTION_STATUS_FAILED: 'settings_error_subscription_status'
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
  SHORTCUTS_PAGE_OPEN_FAILED: 'settings_error_open_shortcuts',
  RECALL_SHELL_OPEN_FAILED: 'selection_toolbar_open_recall_failed'
}

const IMPORT_STATE_ERROR_MESSAGE_KEYS: Record<ChromeBookmarkImportErrorCode, MessageKey> = {
  BOOKMARK_IMPORT_FAILED: 'popup_import_failed_fallback'
}

/** Settings errorCode → 用户文案。 */
export function tSettingsError(errorCode: SettingsErrorCode): string {
  return t(SETTINGS_ERROR_MESSAGE_KEYS[errorCode])
}

/** 账户 / 同步 errorCode → 用户文案。 */
export function tAccountSyncError(errorCode: AccountSyncErrorCode): string {
  return t(ACCOUNT_SYNC_ERROR_MESSAGE_KEYS[errorCode])
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
