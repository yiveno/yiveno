import { ensureChromeBookmarksImported } from '@/application/capture/import-chrome-bookmarks-service'
import { ensureMemoryEnrichmentBackfilled } from '@/application/memory/ensure-memory-enrichment-backfill'
import { refreshClueLlmCompleterFromDevConfig } from '@/application/recall/refresh-clue-llm-completer'
import { registerChromeBookmarkSyncListeners } from '@/background/listeners/chrome-bookmark-sync'
import { registerCommandListeners } from '@/background/listeners/commands'
import { registerContextMenuListeners } from '@/background/listeners/context-menu'
import { registerMemoryCloudSyncAlarmListener } from '@/background/listeners/memory-cloud-sync-alarm'
import { registerOmniboxListeners } from '@/background/listeners/omnibox'
import { registerSelectionToolbarKeepaliveListener } from '@/background/listeners/selection-toolbar-keepalive'
import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { initializeMemoryDatabase } from '@/infrastructure/indexeddb/memory-db'

/** 扩展 reload 后延迟启动书签导入，避免与 Chrome 扩展卸载/重装窗口重叠。 */
const CHROME_BOOKMARK_IMPORT_START_DELAY_MS = 500

/** enrichment 回填略晚于书签导入启动，降低启动尖峰。 */
const MEMORY_ENRICHMENT_BACKFILL_START_DELAY_MS = 1500

let bootstrapPromise: Promise<void> | null = null

/**
 * Background 启动时初始化本地身份、Memory DB，并异步导入 Chrome 书签。
 * 右键菜单项仅在 `chrome.runtime.onInstalled` 中注册，避免 reload 时重复调用 contextMenus API。
 */
async function bootstrapBackground(): Promise<void> {
  const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])

  await initializeMemoryDatabase()

  registerChromeBookmarkSyncListeners()
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

  scheduleChromeBookmarkImport()
  scheduleMemoryEnrichmentBackfill()
}

function scheduleChromeBookmarkImport(): void {
  setTimeout(() => {
    void ensureChromeBookmarksImported().catch(error => {
      logger.error('Background', 'Chrome 书签导入失败（下次启动将重试）', error)
    })
  }, CHROME_BOOKMARK_IMPORT_START_DELAY_MS)
}

function scheduleMemoryEnrichmentBackfill(): void {
  setTimeout(() => {
    void ensureMemoryEnrichmentBackfilled().catch(error => {
      logger.error('Background', '存量 enrichment 回填失败（下次启动将重试）', error)
    })
  }, MEMORY_ENRICHMENT_BACKFILL_START_DELAY_MS)
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
