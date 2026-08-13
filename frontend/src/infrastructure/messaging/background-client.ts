import type {
  BackgroundMessage,
  BackgroundMessageResponse
} from '@/core/messaging/background-messages'
import type {
  AuthSignInResponse,
  AuthSignOutMode,
  AuthSignOutResponse,
  ClearLocalMemoryResponse,
  ClearOrphanOwnersResponse,
  DeleteAccountResponse,
  DeleteCloudMemoryResponse,
  ExportLocalMemoryResponse,
  ExportOrphanOwnersResponse,
  GetAuthStateResponse,
  GetSubscriptionStatusResponse,
  GetSyncStatusResponse,
  RefreshAuthProfileResponse,
  RestoreLatestSyncBackupResponse,
  AckPrivacyNoticeResponse,
  RunIncrementalMemorySyncResponse,
  SetSyncEnabledResponse
} from '@/core/messaging/account-sync-messages'
import type {
  GetExtensionCommandsMessage,
  GetExtensionCommandsResponse,
  OpenChromeShortcutsPageMessage,
  OpenChromeShortcutsPageResponse,
  OpenRecallPopupMessage,
  OpenRecallPopupResponse
} from '@/core/messaging/commands-messages'
import type {
  ChromeBookmarkImportStatusResponse,
  GetBookmarkLibraryTreeResponse,
  GetChromeBookmarkImportStatusMessage,
  GetBookmarkLibraryTreeMessage
} from '@/core/messaging/import-messages'
import type {
  ListMemoryItemsMessage,
  GetMemoryItemMessage,
  DeleteMemoryItemMessage,
  UpdateMemoryNoteMessage,
  RecordMemoryOpenMessage,
  RecordRecallDismissMessage,
  CaptureTextExcerptMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  RecallBackgroundResponse,
  RecallWithClueMessage
} from '@/core/messaging/recall-messages'
import type {
  GetAiHostedQuotaResponse,
  GetUserSettingsResponse,
  UpdateUserSettingsMessage,
  UpdateUserSettingsResponse
} from '@/core/messaging/settings-messages'

/** 向 Background 发送消息并返回响应。 */
export async function sendBackgroundMessage<TResponse extends BackgroundMessageResponse>(
  message: BackgroundMessage
): Promise<TResponse> {
  return (await chrome.runtime.sendMessage(message)) as TResponse
}

/** 根据线索执行 Recall。 */
export async function recallWithClue(
  payload: RecallWithClueMessage['payload']
): Promise<RecallBackgroundResponse> {
  const message: RecallWithClueMessage = {
    scope: 'background',
    type: 'RECALL_WITH_CLUE',
    payload
  }
  return sendBackgroundMessage<RecallBackgroundResponse>(message)
}

