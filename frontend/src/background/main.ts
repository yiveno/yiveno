import { openGettingStartedOnInstall } from '@/application/onboarding/open-getting-started-on-install'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { handleBackgroundMessage } from '@/background/handlers/message-handler'
import { ensureSidePanelOpensOnActionClick } from '@/infrastructure/browser/side-panel'
import {
  attachChromeBookmarkSyncListenersAtStartup,
  syncChromeBookmarkSyncListenersWithIngestSetting
} from '@/background/listeners/chrome-bookmark-sync'
import {
  registerContextMenuItems,
  registerContextMenuListeners
} from '@/background/listeners/context-menu'
import { registerExternalAuthHandoffListener } from '@/background/listeners/external-auth-handoff'
import { registerCommandListeners } from '@/background/listeners/commands'
import { registerMemoryCloudSyncAlarmListener } from '@/background/listeners/memory-cloud-sync-alarm'
import { registerOmniboxListeners } from '@/background/listeners/omnibox'
import { registerSelectionToolbarKeepaliveListener } from '@/background/listeners/selection-toolbar-keepalive'
import { exposeClueGatewayDebug } from '@/infrastructure/debug/expose-clue-gateway-debug'
import { exposeMemoryDevDebug } from '@/infrastructure/debug/expose-memory-dev-debug'
import { exposeRecallProbeSeedDebug } from '@/infrastructure/debug/expose-recall-probe-seed-debug'
import { exposeRecallTelemetryDebug } from '@/infrastructure/debug/expose-recall-telemetry-debug'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Background Service Worker 入口。
 *
 * 启动时 bootstrap 本地身份 / Memory DB / 书签导入与 sync；
 * 在此注册 runtime 消息与 onInstalled（含右键菜单）。
 * 禁止恢复旧书签管理器行为。
 */
exposeClueGatewayDebug()
exposeMemoryDevDebug()
exposeRecallProbeSeedDebug()
exposeRecallTelemetryDebug()
registerExternalAuthHandoffListener()
// 下列监听器须在 bootstrap/IDB 前同步挂上，避免 SW 冷启动丢事件（与 A2/A3/A6 同模式）
registerSelectionToolbarKeepaliveListener()
registerCommandListeners()
registerOmniboxListeners()
registerContextMenuListeners()
registerMemoryCloudSyncAlarmListener()

// SW 冷启动：尽早配置图标开 Side Panel，不等待 DB/bootstrap（chrome-extensions Rule 2）
void ensureSidePanelOpensOnActionClick().catch(error => {
  logger.error('SidePanel', 'SW 入口 setPanelBehavior 失败', error)
})
// 同步挂上监听，消除读 Settings 前的空窗；关灌库时 sync 会再卸下
attachChromeBookmarkSyncListenersAtStartup()
void syncChromeBookmarkSyncListenersWithIngestSetting().catch(error => {
  logger.warn('Background', '启动时同步书签监听失败，将由 bootstrap 重试', error)
})

chrome.runtime.onInstalled.addListener(details => {
  // install/update 后再次幂等配置，避免仅依赖 bootstrap 时序
  void ensureSidePanelOpensOnActionClick().catch(error => {
    logger.error('SidePanel', 'onInstalled setPanelBehavior 失败', error)
  })
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
