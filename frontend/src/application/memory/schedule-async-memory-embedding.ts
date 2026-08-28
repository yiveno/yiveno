/**
 * Capture 成功后异步生成 embedding（登录 + AI 开）：Worker bge-m3 → 写本机 clues.embedding。
 * 不阻塞 Capture；串行队列；失败静默降级（关键词 Recall 仍可用）。
 * Free/Pro 均可（Worker 日配额分档）；未登录跳过。
 */

import {
  isIndexedDbQuotaExceededError,
  markIndexedDbWriteQuotaExhausted
} from '@/application/memory/indexeddb-write-quota'
import { findMemoryEmbeddingDonor } from '@/application/memory/find-memory-enrichment-donor'
import {
  clearMemoryDuplicateReuseCaches,
  getCachedEmbeddingReuse,
  setCachedEmbeddingReuse
} from '@/application/memory/memory-duplicate-reuse-cache'
import { buildEmbeddingTextFromMemoryItem } from '@/core/memory/build-embedding-text'
import { getEmbedReuseKey } from '@/core/memory/derive-memory-duplicate-key'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  requestWorkerEmbeddings,
  WORKER_EMBEDDING_MODEL
} from '@/infrastructure/ai/embed-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import {
  memoryItemRepository,
  type MemoryItemRepository
} from '@/infrastructure/indexeddb/memory-item-repository'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'

/** 任务间距，降低 SW / Worker 尖峰。 */
const EMBEDDING_JOB_GAP_MS = 500

/** 回填单次最多入队条数。 */
export const EMBEDDING_BACKFILL_BATCH_LIMIT = 40

/** 配额满时一次最多物理删掉的无附注 sync 书签数（腾出写 embedding 空间）。 */
const QUOTA_FREE_BOOKMARK_BATCH = 200

let queue: Promise<void> = Promise.resolve()
/** 递增后丢弃已入队任务（bulk/reconcile 防刷）。 */
let queueGeneration = 0
/** auth 失败后暂停入队，直至 clear / 显式恢复。 */
let authPaused = false
/** 本会话已因配额停止后续 embed 写库。 */
let quotaPaused = false

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function hasCurrentModelEmbedding(item: MemoryItem): boolean {
  const embedding = item.clues.embedding
  return (
    Array.isArray(embedding) &&
    embedding.length > 0 &&
    item.clues.embeddingModel === WORKER_EMBEDDING_MODEL
  )
}

function isAuthEmbedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message === 'invalid_token' ||
    message === 'unauthorized' ||
    message === 'http_401' ||
    message.includes('invalid_token')
  )
}

/**
 * 清空待执行的 embed 队列（已在飞的一条会跑完后停止后续）。
 * Chrome sync/reconcile 前调用，避免万级书签刷爆 Worker。
 */
export function clearAsyncMemoryEmbeddingQueue(reason = 'manual'): void {
  queueGeneration += 1
  queue = Promise.resolve()
  clearMemoryDuplicateReuseCaches()
  logger.info('MemoryEmbed', '异步 embed 队列已清空', {
    reason,
    generation: queueGeneration
  })
}

/** 恢复因 auth 失败暂停的入队（登录成功后可调）。 */
export function resumeAsyncMemoryEmbeddingAfterAuth(): void {
  if (!authPaused) {
    return
  }
  authPaused = false
  logger.info('MemoryEmbed', '异步 embed 已恢复入队（auth）')
}

/**
 * 物理删除无附注的 sync 书签，腾 IndexedDB 配额给摘录 embedding。
 * 书签仍在 Chrome；用户开着 ingest 时下次 reconcile 会再灌。
 */
