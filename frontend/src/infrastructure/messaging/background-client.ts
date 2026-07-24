import type {
  BackgroundMessage,
  BackgroundMessageResponse
} from '@/core/messaging/background-messages'
import type {
  CommandsBackgroundResponse,
  GetExtensionCommandsMessage,
  OpenChromeShortcutsPageMessage
} from '@/core/messaging/commands-messages'
import type {
  ImportBackgroundResponse,
  GetChromeBookmarkImportStatusMessage
} from '@/core/messaging/import-messages'
import type {
  RecallBackgroundResponse,
  RecallWithClueMessage
} from '@/core/messaging/recall-messages'

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

/** 查询 Chrome 书签导入进度。 */
export async function fetchChromeBookmarkImportStatus(): Promise<ImportBackgroundResponse> {
  const message: GetChromeBookmarkImportStatusMessage = {
    scope: 'background',
    type: 'GET_CHROME_BOOKMARK_IMPORT_STATUS'
  }
  return sendBackgroundMessage<ImportBackgroundResponse>(message)
}

/** 读取扩展命令与当前快捷键。 */
export async function fetchExtensionCommands(): Promise<CommandsBackgroundResponse> {
  const message: GetExtensionCommandsMessage = {
    scope: 'background',
    type: 'GET_EXTENSION_COMMANDS'
  }
  return sendBackgroundMessage<CommandsBackgroundResponse>(message)
}

/** 打开 Chrome 原生快捷键设置页。 */
export async function openChromeShortcutsPage(): Promise<CommandsBackgroundResponse> {
  const message: OpenChromeShortcutsPageMessage = {
    scope: 'background',
    type: 'OPEN_CHROME_SHORTCUTS_PAGE'
  }
  return sendBackgroundMessage<CommandsBackgroundResponse>(message)
}
