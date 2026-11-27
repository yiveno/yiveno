import { scheduleColdStartPipeline } from '@/application/onboarding/cold-start-pipeline-service'
import { maybeUploadDualThreadSketch } from '@/application/recall/dual-thread-learning-service'
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
import {
  bindBackgroundBootstrapRunner,
  ensureBackgroundBootstrapped,
  resetBackgroundBootstrapForTests
} from '@/background/bootstrap-ready'
import { syncChromeBookmarkSyncListenersWithSyncSetting } from '@/background/listeners/chrome-bookmark-sync'
import { registerCommandListeners } from '@/background/listeners/commands'
import { registerContextMenuListeners } from '@/background/listeners/context-menu'
import { registerChromeBookmarkRepairAlarmListener } from '@/background/listeners/chrome-bookmark-repair-alarm'
import { registerDreamingAlarmListener } from '@/background/listeners/dreaming-alarm'
import { registerLinkStatusSweepAlarmListener } from '@/background/listeners/link-status-sweep-alarm'
import { registerMemoryCloudSyncAlarmListener } from '@/background/listeners/memory-cloud-sync-alarm'
import { registerOmniboxListeners } from '@/background/listeners/omnibox'
import { registerSelectionToolbarKeepaliveListener } from '@/background/listeners/selection-toolbar-keepalive'
import { ensureDeviceSessionReady } from '@/infrastructure/auth/ensure-device-session-ready'
import { ensureExtensionUninstallFeedbackUrl } from '@/infrastructure/auth/extension-uninstall-url'
import { ensureSidePanelOpensOnActionClick } from '@/infrastructure/browser/side-panel'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import {
  onSubscriptionChanged,
  type SubscriptionChangedEvent
} from '@/infrastructure/identity/subscription-service'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { initUiLocaleFromSettings } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { installNlgGateMetricsChromeStorage } from '@/infrastructure/storage/nlg-gate-metrics-storage'
import { logChromeStorageQuotaSample } from '@/infrastructure/storage/chrome-storage-quota'

/**
 * 订阅变更时刷新线索 LLM completer（Background 层处理事件，符合分层架构）。
 */
function handleSubscriptionChanged(event: SubscriptionChangedEvent): void {
  void refreshClueLlmCompleterFromDevConfig().catch(error => {
    logger.warn('Background', '订阅变更后线索 LLM 重挂失败', {
      reason: event.reason,
      error: error instanceof Error ? error.message : String(error)
    })
  })
}

/**
 * Background 启动时初始化本地身份、Memory DB，并调度冷启动三阶段门禁。
 * 右键菜单项仅在 `chrome.runtime.onInstalled` 中注册，避免 reload 时重复调用 contextMenus API。
 */
async function bootstrapBackground(): Promise<void> {
  const startedAt = flowStart('Background', 'bootstrap 开始')
  try {
    // UI 语言偏好（右键菜单 / omnibox 文案走 t()）
    await initUiLocaleFromSettings().catch(error => {
      logger.warn('Background', 'UI 语言初始化失败，回退 chrome.i18n', error)
    })

    // Recall 主壳：点图标开 Side Panel（须无 default_popup）
    await ensureSidePanelOpensOnActionClick()

    // 卸载必开反馈页（与登录解耦；有 token 时 URL 顺带挂 revoke）
    await ensureExtensionUninstallFeedbackUrl().catch(error => {
      logger.warn('Background', '登记卸载反馈 URL 失败', error)
    })

    const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])

    await initializeMemoryDatabase()

    // 按灌库开关挂/卸书签监听（关则完全不听 Chrome bookmarks.*）
    await syncChromeBookmarkSyncListenersWithSyncSetting()
    // 与 main.ts 入口重复注册；幂等，确保 bootstrap 路径也挂上
    registerContextMenuListeners()
    registerOmniboxListeners()
    registerCommandListeners()
    registerSelectionToolbarKeepaliveListener()
    registerMemoryCloudSyncAlarmListener()
    registerChromeBookmarkRepairAlarmListener()
    registerDreamingAlarmListener()
    registerLinkStatusSweepAlarmListener()
    // 订阅变更 → 线索 LLM 重挂（通过事件机制，避免 infrastructure → application 跨层依赖）
    // Set-based listener，不会重复注册（SW 重启不会累积）
    onSubscriptionChanged(handleSubscriptionChanged)

    // 先 ensure device（migrate / 匿名）；exchange 完成前不得挂 hosted AI
    await ensureDeviceSessionReady().catch(error => {
      logger.warn('Background', 'ensure device session 失败（fail-open）', error)
    })

    await refreshClueLlmCompleterFromDevConfig().catch(error => {
      logger.warn('Background', '线索 LLM 开发配置加载失败，将仅用规则理解', error)
    })

    logger.info('Background', '本地身份与 Memory DB 已就绪', {
      localProfileId: profile.localProfileId,
      ownerId,
      database: 'YivenoMemoryDB'
    })

    // import → rules → AI 尽力；存量已导入则迁移 ready 并静默补缺口
    scheduleColdStartPipeline()
    // 暗线贡献：启动时按门禁尝试上传一次（失败静默，不挡启动）
    void maybeUploadDualThreadSketch().catch(error => {
      logger.warn('Background', '暗线汇总上传检查失败（静默）', error)
    })
    void installNlgGateMetricsChromeStorage().catch(error => {
      logger.warn('Background', 'NLG 门禁度量落盘接线失败（静默）', error)
    })
    void logChromeStorageQuotaSample('bootstrap')
    flowOk('Background', 'bootstrap 完成', startedAt)
  } catch (error) {
    flowFail('Background', 'bootstrap 失败，下次消息将重试', startedAt, error)
    throw error
  }
}

bindBackgroundBootstrapRunner(bootstrapBackground)

export { ensureBackgroundBootstrapped, resetBackgroundBootstrapForTests }
