/**
 * 书签 Embedding 后台同步调度
 *
 * Pro + 语义检索开启时，在 Offscreen 中执行全量/增量 re-embed。
 * 登录、订阅状态或语义开关变化后需重新触发（不能仅依赖扩展启动时那一次）。
 */

import { AUTH_STORAGE_KEY } from '@/config/auth-sync-env'
import { SEMANTIC_SEARCH_STORAGE_KEY } from '@/core/ai/ai-feature-settings'
import {
  readSearchModeSnapshotFromStorage,
  SUBSCRIPTION_CACHE_KEY,
  shouldSyncBookmarkEmbeddings
} from '@/core/query/search-mode'
import { dispatchOffscreenRequest } from '@/background/managers/offscreen-manager'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingSync'

const WATCHED_STORAGE_KEYS = new Set([
  AUTH_STORAGE_KEY,
  SUBSCRIPTION_CACHE_KEY,
  SEMANTIC_SEARCH_STORAGE_KEY
])

let inflightSync: Promise<void> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined

async function ensureEmbeddingEngineReady(): Promise<boolean> {
  try {
    const health = await dispatchOffscreenRequest<{ ok: boolean; issues: string[] }>(
      { type: 'EMBEDDING_HEALTH_CHECK' },
      { timeout: 120_000 }
    )
    if (!health.ok) {
      logger.error(LOG_TAG, 'Embedding 资源不完整，跳过向量同步', { issues: health.issues })
      return false
    }
    return true
  } catch (error) {
    logger.error(LOG_TAG, 'Embedding 健康检查失败', error)
    return false
  }
}

/**
 * 执行书签向量同步（幂等，并发去重）
 */
export async function runBookmarkEmbeddingSync(reason = 'manual'): Promise<void> {
  if (inflightSync) {
    logger.debug(LOG_TAG, '同步已在进行中，复用现有任务', { reason })
    return inflightSync
  }

  inflightSync = (async () => {
    const snapshot = await readSearchModeSnapshotFromStorage()
    if (!(await shouldSyncBookmarkEmbeddings())) {
      logger.info(LOG_TAG, '跳过书签 embedding 同步', { reason, snapshot })
      return
    }

    const ready = await ensureEmbeddingEngineReady()
    if (!ready) {
      return
    }

    logger.info(LOG_TAG, '开始同步书签 embedding', { reason, snapshot })

    const result = await dispatchOffscreenRequest<{
      success: boolean
      message?: string
    }>({ type: 'SYNC_BOOKMARK_EMBEDDINGS' }, { timeout: 300_000 })

    if (result.success) {
      logger.info(LOG_TAG, '书签 embedding 同步完成', { reason })
    } else {
      logger.warn(LOG_TAG, '书签 embedding 同步未成功', { reason, message: result.message })
    }
  })()
    .catch(error => {
      logger.warn(LOG_TAG, '书签 embedding 同步异常', { reason, error })
    })
    .finally(() => {
      inflightSync = null
    })

  return inflightSync
}

/**
 * 防抖调度同步（避免登录 + 订阅缓存连续写入触发多次）
 */
export function scheduleBookmarkEmbeddingSync(reason: string, delayMs = 800): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined
    void runBookmarkEmbeddingSync(reason)
  }, delayMs)
}

/**
 * 监听登录态 / Pro / 语义开关变化，自动触发向量同步
 */
export function registerEmbeddingSyncTriggers(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return

    const matched = Object.keys(changes).some(key => WATCHED_STORAGE_KEYS.has(key))
    if (!matched) return

    scheduleBookmarkEmbeddingSync('storage-changed')
  })

  logger.debug(LOG_TAG, '已注册 embedding 同步触发器')
}
