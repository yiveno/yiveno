import { scheduleColdStartPipeline } from '@/application/onboarding/cold-start-pipeline-service'
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
import { syncChromeBookmarkSyncListenersWithIngestSetting } from '@/background/listeners/chrome-bookmark-sync'
import { registerCommandListeners } from '@/background/listeners/commands'
import { registerContextMenuListeners } from '@/background/listeners/context-menu'
import { registerMemoryCloudSyncAlarmListener } from '@/background/listeners/memory-cloud-sync-alarm'
import { registerOmniboxListeners } from '@/background/listeners/omnibox'
import { registerSelectionToolbarKeepaliveListener } from '@/background/listeners/selection-toolbar-keepalive'
import { ensureSidePanelOpensOnActionClick } from '@/infrastructure/browser/side-panel'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'
import { logger } from '@/infrastructure/logging/logger'

let bootstrapPromise: Promise<void> | null = null

/**
 * Background 启动时初始化本地身份、Memory DB，并调度冷启动三阶段门禁。
 * 右键菜单项仅在 `chrome.runtime.onInstalled` 中注册，避免 reload 时重复调用 contextMenus API。
 */
async function bootstrapBackground(): Promise<void> {
  // Recall 主壳：点图标开 Side Panel（须无 default_popup）
  await ensureSidePanelOpensOnActionClick()

  const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])

  await initializeMemoryDatabase()

  // 按灌库开关挂/卸书签监听（关则完全不听 Chrome bookmarks.*）
  await syncChromeBookmarkSyncListenersWithIngestSetting()
  // 与 main.ts 入口重复注册；幂等，确保 bootstrap 路径也挂上
  registerContextMenuListeners()
  registerOmniboxListeners()
  registerCommandListeners()
  registerSelectionToolbarKeepaliveListener()
  registerMemoryCloudSyncAlarmListener()

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
}

/** 幂等启动 Background；并发调用合并为一次 bootstrap。 */
export function ensureBackgroundBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapBackground().catch(error => {
      bootstrapPromise = null
      throw error
    })
  }

  return bootstrapPromise
}

/** 测试用：重置 bootstrap 状态。 */
export function resetBackgroundBootstrapForTests(): void {
  bootstrapPromise = null
}
