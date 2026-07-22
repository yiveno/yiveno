import { logger } from '@/infrastructure/logging/logger'

/**
 * v4 Background 入口。
 *
 * 当前只建立生命周期边界；Chrome API 监听器会随着 Capture、Recall 等领域模块
 * 逐项注册，禁止在此恢复旧书签管理行为。
 */
chrome.runtime.onInstalled.addListener(details => {
  logger.info('Background', 'v4 基础设施已就绪', { reason: details.reason })
})

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'scope' in message &&
    message.scope === 'background' &&
    'type' in message &&
    message.type === 'PING'
  ) {
    sendResponse({ ok: true })
  }
})