async function freeQuotaByDroppingSyncBookmarks(
  repository: MemoryItemRepository,
  limit = QUOTA_FREE_BOOKMARK_BATCH
): Promise<number> {
  const bookmarks = await repository.listByOwner({ type: 'bookmark', limit: 500 })
  const victims = bookmarks
    .filter(item => {
      if (item.clues.note?.trim()) {
        return false
      }
      const entry = item.clues.captureEntry
      return entry === 'sync' || entry === undefined
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, limit)
  if (victims.length === 0) {
    return 0
  }
  const dropped = await repository.hardDeleteMany(victims.map(item => item.id))
  logger.warn('MemoryEmbed', '配额满：已物理删除无附注 sync 书签以腾空间', {
    dropped,
    candidate: victims.length
  })
  return dropped
}

async function putEmbeddingWithQuotaRetry(
  repository: MemoryItemRepository,
  nextItem: MemoryItem
): Promise<{ ok: true } | { ok: false; quota: boolean }> {
  try {
    await repository.putEnrichmentClues(nextItem)
    return { ok: true }
  } catch (error) {
    if (!isIndexedDbQuotaExceededError(error)) {
      throw error
    }
    markIndexedDbWriteQuotaExhausted('memory_embed_put')
    const dropped = await freeQuotaByDroppingSyncBookmarks(repository)
    if (dropped === 0) {
      quotaPaused = true
      clearAsyncMemoryEmbeddingQueue('quota_exceeded')
      return { ok: false, quota: true }
    }
    try {
      await repository.putEnrichmentClues(nextItem)
      return { ok: true }
    } catch (retryError) {
      if (isIndexedDbQuotaExceededError(retryError)) {
        quotaPaused = true
        clearAsyncMemoryEmbeddingQueue('quota_exceeded')
        return { ok: false, quota: true }
      }
      throw retryError
    }
  }
}

export type MemoryEmbedOutcome =
  | 'written' // 已写回
  | 'skipped' // 跳过（关 AI / 未登录 / 已有向量等）
  | 'failed' // API 或其它失败
  | 'quota' // IndexedDB 配额耗尽

/**
 * 对单条 MemoryItem 生成 embedding 并写回（不改 updatedAt）。
 */
export async function runAsyncMemoryEmbedding(
  itemId: string,
  repository: MemoryItemRepository = memoryItemRepository
): Promise<MemoryEmbedOutcome> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    logger.info('MemoryEmbed', '异步 embed 跳过：用户已关闭 AI', { itemId })
    return 'skipped'
  }

  if (quotaPaused) {
    logger.info('MemoryEmbed', '异步 embed 跳过：IndexedDB 配额已熔断', { itemId })
    return 'quota'
  }

  const accessToken = await getWorkerApiAccessToken()
  if (!accessToken) {
    logger.info('MemoryEmbed', '异步 embed 跳过：未登录', { itemId })
    return 'skipped'
  }

  const item = await repository.getById(itemId)
  if (!item) {
    logger.info('MemoryEmbed', '异步 embed 跳过：条目不存在', { itemId })
    return 'skipped'
  }

  if (hasCurrentModelEmbedding(item)) {
    logger.info('MemoryEmbed', '异步 embed 跳过：已有当前模型向量', { itemId })
    return 'skipped'
  }

  const reuseKey = getEmbedReuseKey(item)
  if (reuseKey) {
    let vectorSource = getCachedEmbeddingReuse(reuseKey)
    let reuseSource: 'cache' | 'donor' | null = vectorSource ? 'cache' : null

    if (!vectorSource) {
      const donor = await findMemoryEmbeddingDonor(item, repository, hasCurrentModelEmbedding)
      const donorEmbedding = donor?.clues.embedding
      if (
        donor &&
        Array.isArray(donorEmbedding) &&
        donorEmbedding.length > 0 &&
        donor.clues.embeddingModel === WORKER_EMBEDDING_MODEL
      ) {
        vectorSource = {
          embedding: [...donorEmbedding],
          embeddingModel: donor.clues.embeddingModel,
          embeddingDim: donor.clues.embeddingDim ?? donorEmbedding.length
        }
        reuseSource = 'donor'
      }
    }

    if (vectorSource && reuseSource) {
      const nextItem: MemoryItem = {
        ...item,
        clues: {
          ...item.clues,
          embedding: [...vectorSource.embedding],
          embeddingModel: vectorSource.embeddingModel,
          embeddingDim: vectorSource.embeddingDim || vectorSource.embedding.length
        }
      }
      const putResult = await putEmbeddingWithQuotaRetry(repository, nextItem)
      if (!putResult.ok) {
        logger.warn('MemoryEmbed', '复用 embed 写回失败：IndexedDB 配额耗尽', { itemId })
        return 'quota'
      }
      setCachedEmbeddingReuse(reuseKey, vectorSource)
      logger.info('MemoryEmbed', '复用 embed 已写回（跳过 Worker）', {
        itemId,
        reuseKey,
        dim: vectorSource.embedding.length,
        reuseSource
      })
      return 'written'
    }
  }

  const text = buildEmbeddingTextFromMemoryItem(item)
  if (!text.trim()) {
    logger.info('MemoryEmbed', '异步 embed 跳过：无可嵌入文本', { itemId })
    return 'skipped'
  }

  logger.info('MemoryEmbed', '异步 embed 开始', { itemId, type: item.type })

  try {
    const result = await requestWorkerEmbeddings(accessToken, [text])
    const vector = result.embeddings[0]
    if (!vector || vector.length === 0) {
      throw new Error('empty_embedding')
    }

    const nextItem: MemoryItem = {
      ...item,
      clues: {
        ...item.clues,
        embedding: vector,
        embeddingModel: result.model || WORKER_EMBEDDING_MODEL,
        embeddingDim: result.dim || vector.length
      }
      // 不改 updatedAt：embedding ≠ 用户内容变更
    }
    const putResult = await putEmbeddingWithQuotaRetry(repository, nextItem)
    if (!putResult.ok) {
      logger.warn('MemoryEmbed', '异步 embed 写回失败：IndexedDB 配额耗尽', { itemId })
      return 'quota'
    }

    logger.info('MemoryEmbed', '异步 embed 已写回', {
      itemId,
      dim: vector.length,
      model: nextItem.clues.embeddingModel
    })
    if (reuseKey) {
      setCachedEmbeddingReuse(reuseKey, {
        embedding: vector,
        embeddingModel: nextItem.clues.embeddingModel ?? WORKER_EMBEDDING_MODEL,
        embeddingDim: nextItem.clues.embeddingDim ?? vector.length
      })
    }
    return 'written'
  } catch (error) {
    if (isAuthEmbedError(error)) {
      authPaused = true
      clearAsyncMemoryEmbeddingQueue('invalid_token')
      logger.warn('MemoryEmbed', '异步 embed 因 auth 失败熔断并清空队列', {
        itemId,
        error: error instanceof Error ? error.message : String(error)
      })
      return 'failed'
    }
    logger.warn('MemoryEmbed', '异步 embed 失败', {
      itemId,
      error: error instanceof Error ? error.message : String(error)
    })
    return 'failed'
  }
}

