import type {
  BackgroundMessage,
  BackgroundMessageResponse,
  GetLocalIdentityResponse
} from '@/core/messaging/background-messages'
import { isBackgroundScopedMessage } from '@/core/messaging/background-messages'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { parseNavigateActiveTabPayload } from '@/core/messaging/commands-messages'
import {
  handleAuthSignIn,
  handleAuthSignOut,
  handleAckPrivacyNotice,
  handleClearLocalMemory,
  handleClearOrphanOwners,
  handleDeleteCloudMemory,
  handleDeleteAccount,
  handleExportLocalMemory,
  handleExportOrphanOwners,
  handleGetAuthState,
  handleGetSubscriptionStatus,
  handleGetSyncStatus,
  handleRefreshAuthProfile,
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
  handleGetBookmarkLibraryTree,
  handleGetChromeBookmarkImportStatus,
  handleGetColdStartStatus,
  handleGetThirdPartyCorpusImportStatus,
  handleImportThirdPartyCorpus
} from '@/background/handlers/import-handler'
import { parseGetBookmarkLibraryTreePayload } from '@/core/messaging/import-messages'
import { handleMcpRecallEvidence } from '@/background/handlers/mcp-handler'
import {
  handleCaptureBookmark,
  handleCaptureTextExcerpt,
  handleDeleteMemoryItem,
  handleGetMemoryItem,
  handleListMemoryItems,
  handleBackfillMemoryEmbeddings,
  handleExportDetailExport,
  handleRecordMemoryOpen,
  handleRecordRecallDismiss,
  handleRecordRecallSettle,
  handleUpdateMemoryNote
} from '@/background/handlers/memory-handler'
import { handleRecallWithClue } from '@/background/handlers/recall-handler'
import {
  handleGetAiHostedQuota,
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'
import {
  parseBackdateMemorySavedAtPayload,
  parseSeedRecallProbePayload,
  type DevBackdateMemorySavedAtResponse,
  type DevPurgeProbeNoiseResponse,
  type DevSeedRecallProbeResponse
} from '@/core/messaging/debug-messages'
import {
  backdateMemorySavedAt,
  type BackdateMemorySavedAtInput
} from '@/infrastructure/debug/memory-dev-backdate-saved-at'
import { purgeProbeNoiseFromLibrary } from '@/infrastructure/debug/recall-probe-purge-service'
import { seedRecallProbeCorpus } from '@/infrastructure/debug/recall-probe-seed-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'

async function handleGetLocalIdentity(): Promise<GetLocalIdentityResponse> {
  const startedAt = flowStart('Identity', '读取本地身份')
  try {
    const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])
    flowOk('Identity', '读取本地身份', startedAt, {
      localProfileId: profile.localProfileId,
      ownerId
    })
    return { ok: true, profile, ownerId }
  } catch (error) {
    flowFail('Identity', '读取本地身份', startedAt, error)
    return {
      ok: false,
      errorCode: 'IDENTITY_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

async function dispatchBackgroundMessage(
  message: BackgroundMessage,
  sender?: chrome.runtime.MessageSender
): Promise<BackgroundMessageResponse> {
  // 探活 PING 不阻塞；其余消息须等 bootstrap（IDB / 身份）完成，避免冷启动竞态
  if (message.type !== 'PING') {
    await ensureBackgroundBootstrapped()
  }

  switch (message.type) {
    case 'PING':
      return { ok: true }
    case 'GET_LOCAL_IDENTITY':
      return handleGetLocalIdentity()
    case 'AUTH_SIGN_IN':
      return handleAuthSignIn()
    case 'AUTH_SIGN_OUT':
      return handleAuthSignOut(message.payload.mode)
    case 'GET_AUTH_STATE':
      return handleGetAuthState()
    case 'GET_SUBSCRIPTION_STATUS':
      return handleGetSubscriptionStatus(message.payload)
    case 'REFRESH_AUTH_PROFILE':
      return handleRefreshAuthProfile()
    case 'GET_SYNC_STATUS':
      return handleGetSyncStatus()
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
    case 'CAPTURE_BOOKMARK':
      return handleCaptureBookmark(message.payload)
    case 'CAPTURE_TEXT_EXCERPT':
      return handleCaptureTextExcerpt(message.payload)
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
    case 'RECALL_WITH_CLUE':
      return handleRecallWithClue(message.payload)
    case 'MCP_RECALL_EVIDENCE':
      return handleMcpRecallEvidence(message.payload)
    case 'GET_CHROME_BOOKMARK_IMPORT_STATUS':
      return handleGetChromeBookmarkImportStatus()
    case 'GET_COLD_START_STATUS':
      return handleGetColdStartStatus()
    case 'IMPORT_THIRD_PARTY_CORPUS':
      return handleImportThirdPartyCorpus(message.payload)
    case 'GET_THIRD_PARTY_CORPUS_IMPORT_STATUS':
      return handleGetThirdPartyCorpusImportStatus()
    case 'GET_BOOKMARK_LIBRARY_TREE':
      return handleGetBookmarkLibraryTree(parseGetBookmarkLibraryTreePayload(message.payload))
    case 'GET_EXTENSION_COMMANDS':
      return handleGetExtensionCommands()
    case 'OPEN_CHROME_SHORTCUTS_PAGE':
      return handleOpenChromeShortcutsPage()
    case 'OPEN_RECALL_SHELL':
      return handleOpenRecallShell({
        ...(typeof sender?.tab?.id === 'number' ? { tabId: sender.tab.id } : {}),
        ...(typeof sender?.tab?.windowId === 'number' ? { windowId: sender.tab.windowId } : {})
      })
    case 'NAVIGATE_ACTIVE_TAB':
      return handleNavigateActiveTab(parseNavigateActiveTabPayload(message.payload))
    case 'GET_USER_SETTINGS':
      return handleGetUserSettings()
    case 'UPDATE_USER_SETTINGS':
      return handleUpdateUserSettings(message.payload)
    case 'GET_AI_HOSTED_QUOTA':
      return handleGetAiHostedQuota()
    case 'DEV_SEED_RECALL_PROBE': {
      if (!import.meta.env.DEV) {
        const denied: DevSeedRecallProbeResponse = {
          ok: false,
          errorCode: 'DEV_ONLY',
          error: 'DEV_SEED_RECALL_PROBE 仅开发构建可用'
        }
        return denied
      }
      try {
        const parsed = parseSeedRecallProbePayload(message.payload)
        const result = await seedRecallProbeCorpus(parsed)
        const ok: DevSeedRecallProbeResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevSeedRecallProbeResponse = {
          ok: false,
          errorCode: 'DEV_SEED_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_PURGE_PROBE_NOISE': {
      if (!import.meta.env.DEV) {
        const denied: DevPurgeProbeNoiseResponse = {
          ok: false,
          errorCode: 'DEV_ONLY',
          error: 'DEV_PURGE_PROBE_NOISE 仅开发构建可用'
        }
        return denied
      }
      try {
        const result = await purgeProbeNoiseFromLibrary()
        const ok: DevPurgeProbeNoiseResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevPurgeProbeNoiseResponse = {
          ok: false,
          errorCode: 'DEV_PURGE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
    }
    case 'DEV_BACKDATE_MEMORY_SAVED_AT': {
      if (!import.meta.env.DEV) {
        const denied: DevBackdateMemorySavedAtResponse = {
          ok: false,
          errorCode: 'DEV_ONLY',
          error: 'DEV_BACKDATE_MEMORY_SAVED_AT 仅开发构建可用'
        }
        return denied
      }
      try {
        const parsed = parseBackdateMemorySavedAtPayload(message.payload)
        const input: BackdateMemorySavedAtInput = { ids: parsed.ids }
        if (parsed.daysAgo !== undefined) {
          input.daysAgo = parsed.daysAgo
        } else if (parsed.savedAtIso !== undefined) {
          input.savedAtIso = parsed.savedAtIso
        }
        const result = await backdateMemorySavedAt(input)
        const ok: DevBackdateMemorySavedAtResponse = { ok: true, ...result }
        return ok
      } catch (error) {
        const failed: DevBackdateMemorySavedAtResponse = {
          ok: false,
          errorCode: 'DEV_BACKDATE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        }
        return failed
      }
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
