import type { ChromeBookmarkTreeChangedMessage } from '@/core/messaging/ui-messages'
import { UI_MESSAGE_SCOPE } from '@/core/messaging/ui-messages'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 向已打开的扩展页广播「Chrome 书签树已变」。
 * 无接收方（未开记忆库）时 Chrome 会 reject，属正常，静默忽略。
 */
export function notifyChromeBookmarkTreeChanged(): void {
  const message: ChromeBookmarkTreeChangedMessage = {
    scope: UI_MESSAGE_SCOPE,
    type: 'CHROME_BOOKMARK_TREE_CHANGED'
  }
  try {
    void chrome.runtime.sendMessage(message).catch(() => {
      // 无监听页：忽略
    })
  } catch {
    // 测试环境或 runtime 不可用：忽略
  }
  logger.info('ChromeBookmarkSync', '已广播书签树变更通知')
}
