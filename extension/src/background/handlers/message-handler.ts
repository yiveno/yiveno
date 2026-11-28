import type {
  BackgroundMessage,
  BackgroundMessageResponse
} from '@/core/messaging/background-messages'
import { isBackgroundScopedMessage } from '@/core/messaging/background-messages'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { handleDebugBackgroundMessage } from '@/dev/probe/debug-dev-handler'
import {
  parseNavigateActiveTabPayload,
  parseOpenRecallShellPayload
} from '@/core/messaging/commands-messages'
import {
  handleAuthSignIn,
  handleAuthConnectWebsite,
  handleAuthSignOut,
  handleAckPrivacyNotice,
  handleClearLocalMemory,
  handleClearLocalRecallAdaptation,
  handleClearOrphanOwners,
  handleDeleteCloudMemory,
  handleDeleteAccount,
  handleExportLocalMemory,
  handleExportOrphanOwners,
  handleGetAuthState,
  handleGetLoginMigrationStatus,
  handleProbeWebsiteSignedIn,
  handleBindRequestCode,
  handleBindVerifyCode,
  handleConvertAnonymousAccount,
  handleRetryAnonymousCaptcha,
  handleGetSubscriptionStatus,
  handleGetSyncStatus,
  handleRefreshAuthProfile,
  handleResolveLoginMigration,
  handleRestoreLatestSyncBackup,
  handleIncrementalMemorySync,
  handleSetSyncEnabled,
  handleSetMcpReadOnly,
  handleSyncReplaceWithLocal,
  handleSyncReplaceWithRemote
} from '@/background/handlers/account-sync-handler'
import {
  handleGetExtensionCommands,
  handleNavigateActiveTab,
  handleOpenChromeShortcutsPage,
  handleOpenRecallShell
} from '@/background/handlers/commands-handler'
import {
  handleClearBehaviorHistory,
  handleDeleteThirdPartyCorpusBySource,
  handleEnsureChromeBookmarksImported,
  handleGetBehaviorHistoryImportStatus,
  handleGetBookmarkLibraryTree,
  handleGetChromeBookmarkImportStatus,
  handleGetColdStartStatus,
  handleGenerateGettingStartedClueSamples,
  handleGetBookmarkSyncStaleness,
  handleGetThirdPartyCorpusSummary,
  handleImportBehaviorHistory,
  handleImportLocalMemory,
  handleImportThirdPartyCorpus
} from '@/background/handlers/import-handler'
import { parseGetBookmarkLibraryTreePayload } from '@/core/messaging/import-messages'
import { handleMcpRecallEvidence } from '@/background/handlers/mcp-handler'
import {
  handleCaptureBookmark,
  handleCaptureTextExcerpt,
  handleDeleteMemoryItem,
  handleGetMemoryItem,
  handleGetPagePreview,
  handleListMemoryItems,
  handleBackfillMemoryEmbeddings,
  handleExportDetailExport,
  handleRecordMemoryOpen,
  handleRecordRecallDismiss,
  handleRecordRecallSettle,
  handleUpdateMemoryNote
} from '@/background/handlers/memory-handler'
import {
  handleGetRecallPageContext,
  handleRecallCancel,
  handleRecallWithClue
} from '@/background/handlers/recall-handler'
import {
  handlePortraitApproveFact,
  handlePortraitDeclineFact,
  handlePortraitPromoteOnConfirm,
  handlePortraitRefuteOnDismiss
} from '@/background/handlers/portrait-handler'
import { handleResolveClueUrlDisplay } from '@/background/handlers/resolve-clue-url-display'
import {
  handleGetAiHostedQuota,
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'
import {
  handleDeleteDualThreadContributedSketches,
  handleGetDualThreadLearningStatus,
  handleMaybeUploadDualThreadSketch
} from '@/background/handlers/dual-thread-handler'
import { handleGetDailyReview } from '@/background/handlers/daily-review-handler'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 将 sender.tab 的 tabId/windowId 并入 CAPTURE payload（payload 已有则保留）。
 * 划词浮层发消息时 content script 通常无 windowId；SW 侧从 sender 补全。
 */
function mergeCapturePreviewTabContext(
  payload: unknown,
  sender?: chrome.runtime.MessageSender
): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }
  const base = payload as Record<string, unknown>
  const tabId =
    typeof base.tabId === 'number'
      ? base.tabId
      : typeof sender?.tab?.id === 'number'
        ? sender.tab.id
        : undefined
  const windowId =
    typeof base.windowId === 'number'
      ? base.windowId
      : typeof sender?.tab?.windowId === 'number'
        ? sender.tab.windowId
        : undefined
  if (tabId === undefined && windowId === undefined) {
    return payload
  }
  return {
    ...base,
    ...(tabId !== undefined ? { tabId } : {}),
    ...(windowId !== undefined ? { windowId } : {})
  }
}

