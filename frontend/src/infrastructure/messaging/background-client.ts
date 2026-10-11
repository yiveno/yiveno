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
  ProbeWebsiteSignedInResponse,
  GetSubscriptionStatusResponse,
  GetSyncStatusResponse,
  RefreshAuthProfileResponse,
  RestoreLatestSyncBackupResponse,
  AckPrivacyNoticeResponse,
  RunIncrementalMemorySyncResponse,
  SetSyncEnabledResponse,
  SetMcpReadOnlyResponse
} from '@/core/messaging/account-sync-messages'
import type {
  GetExtensionCommandsMessage,
  GetExtensionCommandsResponse,
  NavigateActiveTabMessage,
  NavigateActiveTabPayload,
  NavigateActiveTabResponse,
  OpenChromeShortcutsPageMessage,
  OpenChromeShortcutsPageResponse,
  OpenRecallShellMessage,
  OpenRecallShellResponse
} from '@/core/messaging/commands-messages'
import type {
  ChromeBookmarkImportStatusResponse,
  ColdStartStatusResponse,
  GenerateGettingStartedClueSamplesMessage,
  GenerateGettingStartedClueSamplesResponse,
  GetBookmarkLibraryTreeResponse,
  GetChromeBookmarkImportStatusMessage,
  GetColdStartStatusMessage,
  GetBookmarkLibraryTreeMessage,
  ImportThirdPartyCorpusMessage,
  ImportThirdPartyCorpusResponse
} from '@/core/messaging/import-messages'
import type {
  ListMemoryItemsMessage,
  GetMemoryItemMessage,
  DeleteMemoryItemMessage,
  UpdateMemoryNoteMessage,
  RecordMemoryOpenMessage,
  RecordRecallDismissMessage,
  RecordRecallSettleMessage,
  ExportDetailExportMessage,
  CaptureTextExcerptMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  RecallBackgroundResponse,
  RecallCancelResponse,
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
  try {
    const response = await chrome.runtime.sendMessage(message)
    if (response === undefined) {
      return {
        ok: false,
        errorCode: 'MESSAGE_DISPATCH_FAILED',
        error: 'Background 无响应'
      } as TResponse
    }
    return response as TResponse
  } catch (error) {
    return {
      ok: false,
      errorCode: 'MESSAGE_DISPATCH_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    } as TResponse
  }
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

/** 显式取消 in-flight recall（Side Panel 提交新 clue 时同步发出）。 */
export async function cancelRecall(payload: {
  source: RecallWithClueMessage['payload']['source']
  recallId: string
}): Promise<RecallCancelResponse> {
  return sendBackgroundMessage<RecallCancelResponse>({
    scope: 'background',
    type: 'RECALL_CANCEL',
    payload
  })
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

/** 更新 MemoryItem 附注（`clues.note`；书签/摘录）。 */
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

/** 记录 settled 正例（settledCount · §7.2）。 */
export async function recordRecallSettle(
  payload: RecordRecallSettleMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: RecordRecallSettleMessage = {
    scope: 'background',
    type: 'RECORD_RECALL_SETTLE',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 多选导出 detail export（§5.10.4；≥1 条）。 */
export async function exportDetailExport(
  payload: ExportDetailExportMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: ExportDetailExportMessage = {
    scope: 'background',
    type: 'EXPORT_DETAIL_EXPORT',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
}

/** 查询 Chrome 书签导入进度。 */
export async function fetchChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  const message: GetChromeBookmarkImportStatusMessage = {
    scope: 'background',
    type: 'GET_CHROME_BOOKMARK_IMPORT_STATUS'
  }
  return sendBackgroundMessage<ChromeBookmarkImportStatusResponse>(message)
}

/** 导入 Raindrop / Pocket 导出文件（§5.10.6）。 */
export async function importThirdPartyCorpus(
  payload: ImportThirdPartyCorpusMessage['payload']
): Promise<ImportThirdPartyCorpusResponse> {
  const message: ImportThirdPartyCorpusMessage = {
    scope: 'background',
    type: 'IMPORT_THIRD_PARTY_CORPUS',
    payload
  }
  return sendBackgroundMessage<ImportThirdPartyCorpusResponse>(message)
}

/** 查询冷启动三阶段门禁进度。 */
export async function fetchColdStartStatus(): Promise<ColdStartStatusResponse> {
  const message: GetColdStartStatusMessage = {
    scope: 'background',
    type: 'GET_COLD_START_STATUS'
  }
  return sendBackgroundMessage<ColdStartStatusResponse>(message)
}

/** Getting Started：生成示意 clue（LLM 一次 4 条；失败回退模板）。 */
export async function generateGettingStartedClueSamplesMessage(options?: {
  fallbackClue?: string
}): Promise<GenerateGettingStartedClueSamplesResponse> {
  const message: GenerateGettingStartedClueSamplesMessage = {
    scope: 'background',
    type: 'GENERATE_GETTING_STARTED_CLUE_SAMPLES',
    ...(options?.fallbackClue ? { payload: { fallbackClue: options.fallbackClue } } : {})
  }
  return sendBackgroundMessage<GenerateGettingStartedClueSamplesResponse>(message)
}

/** 读取记忆库书签目录树（Chrome 结构 + Memory 对齐）。 */
export async function fetchBookmarkLibraryTree(options?: {
  clientHash?: string | undefined
}): Promise<GetBookmarkLibraryTreeResponse> {
  const message: GetBookmarkLibraryTreeMessage = {
    scope: 'background',
    type: 'GET_BOOKMARK_LIBRARY_TREE',
    ...(options?.clientHash ? { payload: { clientHash: options.clientHash } } : {})
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

/** 打开 Recall Side Panel（划词等 content script → SW；扩展页应本页直调 sidePanel.open）。 */
export async function openRecallShell(): Promise<OpenRecallShellResponse> {
  const message: OpenRecallShellMessage = {
    scope: 'background',
    type: 'OPEN_RECALL_SHELL'
  }
  return sendBackgroundMessage<OpenRecallShellResponse>(message)
}

/** 在活动标签（或新标签）打开 URL；Side Panel 结果卡默认复用当前页。 */
export async function navigateActiveTab(
  payload: NavigateActiveTabPayload
): Promise<NavigateActiveTabResponse> {
  const message: NavigateActiveTabMessage = {
    scope: 'background',
    type: 'NAVIGATE_ACTIVE_TAB',
    payload
  }
  return sendBackgroundMessage<NavigateActiveTabResponse>(message)
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

/** 探测官网是否已登录（不写入扩展 session）。 */
export async function probeWebsiteSignedIn(): Promise<ProbeWebsiteSignedInResponse> {
  return sendBackgroundMessage<ProbeWebsiteSignedInResponse>({
    scope: 'background',
    type: 'PROBE_WEBSITE_SIGNED_IN'
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

/** 同步只读 MCP 开关到 Worker（未登录时仅本机生效）。 */
export async function setMcpReadOnly(enabled: boolean): Promise<SetMcpReadOnlyResponse> {
  return sendBackgroundMessage<SetMcpReadOnlyResponse>({
    scope: 'background',
    type: 'SET_MCP_READ_ONLY',
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