/**
 * Fire-and-forget：Capture 返回后入队。
 */
export function scheduleAsyncMemoryEmbedding(itemId: string): void {
  const id = itemId.trim()
  if (!id) {
    return
  }
  if (authPaused) {
    logger.info('MemoryEmbed', '异步 embed 跳过入队：auth 已熔断', { itemId: id })
    return
  }
  if (quotaPaused) {
    logger.info('MemoryEmbed', '异步 embed 跳过入队：配额已熔断', { itemId: id })
    return
  }

  const scheduledGeneration = queueGeneration
  queue = queue
    .then(async () => {
      if (scheduledGeneration !== queueGeneration) {
        return
      }
      await runAsyncMemoryEmbedding(id)
      await sleep(EMBEDDING_JOB_GAP_MS)
    })
    .catch(error => {
      logger.warn('MemoryEmbed', '异步队列任务异常', {
        itemId: id,
        error: error instanceof Error ? error.message : String(error)
      })
    })
}

/**
 * 选出待回填条目：摘录优先，再用书签补满 limit。
 * 全量按 updatedAt 扫会被海量书签挤掉 excerpt。
 */
async function collectMissingEmbeddingItems(
  repository: MemoryItemRepository,
  limit: number
): Promise<{ missing: MemoryItem[]; scanned: number; excerptEnqueued: number }> {
  const excerptCandidates = await repository.listByOwner({
    type: 'text_excerpt',
    limit
  })
  const excerptMissing = excerptCandidates.filter(item => !hasCurrentModelEmbedding(item))
  const remaining = Math.max(0, limit - excerptMissing.length)
  let otherMissing: MemoryItem[] = []
  if (remaining > 0) {
    const items = await repository.listByOwner({ limit: 500 })
    otherMissing = items
      .filter(item => item.type !== 'text_excerpt' && !hasCurrentModelEmbedding(item))
      .slice(0, remaining)
  }
  return {
    missing: [...excerptMissing, ...otherMissing],
    scanned: excerptCandidates.length + (remaining > 0 ? 500 : 0),
    excerptEnqueued: excerptMissing.length
  }
}