async function dispatchBackgroundMessage(
  message: BackgroundMessage,
  sender?: chrome.runtime.MessageSender
): Promise<BackgroundMessageResponse> {
  // 探活 PING 不阻塞；开 Side Panel 亦不可 await bootstrap（会丢掉用户手势）
  if (message.type !== 'PING' && message.type !== 'OPEN_RECALL_SHELL') {
    await ensureBackgroundBootstrapped()
  }

  switch (message.type) {
    case 'PING':
      return { ok: true }
    case 'AUTH_SIGN_IN':
      return handleAuthSignIn()
    case 'AUTH_CONNECT_WEBSITE':
      return handleAuthConnectWebsite()
    case 'AUTH_SIGN_OUT':
      return handleAuthSignOut(message.payload.mode, {
        deleteLocalExcerpts: message.payload.deleteLocalExcerpts === true
      })
    case 'GET_AUTH_STATE':
      return handleGetAuthState()
    case 'PROBE_WEBSITE_SIGNED_IN':
      return handleProbeWebsiteSignedIn()
    case 'RETRY_ANONYMOUS_CAPTCHA':
      return handleRetryAnonymousCaptcha()
    case 'BIND_REQUEST_CODE':
      return handleBindRequestCode(message.payload)
    case 'BIND_VERIFY_CODE':
      return handleBindVerifyCode(message.payload)
    case 'CONVERT_ANONYMOUS_ACCOUNT':
      return handleConvertAnonymousAccount(message.payload)
    case 'GET_SUBSCRIPTION_STATUS':
      return handleGetSubscriptionStatus(message.payload)
    case 'REFRESH_AUTH_PROFILE':
      return handleRefreshAuthProfile()
    case 'GET_SYNC_STATUS':
      return handleGetSyncStatus()
    case 'GET_LOGIN_MIGRATION_STATUS':
      return handleGetLoginMigrationStatus()
    case 'RESOLVE_LOGIN_MIGRATION':
      return handleResolveLoginMigration(message.payload.action)
    case 'SET_SYNC_ENABLED':
      return handleSetSyncEnabled(message.payload.enabled)
    case 'SET_MCP_READ_ONLY':
      return handleSetMcpReadOnly(message.payload.enabled)
    case 'RUN_INCREMENTAL_MEMORY_SYNC':
      return handleIncrementalMemorySync()
    case 'SYNC_REPLACE_WITH_LOCAL':
      return handleSyncReplaceWithLocal()
    case 'SYNC_REPLACE_WITH_REMOTE':
      return handleSyncReplaceWithRemote()
    case 'EXPORT_ORPHAN_OWNERS':
      return handleExportOrphanOwners()
    case 'CLEAR_ORPHAN_OWNERS':
      return handleClearOrphanOwners()
    case 'RESTORE_LATEST_SYNC_BACKUP':
      return handleRestoreLatestSyncBackup()
    case 'ACK_PRIVACY_NOTICE':
      return handleAckPrivacyNotice()
    case 'DELETE_CLOUD_MEMORY':
      return handleDeleteCloudMemory()
    case 'DELETE_ACCOUNT':
      return handleDeleteAccount()
    case 'EXPORT_LOCAL_MEMORY':
      return handleExportLocalMemory()
    case 'CLEAR_LOCAL_MEMORY':
      return handleClearLocalMemory()
    case 'CLEAR_LOCAL_RECALL_ADAPTATION':
      return handleClearLocalRecallAdaptation()
    case 'CAPTURE_BOOKMARK':
      return handleCaptureBookmark(mergeCapturePreviewTabContext(message.payload, sender))
    case 'CAPTURE_TEXT_EXCERPT':
      return handleCaptureTextExcerpt(mergeCapturePreviewTabContext(message.payload, sender))
    case 'LIST_MEMORY_ITEMS':
      return handleListMemoryItems(message.payload)
    case 'GET_MEMORY_ITEM':
      return handleGetMemoryItem(message.payload)
    case 'DELETE_MEMORY_ITEM':
      return handleDeleteMemoryItem(message.payload)
    case 'UPDATE_MEMORY_NOTE':
      return handleUpdateMemoryNote(message.payload)
    case 'RECORD_MEMORY_OPEN':
      return handleRecordMemoryOpen(message.payload)
    case 'RECORD_RECALL_DISMISS':
      return handleRecordRecallDismiss(message.payload)
    case 'RECORD_RECALL_SETTLE':
      return handleRecordRecallSettle(message.payload)
    case 'BACKFILL_MEMORY_EMBEDDINGS':
      return handleBackfillMemoryEmbeddings()
    case 'EXPORT_DETAIL_EXPORT':
      return handleExportDetailExport(message.payload)
    case 'GET_PAGE_PREVIEW':
      return handleGetPagePreview(message.payload)
    case 'RECALL_WITH_CLUE':
      return handleRecallWithClue(message.payload)
    case 'PORTRAIT_PROMOTE_ON_CONFIRM':
      return handlePortraitPromoteOnConfirm(message.payload)
    case 'PORTRAIT_REFUTE_ON_DISMISS':
      return handlePortraitRefuteOnDismiss(message.payload)
    case 'PORTRAIT_APPROVE_FACT':
      return handlePortraitApproveFact(message.payload)
    case 'PORTRAIT_DECLINE_FACT':
      return handlePortraitDeclineFact(message.payload)
    case 'RECALL_CANCEL':
      return handleRecallCancel(message.payload)
    case 'GET_RECALL_PAGE_CONTEXT':
      return handleGetRecallPageContext()
    case 'RESOLVE_CLUE_URL_DISPLAY':
      return handleResolveClueUrlDisplay(message.payload)
    case 'MCP_RECALL_EVIDENCE':
      return handleMcpRecallEvidence(message.payload)
    case 'GET_CHROME_BOOKMARK_IMPORT_STATUS':
      return handleGetChromeBookmarkImportStatus()
    case 'ENSURE_CHROME_BOOKMARKS_IMPORTED':
      return handleEnsureChromeBookmarksImported()
    case 'GET_BEHAVIOR_HISTORY_IMPORT_STATUS':
      return handleGetBehaviorHistoryImportStatus()
    case 'IMPORT_BEHAVIOR_HISTORY':
      return handleImportBehaviorHistory()
    case 'CLEAR_BEHAVIOR_HISTORY':
      return handleClearBehaviorHistory()
    case 'GET_COLD_START_STATUS':
      return handleGetColdStartStatus()
    case 'GENERATE_GETTING_STARTED_CLUE_SAMPLES':
      return handleGenerateGettingStartedClueSamples(message.payload)
    case 'IMPORT_THIRD_PARTY_CORPUS':
      return handleImportThirdPartyCorpus(message.payload)
    case 'IMPORT_LOCAL_MEMORY':
      return handleImportLocalMemory(message.payload)
    case 'GET_THIRD_PARTY_CORPUS_SUMMARY':
      return handleGetThirdPartyCorpusSummary()
    case 'GET_BOOKMARK_SYNC_STALENESS':
      return handleGetBookmarkSyncStaleness()
    case 'DELETE_THIRD_PARTY_CORPUS_BY_SOURCE':
      return handleDeleteThirdPartyCorpusBySource(message.payload)
    case 'GET_BOOKMARK_LIBRARY_TREE':
      return handleGetBookmarkLibraryTree(parseGetBookmarkLibraryTreePayload(message.payload))
    case 'GET_EXTENSION_COMMANDS':
      return handleGetExtensionCommands()
    case 'OPEN_CHROME_SHORTCUTS_PAGE':
      return handleOpenChromeShortcutsPage()
    case 'OPEN_RECALL_SHELL':
      return handleOpenRecallShell(
        {
          ...(typeof sender?.tab?.id === 'number' ? { tabId: sender.tab.id } : {}),
          ...(typeof sender?.tab?.windowId === 'number' ? { windowId: sender.tab.windowId } : {})
        },
        parseOpenRecallShellPayload(message.payload)
      )
    case 'NAVIGATE_ACTIVE_TAB':
      return handleNavigateActiveTab(parseNavigateActiveTabPayload(message.payload))
    case 'GET_USER_SETTINGS':
      return handleGetUserSettings()
    case 'UPDATE_USER_SETTINGS':
      return handleUpdateUserSettings(message.payload)
    case 'GET_AI_HOSTED_QUOTA':
      return handleGetAiHostedQuota()
    case 'GET_DUAL_THREAD_LEARNING_STATUS':
      return handleGetDualThreadLearningStatus()
    case 'DELETE_DUAL_THREAD_CONTRIBUTED_SKETCHES':
      return handleDeleteDualThreadContributedSketches()
    case 'MAYBE_UPLOAD_DUAL_THREAD_SKETCH':
      return handleMaybeUploadDualThreadSketch()
    case 'GET_DAILY_REVIEW':
      return handleGetDailyReview()
    case 'DEV_SEED_RECALL_PROBE':
    case 'DEV_PURGE_PROBE_NOISE':
    case 'DEV_PROBE_CLEANUP':
    case 'DEV_BACKDATE_MEMORY_SAVED_AT':
    case 'DEV_PROBE_LIBRARY_SNAPSHOT':
    case 'DEV_LIST_PROBE_FIXTURES':
    case 'DEV_COLD_MEMORY_IMPACT':
    case 'DEV_COLD_MEMORY_LATENCY':
    case 'DEV_RUN_PROBE_BATCH':
    case 'DEV_GET_PROBE_BATCH_PROGRESS':
    case 'DEV_LIST_PROBE_RUNS':
    case 'DEV_GET_PROBE_RUN':
    case 'DEV_DIFF_PROBE_RUNS': {
      // 扩展 SW 禁止动态 import()（HTML 规范）；须静态 import + prod stub。
      if (!import.meta.env.DEV) {
        return {
          ok: false,
          errorCode: 'DEV_ONLY',
          error: `${message.type} 仅开发构建可用`
        }
      }
      return handleDebugBackgroundMessage(message)
    }
    default:
      logger.warn('Msg', '未知消息类型', {
        type: (message as { type: string }).type
      })
      return {
        ok: false,
        errorCode: 'UNKNOWN_MESSAGE_TYPE',
        error: `未知消息类型: ${(message as { type: string }).type}`
      }
  }
}

/**
 * 处理 scope=background 的扩展消息（Side Panel / Settings 等）。
 * 异步 handler 需返回 true 以保持 sendResponse 通道。
 */
export function handleBackgroundMessage(
  message: unknown,
  sendResponse: (response: BackgroundMessageResponse) => void,
  sender?: chrome.runtime.MessageSender
): boolean {
  if (!isBackgroundScopedMessage(message)) {
    return false
  }

  const typed = message as BackgroundMessage
  const startedAt = flowStart('Msg', 'background 消息', { type: typed.type })

  void dispatchBackgroundMessage(typed, sender)
    .then(response => {
      const ok = 'ok' in response ? response.ok : undefined
      flowOk('Msg', 'background 消息', startedAt, {
        type: typed.type,
        ok,
        ...(!ok && 'errorCode' in response ? { errorCode: response.errorCode } : {})
      })
      sendResponse(response)
    })
    .catch(error => {
      flowFail('Msg', 'background 消息', startedAt, error, { type: typed.type })
      sendResponse({
        ok: false,
        errorCode: 'MESSAGE_DISPATCH_FAILED',
        ...(error instanceof Error ? { error: error.message } : {})
      })
    })

  return true
}
