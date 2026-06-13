/**
 * 书签检索 Profile 后台同步调度
 *
 * Pro + 语义检索开启时，分批调用 LLM 生成检索描述，完成后触发 re-embed。
 */

import { runRetrievalProfileSyncBatch } from '@/application/ai/retrieval-profile-service'
import { scheduleBookmarkEmbeddingSync } from '@/background/managers/embedding-sync'
import { AUTH_STORAGE_KEY } from '@/config/auth-sync-env'
import { SEMANTIC_SEARCH_STORAGE_KEY } from '@/core/ai/ai-feature-settings'
import { SUBSCRIPTION_CACHE_KEY, shouldSyncBookmarkEmbeddings } from '@/core/query/search-mode'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'RetrievalProfileSync'

const WATCHED_STORAGE_KEYS = new Set([
  AUTH_STORAGE_KEY,
  SUBSCRIPTION_CACHE_KEY,
  SEMANTIC_SEARCH_STORAGE_KEY
])

let inflightSync: Promise<void> | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 执行检索 Profile 同步（幂等，并发去重）
 */
export async function runRetrievalProfileSync(reason = 'manual'): Promise<void> {
  if (inflightSync) {
    logger.debug(LOG_TAG, '同步已在进行中，复用现有任务', { reason })
    return inflightSync
  }

  inflightSync = (async () => {
    if (!(await shouldSyncBookmarkEmbeddings())) {
      logger.info(LOG_TAG, '跳过检索 Profile 同步', { reason })
      return
    }

    logger.info(LOG_TAG, '开始检索 Profile 同步', { reason })
    const result = await runRetrievalProfileSyncBatch()

    if (result.updatedIds.length > 0) {
      logger.info(LOG_TAG, '检索 Profile 已更新，调度 re-embed', {
        updatedCount: result.updatedIds.length
      })
      scheduleBookmarkEmbeddingSync('retrieval-profile-updated', 1200)
    }

    if (result.pendingRemaining > 0 && result.stoppedReason !== 'quota') {
      scheduleRetrievalProfileSync('backlog-continue', 5000)
    } else if (result.processed > 0 && result.updatedIds.length === 0) {
      scheduleRetrievalProfileSync('parse-retry', 8000)
    }
  })()
    .catch(error => {
      logger.warn(LOG_TAG, '检索 Profile 同步异常', { reason, error })
    })
    .finally(() => {
      inflightSync = null
    })

  return inflightSync
}

/**
 * 防抖调度检索 Profile 同步
 */
export function scheduleRetrievalProfileSync(reason: string, delayMs = 1200): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined
    void runRetrievalProfileSync(reason)
  }, delayMs)
}

/**
 * 监听登录态 / Pro / 语义开关变化
 */
export function registerRetrievalProfileSyncTriggers(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return

    const matched = Object.keys(changes).some(key => WATCHED_STORAGE_KEYS.has(key))
    if (!matched) return

    scheduleRetrievalProfileSync('storage-changed')
  })

  logger.debug(LOG_TAG, '已注册检索 Profile 同步触发器')
}

/**
 * Profile 同步完成后继续 embedding（首次安装等场景）
 */
export async function runRetrievalProfileThenEmbedding(reason: string): Promise<void> {
  await runRetrievalProfileSync(reason)
  scheduleBookmarkEmbeddingSync(`${reason}-after-profile`, 800)
}
