import type {
  BackgroundMessage,
  BackgroundMessageResponse
} from '@/core/messaging/background-messages'
import type {
  GetExtensionCommandsMessage,
  GetExtensionCommandsResponse,
  OpenChromeShortcutsPageMessage,
  OpenChromeShortcutsPageResponse
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
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  RecallBackgroundResponse,
  RecallWithClueMessage
} from '@/core/messaging/recall-messages'
import type {
  SettingsBackgroundResponse,
  UpdateUserSettingsMessage
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

/** 读取用户设置。 */
export async function fetchUserSettings(): Promise<SettingsBackgroundResponse> {
  return sendBackgroundMessage<SettingsBackgroundResponse>({
    scope: 'background',
    type: 'GET_USER_SETTINGS'
  })
}

/** 更新用户设置。 */
export async function updateUserSettings(
  payload: UpdateUserSettingsMessage['payload']
): Promise<SettingsBackgroundResponse> {
  return sendBackgroundMessage<SettingsBackgroundResponse>({
    scope: 'background',
    type: 'UPDATE_USER_SETTINGS',
    payload
  })
}
