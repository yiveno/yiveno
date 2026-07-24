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
  handleListMemoryItems
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
      error: error instanceof Error ? error.message : '读取本地身份失败'
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
      return { ok: false, error: `未知消息类型: ${(message as { type: string }).type}` }
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
        error: error instanceof Error ? error.message : '消息处理失败'
      })
    })

  return true
}
