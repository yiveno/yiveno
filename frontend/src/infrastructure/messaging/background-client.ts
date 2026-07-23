import type {
  BackgroundMessage,
  BackgroundMessageResponse
} from '@/core/messaging/background-messages'
import type {
  ImportBackgroundResponse,
  GetChromeBookmarkImportStatusMessage
} from '@/core/messaging/import-messages'
import type {
  CaptureCurrentPageMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
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

/** 捕获当前活动页为 Bookmark MemoryItem。 */
export async function captureCurrentPage(
  payload?: CaptureCurrentPageMessage['payload']
): Promise<MemoryBackgroundResponse> {
  const message: CaptureCurrentPageMessage = {
    scope: 'background',
    type: 'CAPTURE_CURRENT_PAGE',
    payload
  }
  return sendBackgroundMessage<MemoryBackgroundResponse>(message)
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