/** 列出 MemoryItem（探活可用 limit: 1）。 */
export async function listMemoryItems(
  payload?: ListMemoryItemsMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: ListMemoryItemsMessage = {
    scope: 'background',
    type: 'LIST_MEMORY_ITEMS',
    ...(payload === undefined ? {} : { payload })
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 捕获页面选区摘录（Getting Started / 扩展页等）。 */
export async function captureTextExcerpt(
  payload: CaptureTextExcerptMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: CaptureTextExcerptMessage = {
    scope: 'background',
    type: 'CAPTURE_TEXT_EXCERPT',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 按 id 读取 MemoryItem。 */
export async function getMemoryItem(
  payload: GetMemoryItemMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: GetMemoryItemMessage = {
    scope: 'background',
    type: 'GET_MEMORY_ITEM',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 软删 MemoryItem（当前仅摘录）。 */
export async function deleteMemoryItem(
  payload: DeleteMemoryItemMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: DeleteMemoryItemMessage = {
    scope: 'background',
    type: 'DELETE_MEMORY_ITEM',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 更新 MemoryItem 备注（书签/摘录）。 */
export async function updateMemoryNote(
  payload: UpdateMemoryNoteMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: UpdateMemoryNoteMessage = {
    scope: 'background',
    type: 'UPDATE_MEMORY_NOTE',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 记录 MemoryItem 打开（openCount / lastOpenedAt）。 */
export async function recordMemoryOpen(
  payload: RecordMemoryOpenMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: RecordMemoryOpenMessage = {
    scope: 'background',
    type: 'RECORD_MEMORY_OPEN',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 记录否定反馈（dismissCount）。 */
export async function recordRecallDismiss(
  payload: RecordRecallDismissMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: RecordRecallDismissMessage = {
    scope: 'background',
    type: 'RECORD_RECALL_DISMISS',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 回填本机缺失 embedding（须登录；Worker 日配额分档）。 */
export async function backfillMemoryEmbeddings(): Promise<MemoryBackgroundResponse> {
  return sendBackgroundMessage<MemoryBackgroundResponse>({
    scope: 'background',
    type: 'BACKFILL_MEMORY_EMBEDDINGS'
  })
}

/** 查询 Chrome 书签导入进度。 */
export async function fetchChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  const message: GetChromeBookmarkImportStatusMessage = {
    scope: 'background',
    type: 'GET_CHROME_BOOKMARK_IMPORT_STATUS'
  }
  return sendBackgroundMessage<ChromeBookmarkImportStatusResponse>(message)
}

/** 读取记忆库书签目录树（Chrome 结构 + Memory 对齐）。 */
export async function fetchBookmarkLibraryTree(): Promise<GetBookmarkLibraryTreeResponse> {
  const message: GetBookmarkLibraryTreeMessage = {
    scope: 'background',
    type: 'GET_BOOKMARK_LIBRARY_TREE'
  }
  return sendBackgroundMessage<GetBookmarkLibraryTreeResponse>(message)
}

/** 读取扩展命令与当前快捷键。 */
export async function fetchExtensionCommands(): Promise<GetExtensionCommandsResponse> {
  const message: GetExtensionCommandsMessage = {
    scope: 'background',
    type: 'GET_EXTENSION_COMMANDS'
  }
  return sendBackgroundMessage<GetExtensionCommandsResponse>(message)
}

/** 打开 Chrome 原生快捷键设置页。 */
export async function openChromeShortcutsPage(): Promise<OpenChromeShortcutsPageResponse> {
  const message: OpenChromeShortcutsPageMessage = {
    scope: 'background',
    type: 'OPEN_CHROME_SHORTCUTS_PAGE'
  }
  return sendBackgroundMessage<OpenChromeShortcutsPageResponse>(message)
}

/** 在用户手势链上打开 Recall Popup（预填线索须已写入 session）。 */
export async function openRecallPopup(): Promise<OpenRecallPopupResponse> {
  const message: OpenRecallPopupMessage = {
    scope: 'background',
    type: 'OPEN_RECALL_POPUP'
  }
  return sendBackgroundMessage<OpenRecallPopupResponse>(message)
}

/** 读取用户设置。 */
export async function fetchUserSettings(): Promise<GetUserSettingsResponse> {
  return sendBackgroundMessage<GetUserSettingsResponse>({
    scope: 'background',
    type: 'GET_USER_SETTINGS'
  })
}

/** 读取托管 Clue LLM 配额（须登录）。 */
export async function fetchAiHostedQuota(): Promise<GetAiHostedQuotaResponse> {
  return sendBackgroundMessage<GetAiHostedQuotaResponse>({
    scope: 'background',
    type: 'GET_AI_HOSTED_QUOTA'
  })
}

/** 更新用户设置。 */
export async function updateUserSettings(
  payload: UpdateUserSettingsMessage['payload']
): Promise<UpdateUserSettingsResponse> {
  return sendBackgroundMessage<UpdateUserSettingsResponse>({
    scope: 'background',
    type: 'UPDATE_USER_SETTINGS',
    payload
  })
}

/** 读取登录态与同步偏好。 */
export async function fetchAuthState(): Promise<GetAuthStateResponse> {
  return sendBackgroundMessage<GetAuthStateResponse>({
    scope: 'background',
    type: 'GET_AUTH_STATE'
  })
}

/** 从 Supabase 刷新头像 / 展示名到本机 session。 */
export async function refreshAuthProfile(): Promise<RefreshAuthProfileResponse> {
  return sendBackgroundMessage<RefreshAuthProfileResponse>({
    scope: 'background',
    type: 'REFRESH_AUTH_PROFILE'
  })
}

/** OAuth 登录（打开官网登录页；session 由官网回传）。 */
export async function authSignIn(): Promise<AuthSignInResponse> {
  return sendBackgroundMessage<AuthSignInResponse>({
    scope: 'background',
    type: 'AUTH_SIGN_IN'
  })
}

/** 退出登录（须指定对本机该账号 Memory 的处理策略）。 */
export async function authSignOut(mode: AuthSignOutMode): Promise<AuthSignOutResponse> {
  return sendBackgroundMessage<AuthSignOutResponse>({
    scope: 'background',
    type: 'AUTH_SIGN_OUT',
    payload: { mode }
  })
}

/** 读取本机/云端同步状态。 */
export async function fetchSyncStatus(): Promise<GetSyncStatusResponse> {
  return sendBackgroundMessage<GetSyncStatusResponse>({
    scope: 'background',
    type: 'GET_SYNC_STATUS'
  })
}

/** 开关云同步。 */
export async function setSyncEnabled(enabled: boolean): Promise<SetSyncEnabledResponse> {
  return sendBackgroundMessage<SetSyncEnabledResponse>({
    scope: 'background',
    type: 'SET_SYNC_ENABLED',
    payload: { enabled }
  })
}

/** 立即跑一轮增量云同步（与定时闹钟同路径）。 */
export async function runIncrementalMemorySync(): Promise<RunIncrementalMemorySyncResponse> {
  return sendBackgroundMessage<RunIncrementalMemorySyncResponse>({
    scope: 'background',
    type: 'RUN_INCREMENTAL_MEMORY_SYNC'
  })
}

/** 导出本机换号残留（孤儿 owner）桶。 */
export async function exportOrphanOwners(): Promise<ExportOrphanOwnersResponse> {
  return sendBackgroundMessage<ExportOrphanOwnersResponse>({
    scope: 'background',
    type: 'EXPORT_ORPHAN_OWNERS'
  })
}

/** 清除本机换号残留（孤儿 owner）桶。 */
export async function clearOrphanOwners(): Promise<ClearOrphanOwnersResponse> {
  return sendBackgroundMessage<ClearOrphanOwnersResponse>({
    scope: 'background',
    type: 'CLEAR_ORPHAN_OWNERS'
  })
}

/** 从云端最近一次 replace 备份恢复，并拉回本机。 */
export async function restoreLatestSyncBackup(): Promise<RestoreLatestSyncBackupResponse> {
  return sendBackgroundMessage<RestoreLatestSyncBackupResponse>({
    scope: 'background',
    type: 'RESTORE_LATEST_SYNC_BACKUP'
  })
}

/** 确认当前版本隐私说明。 */
export async function ackPrivacyNotice(): Promise<AckPrivacyNoticeResponse> {
  return sendBackgroundMessage<AckPrivacyNoticeResponse>({
    scope: 'background',
    type: 'ACK_PRIVACY_NOTICE'
  })
}

/** 删除云端全部记忆（默认不动本机）。 */
export async function deleteCloudMemory(): Promise<DeleteCloudMemoryResponse> {
  return sendBackgroundMessage<DeleteCloudMemoryResponse>({
    scope: 'background',
    type: 'DELETE_CLOUD_MEMORY'
  })
}

/** 删除账号（云端 + Auth + 本机当前账号桶 + 退登）。 */
export async function deleteAccount(): Promise<DeleteAccountResponse> {
  return sendBackgroundMessage<DeleteAccountResponse>({
    scope: 'background',
    type: 'DELETE_ACCOUNT'
  })
}

/** 导出当前 owner 本机全部记忆（含软删）。 */
export async function exportLocalMemory(): Promise<ExportLocalMemoryResponse> {
  return sendBackgroundMessage<ExportLocalMemoryResponse>({
    scope: 'background',
    type: 'EXPORT_LOCAL_MEMORY'
  })
}

/** 清除当前 owner 本机全部记忆（不动 Chrome 原生书签）。 */
export async function clearLocalMemory(): Promise<ClearLocalMemoryResponse> {
  return sendBackgroundMessage<ClearLocalMemoryResponse>({
    scope: 'background',
    type: 'CLEAR_LOCAL_MEMORY'
  })
}

/** 读取本机订阅快照（可选强制刷新）。 */
export async function fetchSubscriptionStatus(options?: {
  refresh?: boolean
}): Promise<GetSubscriptionStatusResponse> {
  return sendBackgroundMessage<GetSubscriptionStatusResponse>({
    scope: 'background',
    type: 'GET_SUBSCRIPTION_STATUS',
    ...(options?.refresh ? { payload: { refresh: true } } : {})
  })
}
