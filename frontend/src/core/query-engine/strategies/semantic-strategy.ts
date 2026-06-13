/**
 * 语义搜索策略
 *
 * 使用本地 ONNX embedding 模型实现语义相似度搜索，完全离线，无服务器依赖。
 * 流程：查询文本 → 本地 embedding → 余弦相似度计算 → 书签 ID 列表 → IndexedDB 补全
 *
 * 降级策略：
 * - 向量库为空 → 返回空数组（上层会降级到 FlexSearch）
 * - Provider 不可用 → 返回空数组
 *
 * 环境适配：
 * - 在 Service Worker 环境中，通过 Offscreen Document 代理语义搜索（避免 ONNX WASM 加载失败）
 * - 在普通页面环境中，直接使用 embeddingService
 */
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { embeddingService } from '@/infrastructure/embedding/embedding-service'
import { logger } from '@/infrastructure/logging/logger'
import { dispatchOffscreenRequest } from '@/infrastructure/offscreen/manager'

const LOG_TAG = 'SemanticStrategy'

export interface SemanticSearchResult {
  bookmark: BookmarkRecord
  score: number
}

function formatSemanticResults(results: SemanticSearchResult[]) {
  return results.map(result => ({
    id: result.bookmark.id,
    title: result.bookmark.title,
    url: result.bookmark.url,
    score: Number(result.score.toFixed(4))
  }))
}

/**
 * 检测是否在 Service Worker 环境
 */
function isServiceWorker(): boolean {
  return typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self
}

/**
 * 执行本地语义搜索
 * @param query 查询文本
 * @param topK 返回数量
 * @param minScore 最低相似度阈值（0-1），默认 0.2 过滤低相关性结果
 */
export interface SemanticSearchOptions {
  /** Offscreen / 模型冷启动超时（毫秒） */
  timeout?: number
}

export async function semanticSearch(
  query: string,
  topK = 10,
  minScore = 0.2,
  options: SemanticSearchOptions = {}
): Promise<SemanticSearchResult[]> {
  const timeout = options.timeout ?? (isServiceWorker() ? 30_000 : 10_000)
  const searchStart = performance.now()

  logger.info(LOG_TAG, '▶ 语义策略入口', {
    query,
    topK,
    minScore,
    timeout,
    environment: isServiceWorker() ? 'service-worker' : 'page'
  })

  try {
    // Service Worker 环境中，通过 Offscreen Document 代理语义搜索
    if (isServiceWorker()) {
      logger.debug(LOG_TAG, 'Service Worker 环境，通过 Offscreen Document 代理语义搜索')
      const offscreenResults = await dispatchOffscreenRequest<SemanticSearchResult[]>(
        {
          type: 'SEMANTIC_SEARCH',
          payload: { query, topK, minScore }
        },
        { timeout }
      )
      logger.info(LOG_TAG, `Offscreen 语义搜索完成: "${query}" → ${offscreenResults.length} 条`, {
        query,
        topK,
        minScore,
        results: formatSemanticResults(offscreenResults)
      })
      return offscreenResults
    }

    // 普通页面环境，直接使用 embeddingService
    logger.info(LOG_TAG, '开始本地语义搜索', { query, topK, minScore })
    const vectorResults = await embeddingService.search(query, topK, minScore)

    if (!vectorResults.length) {
      logger.info(LOG_TAG, `本地语义搜索无向量结果: "${query}"`, { query, topK, minScore })
      return []
    }

    logger.info(LOG_TAG, '本地语义向量命中', {
      query,
      results: vectorResults.map(result => ({
        bookmarkId: result.bookmarkId,
        title: result.title,
        url: result.url,
        score: Number(result.score.toFixed(4))
      }))
    })

    // 从 IndexedDB 补全书签详情
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const bookmarkMap = new Map<string, BookmarkRecord>()
    for (const bm of allBookmarks) {
      bookmarkMap.set(bm.id, bm)
    }

    const results: SemanticSearchResult[] = []
    for (const match of vectorResults) {
      const bm = bookmarkMap.get(match.bookmarkId)
      if (bm && bm.url) {
        results.push({ bookmark: bm, score: match.score })
      }
    }

    logger.info(LOG_TAG, `本地语义搜索完成: "${query}" → ${results.length} 条`, {
      query,
      topK,
      minScore,
      totalDurationMs: Number((performance.now() - searchStart).toFixed(1)),
      results: formatSemanticResults(results)
    })
    return results
  } catch (error) {
    logger.warn(LOG_TAG, '语义搜索异常', {
      query,
      topK,
      minScore,
      durationMs: Number((performance.now() - searchStart).toFixed(1)),
      error
    })
    return []
  }
}
