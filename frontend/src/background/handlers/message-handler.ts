import type {
  BackgroundMessage,
  BackgroundMessageResponse,
  GetLocalIdentityResponse
} from '@/core/messaging/background-messages'
import { isBackgroundScopedMessage } from '@/core/messaging/background-messages'
import {
  handleGetExtensionCommands,
  handleOpenChromeShortcutsPage
} from '@/background/handlers/commands-handler'
import {
  handleGetBookmarkLibraryTree,
  handleGetChromeBookmarkImportStatus
} from '@/background/handlers/import-handler'
import {
  handleCaptureBookmark,
  handleCaptureTextExcerpt,
  handleDeleteMemoryItem,
  handleGetMemoryItem,
  handleListMemoryItems,
  handleRecordMemoryOpen,
  handleRecordRecallDismiss,
  handleUpdateMemoryNote
} from '@/background/handlers/memory-handler'
import { handleRecallWithClue } from '@/background/handlers/recall-handler'
import {
  handleGetUserSettings,
  handleUpdateUserSettings
} from '@/background/handlers/settings-handler'
import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'

async function handleGetLocalIdentity(): Promise<GetLocalIdentityResponse> {
  try {
    const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])
    return { ok: true, profile, ownerId }
  } catch (error) {
    logger.error('Background', '读取本地身份失败', error)
    return {
      ok: false,
      errorCode: 'IDENTITY_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

async function dispatchBackgroundMessage(
  message: BackgroundMessage
): Promise<BackgroundMessageResponse> {
  switch (message.type) {
    case 'PING':
      return { ok: true }
    case 'GET_LOCAL_IDENTITY':
      return handleGetLocalIdentity()
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
    case 'RECALL_WITH_CLUE':
      return handleRecallWithClue(message.payload)
    case 'GET_CHROME_BOOKMARK_IMPORT_STATUS':
      return handleGetChromeBookmarkImportStatus()
    case 'GET_BOOKMARK_LIBRARY_TREE':
      return handleGetBookmarkLibraryTree()
    case 'GET_EXTENSION_COMMANDS':
      return handleGetExtensionCommands()
    case 'OPEN_CHROME_SHORTCUTS_PAGE':
      return handleOpenChromeShortcutsPage()
    case 'GET_USER_SETTINGS':
      return handleGetUserSettings()
    case 'UPDATE_USER_SETTINGS':
      return handleUpdateUserSettings(message.payload)
    default:
      return {
        ok: false,
        errorCode: 'UNKNOWN_MESSAGE_TYPE',
        error: `未知消息类型: ${(message as { type: string }).type}`
      }
  }
}

/**
 * 处理 scope=background 的扩展消息（Popup / Settings）。
 * 异步 handler 需返回 true 以保持 sendResponse 通道。
 */
export function handleBackgroundMessage(
  message: unknown,
  sendResponse: (response: BackgroundMessageResponse) => void
): boolean {
  if (!isBackgroundScopedMessage(message)) {
    return false
  }

  void dispatchBackgroundMessage(message as BackgroundMessage)
    .then(sendResponse)
    .catch(error => {
      logger.error('Background', '消息处理失败', error)
      sendResponse({
        ok: false,
        errorCode: 'MESSAGE_DISPATCH_FAILED',
        ...(error instanceof Error ? { error: error.message } : {})
      })
    })

  return true
}
