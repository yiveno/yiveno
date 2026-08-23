/**
 * Capture 成功后异步生成 embedding（登录 + AI 开）：Worker bge-m3 → 写本机 clues.embedding。
 * 不阻塞 Capture；串行队列；失败静默降级（关键词 Recall 仍可用）。
 * Free/Pro 均可（Worker 日配额分档）；未登录跳过。
 */

import { buildEmbeddingTextFromMemoryItem } from '@/core/memory/build-embedding-text'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  requestWorkerEmbeddings,
  WORKER_EMBEDDING_MODEL
} from '@/infrastructure/ai/embed-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
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

let queue: Promise<void> = Promise.resolve()
/** 递增后丢弃已入队任务（bulk/reconcile 防刷）。 */
let queueGeneration = 0
/** auth 失败后暂停入队，直至 clear / 显式恢复。 */
let authPaused = false

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
 * 对单条 MemoryItem 生成 embedding 并写回（不改 updatedAt）。
 */
export async function runAsyncMemoryEmbedding(
  itemId: string,
  repository: MemoryItemRepository = memoryItemRepository
): Promise<'written' | 'skipped' | 'failed'> {
  const settings = await getUserSettings()
  if (!settings.aiFeaturesEnabled) {
    logger.info('MemoryEmbed', '异步 embed 跳过：用户已关闭 AI', { itemId })
    return 'skipped'
  }

  const session = await getAuthSession()
  if (!session?.accessToken) {
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

  const text = buildEmbeddingTextFromMemoryItem(item)
  if (!text.trim()) {
    logger.info('MemoryEmbed', '异步 embed 跳过：无可嵌入文本', { itemId })
    return 'skipped'
  }

  logger.info('MemoryEmbed', '异步 embed 开始', { itemId, type: item.type })

  try {
    const result = await requestWorkerEmbeddings(session.accessToken, [text])
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
    await repository.putEnrichmentClues(nextItem)

    logger.info('MemoryEmbed', '异步 embed 已写回', {
      itemId,
      dim: vector.length,
      model: nextItem.clues.embeddingModel
    })
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
 * 回填：扫描缺 embedding 的条目并入队（限量；须登录，由 Worker 日配额约束）。
 * @returns 入队条数
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

  const items = await repository.listByOwner({ limit: 500 })
  const missing = items.filter(item => !hasCurrentModelEmbedding(item)).slice(0, limit)
  for (const item of missing) {
    scheduleAsyncMemoryEmbedding(item.id)
  }
  logger.info('MemoryEmbed', '回填入队', {
    scanned: items.length,
    enqueued: missing.length
  })
  return { enqueued: missing.length, scanned: items.length }
}
