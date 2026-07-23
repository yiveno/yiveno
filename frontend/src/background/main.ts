import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { registerContextMenuItems } from '@/background/listeners/context-menu'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Background Service Worker 入口。
 *
 * 启动时 bootstrap 本地身份 / Memory DB / 书签导入与 sync；
 * 在此注册 runtime 消息与 onInstalled（含右键菜单）。
 * 禁止恢复旧书签管理器行为。
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
