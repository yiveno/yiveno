import { openGettingStartedOnInstall } from '@/application/onboarding/open-getting-started-on-install'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { syncChromeBookmarkSyncListenersWithIngestSetting } from '@/background/listeners/chrome-bookmark-sync'
import { registerContextMenuItems } from '@/background/listeners/context-menu'
import { registerExternalAuthHandoffListener } from '@/background/listeners/external-auth-handoff'
import { exposeClueGatewayDebug } from '@/infrastructure/debug/expose-clue-gateway-debug'
import { exposeRecallProbeSeedDebug } from '@/infrastructure/debug/expose-recall-probe-seed-debug'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Background Service Worker 入口。
 *
 * 启动时 bootstrap 本地身份 / Memory DB / 书签导入与 sync；
 * 在此注册 runtime 消息与 onInstalled（含右键菜单）。
 * 禁止恢复旧书签管理器行为。
 */
exposeClueGatewayDebug()
exposeRecallProbeSeedDebug()
registerExternalAuthHandoffListener()
// 尽早按灌库开关挂监听（关则不挂）；开时尽量早于 DB await，降低 MV3 丢 onCreated
void syncChromeBookmarkSyncListenersWithIngestSetting().catch(error => {
  logger.warn('Background', '启动时同步书签监听失败，将由 bootstrap 重试', error)
})

chrome.runtime.onInstalled.addListener(details => {
  void ensureBackgroundBootstrapped()
    .then(async () => {
      await registerContextMenuItems()
      await openGettingStartedOnInstall(details.reason)
    })
    .catch(error => {
      logger.error('Background', '安装/更新后初始化失败', error)
    })
  logger.info('Background', 'v4 扩展已安装/更新', { reason: details.reason })
})

void ensureBackgroundBootstrapped().catch(error => {
  logger.error('Background', '启动初始化失败', error)
})

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  return handleBackgroundMessage(message, sendResponse, sender)
})
