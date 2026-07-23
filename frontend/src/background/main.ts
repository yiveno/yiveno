import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { registerContextMenuItems } from '@/background/listeners/context-menu'
import { logger } from '@/infrastructure/logging/logger'

/**
 * v4 Background 入口。
 *
 * Chrome API 监听器随着 Capture、Recall 等领域模块逐项注册；
 * 禁止在此恢复旧书签管理行为。
 */
chrome.runtime.onInstalled.addListener(details => {
  void ensureBackgroundBootstrapped()
    .then(() => registerContextMenuItems())
    .catch(error => {
      logger.error('Background', '安装/更新后初始化失败', error)
    })
  logger.info('Background', 'v4 扩展已安装/更新', { reason: details.reason })
})

void ensureBackgroundBootstrapped().catch(error => {
  logger.error('Background', '启动初始化失败', error)
})

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  return handleBackgroundMessage(message, sendResponse)
})
