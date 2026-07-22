/** v4 Offscreen Document 入口，供未来本地 embedding 等无 DOM 安全任务使用。 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'scope' in message &&
    message.scope === 'offscreen' &&
    'type' in message &&
    message.type === 'PING'
  ) {
    sendResponse({ ok: true })
  }
})
