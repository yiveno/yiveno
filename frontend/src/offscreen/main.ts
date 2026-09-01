import { handleOffscreenRuntimeMessage } from '@/offscreen/offscreen-message'

/** v4 Offscreen Document 入口，供未来本地 embedding 等无 DOM 安全任务使用。 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  return handleOffscreenRuntimeMessage(message, sendResponse)
})