/**
 * 回填：扫描缺 embedding 的条目并入队（限量；须登录）。
 * 供 bootstrap / auth handoff：fire-and-forget。
 * 注意：书签 sync finalize 会 clearAsyncMemoryEmbeddingQueue，可能丢弃未跑完的队列任务；
 * Settings「Rebuild」须走 {@link backfillMissingMemoryEmbeddings}（同步 await）。
 */
export async function enqueueMissingMemoryEmbeddings(
  repository: MemoryItemRepository = memoryItemRepository,
  limit = EMBEDDING_BACKFILL_BATCH_LIMIT
): Promise<{ enqueued: number; scanned: number }> {
  const session = await getAuthSession()
  if (!session?.accessToken) {
    return { enqueued: 0, scanned: 0 }
  }
  resumeAsyncMemoryEmbeddingAfterAuth()

  const { missing, scanned, excerptEnqueued } = await collectMissingEmbeddingItems(
    repository,
    limit
  )
  for (const item of missing) {
    scheduleAsyncMemoryEmbedding(item.id)
  }
  logger.info('MemoryEmbed', '回填入队', {
    scanned,
    enqueued: missing.length,
    excerptEnqueued
  })
  return { enqueued: missing.length, scanned }
}

export type MemoryEmbedBackfillResult = {
  attempted: number
  written: number
  failed: number
  scanned: number
  /** 任一条因 IDB 配额失败 */
  quotaHit: boolean
}

/**
 * Settings / 内部消息：同步写回 embedding（不经 fire-and-forget 队列）。
 * 避免被 chrome_bookmark_sync_finalize 的 clearAsyncMemoryEmbeddingQueue 清掉。
 * 默认只回填摘录（核心资产）；书签仍可由无感维护异步入队。
 * 用户面已无 Rebuild 按钮；由 {@link scheduleSilentMemoryEmbeddingMaintenance} 调用。
 * 失败不抛，计入 failed。
 */
export async function backfillMissingMemoryEmbeddings(
  repository: MemoryItemRepository = memoryItemRepository,
  limit = EMBEDDING_BACKFILL_BATCH_LIMIT
): Promise<MemoryEmbedBackfillResult> {
  const accessToken = await getWorkerApiAccessToken()
  if (!accessToken) {
    return { attempted: 0, written: 0, failed: 0, scanned: 0, quotaHit: false }
  }
  resumeAsyncMemoryEmbeddingAfterAuth()
  // Rebuild 主动重试：用户可能已腾磁盘
  quotaPaused = false

  // Rebuild 只盯摘录：快、且不被海量书签拖死；书签不阻塞用户点 Rebuild
  const excerptCandidates = await repository.listByOwner({
    type: 'text_excerpt',
    limit
  })
  const missing = excerptCandidates.filter(item => !hasCurrentModelEmbedding(item))
  const scanned = excerptCandidates.length
  let written = 0
  let failed = 0
  let quotaHit = false
  logger.info('MemoryEmbed', '同步回填开始（摘录）', {
    scanned,
    attempted: missing.length
  })
  for (const item of missing) {
    const outcome = await runAsyncMemoryEmbedding(item.id, repository)
    if (outcome === 'written') {
      written += 1
    } else if (outcome === 'failed') {
      failed += 1
    } else if (outcome === 'quota') {
      failed += 1
      quotaHit = true
      // 配额熔断后继续扫只会空转
      break
    }
    await sleep(EMBEDDING_JOB_GAP_MS)
  }
  logger.info('MemoryEmbed', '同步回填结束', {
    attempted: missing.length,
    written,
    failed,
    quotaHit
  })
  return { attempted: missing.length, written, failed, scanned, quotaHit }
}
