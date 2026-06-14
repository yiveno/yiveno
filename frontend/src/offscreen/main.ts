/// <reference lib="webworker" />

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import type { WorkerDoc } from '@/types/domain/query'
import { formatBookmarkSearchKeywordsText } from '@/core/bookmark/bookmark-search-keywords'

interface SearchState {
  worker: Worker | undefined
  ready: boolean
  initializing: boolean
  primed: boolean
  docCount: number
}

const searchState: SearchState = {
  worker: undefined,
  ready: false,
  initializing: false,
  primed: false,
  docCount: 0
}

interface OffscreenFolderRecommendation {
  folderId: string
  folderName: string
  folderPath: string
  score: number
  bookmarkCount: number
  reason: string
}

/**
 * 等待 Worker 就绪
 *
 * 使用事件机制监听 Worker 状态，避免固定轮询间隔
 *
 * @param timeout 超时时间（毫秒）
 */
async function waitForWorkerReady(timeout = 3000): Promise<void> {
  // 已就绪，立即返回
  if (searchState.ready && searchState.worker) {
    return
  }

  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null
    let intervalTimer: ReturnType<typeof setInterval> | null = null
    let messageHandler: ((event: MessageEvent) => void) | null = null

    // 清理所有资源
    const cleanup = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      if (intervalTimer) {
        clearInterval(intervalTimer)
        intervalTimer = null
      }
      if (messageHandler && searchState.worker) {
        searchState.worker.removeEventListener('message', messageHandler)
        messageHandler = null
      }
    }

    // 检查就绪状态
    const checkReady = () => {
      if (searchState.ready && searchState.worker) {
        cleanup()
        resolve()
        return true
      }

      // 检查超时
      if (Date.now() - startTime > timeout) {
        cleanup()
        reject(new Error('等待查询 Worker 超时'))
        return true
      }

      return false
    }

    // 立即检查
    if (checkReady()) {
      return
    }

    // 设置超时
    timeoutTimer = setTimeout(() => {
      if (!checkReady()) {
        cleanup()
        reject(new Error('等待查询 Worker 超时'))
      }
    }, timeout)

    // 监听 Worker 消息事件
    if (searchState.worker) {
      messageHandler = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'ready' || message?.type === 'inited') {
          checkReady()
        }
      }

      searchState.worker.addEventListener('message', messageHandler)

      // 定期检查（降级方案）
      intervalTimer = setInterval(() => {
        checkReady()
      }, 200)
    } else {
      // Worker 不存在，使用轮询
      intervalTimer = setInterval(() => {
        checkReady()
      }, 200)
    }
  })
}

/**
 * 确保查询 Worker 已就绪
 *
 * 若未创建则启动并等待 ready 事件
 */
async function ensureSearchWorker(): Promise<Worker> {
  if (searchState.ready && searchState.worker) {
    return searchState.worker
  }

  if (searchState.initializing) {
    // 等待 Worker 就绪
    await waitForWorkerReady(3000)
    if (!searchState.worker) {
      throw new Error('查询 Worker 初始化失败')
    }
    return searchState.worker
  }

  searchState.initializing = true
  try {
    const worker = new Worker(new URL('@/workers/query-worker.ts', import.meta.url), {
      type: 'module'
    })

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('查询 Worker 启动超时'))
      }, 5000)

      const handleReady = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'ready' || message?.type === 'inited') {
          clearTimeout(timer)
          worker.removeEventListener('message', handleReady)
          resolve()
        }
      }

      worker.addEventListener('message', handleReady)
      worker.onerror = error => {
        clearTimeout(timer)
        worker.removeEventListener('message', handleReady)
        reject(error)
      }
    })

    // eslint-disable-next-line require-atomic-updates -- Worker 初始化是原子操作，不会有竞态条件
    searchState.worker = worker
    // eslint-disable-next-line require-atomic-updates -- Worker 初始化是原子操作，不会有竞态条件
    searchState.ready = true
    return worker
  } catch (error) {
    logger.error('OffscreenSearch', '创建查询 Worker 失败', error)
    searchState.worker = undefined
    searchState.ready = false
    throw error
  } finally {
    // eslint-disable-next-line require-atomic-updates -- finally 块中的状态重置是安全的
    searchState.initializing = false
  }
}

/**
 * 处理搜索初始化请求
 */
async function handleSearchInit(payload: { docs?: WorkerDoc[] } | undefined) {
  const worker = await ensureSearchWorker()
  await primeWorkerDocs(worker, payload?.docs)
  return { ok: true }
}

/**
 * 处理搜索查询请求
 *
 * 优先使用 Worker 查询，失败时降级到 IndexedDB 直接查询
 */
async function handleSearchQuery(payload: { query: string; limit?: number }) {
  const query = payload?.query?.trim()
  if (!query) return []

  const searchStart = performance.now()
  logger.info('OffscreenSearch', '▶ FlexSearch 查询入口', {
    query,
    limit: payload?.limit ?? 50
  })

  try {
    const worker = await ensureSearchWorker()
    await primeWorkerDocs(worker)

    return await new Promise<SearchResult[]>((resolve, reject) => {
      const reqId = Date.now()
      const timer = setTimeout(() => {
        reject(new Error('Offscreen Worker 查询超时'))
      }, 5000)

      const cleanup = () => {
        clearTimeout(timer)
        worker.removeEventListener('message', listener as EventListener)
      }

      const listener = (event: MessageEvent) => {
        const message = event.data
        if (message?.type === 'result' && message.reqId === reqId) {
          cleanup()
          const hits = message.hits ?? []
          logger.info('OffscreenSearch', '✅ FlexSearch 查询完成', {
            query,
            hitCount: hits.length,
            durationMs: Number((performance.now() - searchStart).toFixed(1)),
            topHits: hits.slice(0, 8).map((h: { id: string; score: number }) => ({
              id: h.id,
              score: Number(h.score.toFixed(4))
            }))
          })
          resolve(hits)
        } else if (message?.type === 'error' && message.reqId === reqId) {
          cleanup()
          reject(new Error(message.message ?? 'Worker 查询失败'))
        }
      }

      worker.addEventListener('message', listener as EventListener)

      worker.postMessage({
        type: 'query',
        q: query,
        reqId,
        limit: payload?.limit ?? 50
      })
    })
  } catch (error) {
    logger.warn('OffscreenSearch', 'Worker 不可用，回退到 IndexedDB 查询', {
      query,
      error,
      durationMs: Number((performance.now() - searchStart).toFixed(1))
    })
    const fallback = await indexedDBManager.searchBookmarks(query, {
      query,
      limit: payload?.limit ?? 50,
      includeDomain: true,
      includeKeywords: true,
      includeTags: true,
      includeUrl: true
    })
    logger.info('OffscreenSearch', 'IndexedDB 兜底查询完成', {
      query,
      hitCount: fallback.length,
      topHits: fallback.slice(0, 8).map(r => ({
        id: r.id,
        title: r.bookmark.title,
        score: Number(r.score.toFixed(4))
      }))
    })
    return fallback
  }
}

function dotProduct(left: number[], right: number[]): number {
  if (left.length !== right.length) {
    return 0
  }

  let sum = 0
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index]
    const rightValue = right[index]

    if (leftValue === undefined || rightValue === undefined) {
      return 0
    }

    sum += leftValue * rightValue
  }

  return sum
}

function buildFolderRecommendationReason(bookmarkCount: number, score: number): string {
  if (score >= 0.8) {
    return bookmarkCount > 0 ? '高匹配度推荐' : '基于文件夹名称的高匹配推荐'
  }

  if (score >= 0.6) {
    return bookmarkCount > 0 ? '相似内容较多' : '与文件夹主题较接近'
  }

  return bookmarkCount > 0 ? '可作为候选目录' : '基于文件夹名称的候选推荐'
}

/**
 * 计算文件夹名称相似度
 */
function calculateNameSimilarity(bookmarkTitle: string, folderName: string): number {
  const bookmarkLower = bookmarkTitle.toLowerCase()
  const folderLower = folderName.toLowerCase()

  // 完全匹配
  if (bookmarkLower.includes(folderLower) || folderLower.includes(bookmarkLower)) {
    return 0.8
  }

  // 部分匹配（包含关键词）
  const folderWords = folderLower.split(/\s+/)
  const bookmarkWords = bookmarkLower.split(/\s+/)
  let matchCount = 0

  for (const folderWord of folderWords) {
    if (bookmarkWords.some(bw => bw.includes(folderWord) || folderWord.includes(bw))) {
      matchCount++
    }
  }

  if (matchCount > 0) {
    return (matchCount / folderWords.length) * 0.6
  }

  return 0
}

async function handleFolderRecommendations(payload: {
  title: string
  url: string
  topK?: number
  minScore?: number
}): Promise<OffscreenFolderRecommendation[]> {
  const title = payload.title?.trim()
  const url = payload.url?.trim()

  if (!title || !url) {
    logger.warn('OffscreenFolderRecommendation', '参数无效', { title, url })
    return []
  }

  try {
    logger.info('OffscreenFolderRecommendation', '开始文件夹推荐', {
      title,
      url
    })

    const { onnxEmbeddingProvider } =
      await import('@/infrastructure/embedding/onnx-embedding-provider')
    const { formatEmbeddingPassage } = await import('@/infrastructure/embedding/embedding-text')
    const { folderVectorStore } = await import('@/infrastructure/folder-vector/folder-vector-store')

    logger.info('OffscreenFolderRecommendation', '生成书签向量...')
    const bookmarkVector = await onnxEmbeddingProvider.embedPassage(
      formatEmbeddingPassage(`${title} | ${url}`)
    )
    logger.info('OffscreenFolderRecommendation', '书签向量生成完成', {
      dimension: bookmarkVector.length
    })

    logger.info('OffscreenFolderRecommendation', '获取文件夹向量...')
    const folderVectors = await folderVectorStore.getAll()
    logger.info('OffscreenFolderRecommendation', '文件夹向量获取完成', {
      count: folderVectors.length
    })

    if (folderVectors.length === 0) {
      logger.info('OffscreenFolderRecommendation', '文件夹向量库为空，跳过推荐')
      return []
    }

    const minScore = payload.minScore ?? 0.1 // 使用正常的阈值
    const topK = payload.topK ?? 3

    const scoredFolders = folderVectors.map(folder => {
      // 1. 语义相似度（向量点积）
      const semanticScore = dotProduct(bookmarkVector, folder.vector)

      // 2. 文件夹名称匹配（字符串相似度）
      const nameScore = calculateNameSimilarity(title, folder.folderName)

      // 3. 域名匹配（如果文件夹下有相同域名的书签）
      // TODO: 实现域名匹配逻辑
      const domainScore = 0

      // 4. 综合评分（加权平均）
      // 语义相似度权重最高，域名匹配次之，名称匹配再次
      const combinedScore = semanticScore * 0.6 + domainScore * 0.3 + nameScore * 0.1

      return {
        folderId: folder.folderId,
        folderName: folder.folderName,
        folderPath: folder.folderPath,
        bookmarkCount: folder.bookmarkCount,
        score: combinedScore,
        semanticScore,
        nameScore,
        domainScore,
        reason: buildFolderRecommendationReason(folder.bookmarkCount, combinedScore)
      }
    })

    // 调试：显示所有文件夹的相似度（包括被过滤掉的）
    logger.info('OffscreenFolderRecommendation', '所有文件夹相似度', {
      minScore,
      folders: scoredFolders.map(f => ({
        folderId: f.folderId,
        folder: f.folderPath,
        score: f.score.toFixed(4),
        semanticScore: f.semanticScore.toFixed(4),
        nameScore: f.nameScore.toFixed(4),
        domainScore: f.domainScore.toFixed(4),
        passed: f.score >= minScore,
        bookmarkCount: f.bookmarkCount
      }))
    })

    const recommendations = scoredFolders
      .filter(folder => {
        // 过滤掉根文件夹（Chrome 不允许向根文件夹添加书签）
        // 根文件夹通常 ID 为 "0" 或 "1"，且路径为 "书签栏" 或 "其他书签"
        const isRootFolder = folder.folderId === '0' || folder.folderId === '1'
        if (isRootFolder) {
          logger.debug('OffscreenFolderRecommendation', '跳过根文件夹', {
            folderId: folder.folderId,
            folderPath: folder.folderPath
          })
          return false
        }
        return folder.score >= minScore
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, topK)
      .map(r => ({
        folderId: r.folderId,
        folderName: r.folderName,
        folderPath: r.folderPath,
        bookmarkCount: r.bookmarkCount,
        score: r.score,
        reason: r.reason
      }))

    logger.info('OffscreenFolderRecommendation', '推荐完成', {
      total: recommendations.length,
      recommendations: recommendations.map(r => ({
        folder: r.folderPath,
        score: r.score.toFixed(3)
      }))
    })

    return recommendations
  } catch (error) {
    logger.error('OffscreenFolderRecommendation', '文件夹推荐失败', error)
    return []
  }
}

/**
 * Offscreen 任务处理函数类型
 */
type OffscreenHandler = (payload: unknown) => Promise<unknown>

/**
 * Offscreen 任务处理器映射
 */
const handlers: Record<string, OffscreenHandler> = {
  PING: async () => {
    // 简单的 ping 响应，用于验证 Offscreen Document 已就绪
    return { ok: true }
  },
  PARSE_HTML: async payload => {
    const { parseHtml } = await import('./tasks/parser')
    const data = payload as { html?: string }
    return parseHtml(data?.html ?? '')
  },
  SEARCH_INIT: payload => handleSearchInit(payload as { docs?: WorkerDoc[] } | undefined),
  SEARCH_QUERY: async payload => handleSearchQuery(payload as { query: string; limit?: number }),

  // Embedding 任务：在 Offscreen Document 里运行 ONNX，绕过扩展页面的 CSP 限制
  EMBEDDING_EMBED: async payload => {
    const { onnxEmbeddingProvider } =
      await import('@/infrastructure/embedding/onnx-embedding-provider')
    const data = payload as { text: string; mode?: 'query' | 'passage' }
    if (data.mode === 'query') {
      return onnxEmbeddingProvider.embedQuery(data.text)
    }
    return onnxEmbeddingProvider.embedPassage(data.text)
  },
  EMBEDDING_EMBED_BATCH: async payload => {
    const { onnxEmbeddingProvider } =
      await import('@/infrastructure/embedding/onnx-embedding-provider')
    const data = payload as { texts: string[] }
    return onnxEmbeddingProvider.embedPassageBatch(data.texts)
  },
  EMBEDDING_IS_AVAILABLE: async () => {
    const { onnxEmbeddingProvider } =
      await import('@/infrastructure/embedding/onnx-embedding-provider')
    return onnxEmbeddingProvider.isAvailable()
  },
  EMBEDDING_HEALTH_CHECK: async () => {
    const { verifyEmbeddingBundleHealth } =
      await import('@/infrastructure/embedding/embedding-bundle-health')
    return verifyEmbeddingBundleHealth()
  },
  EMBEDDING_WARMUP: async () => {
    const { warmupEmbeddingEngine } =
      await import('@/infrastructure/embedding/embedding-bundle-health')
    return warmupEmbeddingEngine()
  },

  // 语义搜索：在 Offscreen 里完成 embed + 向量相似度计算 + IndexedDB 补全，供 background/omnibox 调用
  SEMANTIC_SEARCH: async payload => {
    const { onnxEmbeddingProvider } =
      await import('@/infrastructure/embedding/onnx-embedding-provider')
    const { localVectorStore } = await import('@/infrastructure/embedding/local-vector-store')
    const { areEmbeddingVectorsReady } =
      await import('@/infrastructure/embedding/embedding-migration')
    const data = payload as { query: string; topK?: number; minScore?: number }
    const searchStart = performance.now()

    logger.info('OffscreenSemantic', '▶ 语义搜索入口', {
      query: data.query,
      topK: data.topK ?? 10,
      minScore: data.minScore ?? 0.2
    })

    if (!(await areEmbeddingVectorsReady())) {
      logger.info('OffscreenSemantic', '向量未就绪（空库或旧模型），跳过语义搜索', {
        query: data.query
      })
      return []
    }

    const embedStart = performance.now()
    const queryVector = await onnxEmbeddingProvider.embedQuery(data.query.trim())
    const embedDuration = performance.now() - embedStart

    const vectorStart = performance.now()
    const vectorResults = await localVectorStore.search(
      queryVector,
      data.topK ?? 10,
      data.minScore ?? 0.2
    )
    const vectorDuration = performance.now() - vectorStart

    logger.info('OffscreenSemantic', '语义向量命中明细', {
      query: data.query,
      topK: data.topK ?? 10,
      minScore: data.minScore ?? 0.2,
      vectorDim: queryVector.length,
      embedDurationMs: Number(embedDuration.toFixed(1)),
      vectorSearchDurationMs: Number(vectorDuration.toFixed(1)),
      hitCount: vectorResults.length,
      results: vectorResults.map(result => ({
        bookmarkId: result.bookmarkId,
        title: result.title,
        url: result.url,
        score: Number(result.score.toFixed(4))
      }))
    })

    if (!vectorResults.length) return []

    // 从 IndexedDB 补全书签详情
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const bookmarkMap = new Map<string, BookmarkRecord>()
    for (const bm of allBookmarks) {
      bookmarkMap.set(bm.id, bm)
    }

    const results: Array<{ bookmark: BookmarkRecord; score: number }> = []
    const missingIds: string[] = []
    for (const match of vectorResults) {
      const bm = bookmarkMap.get(match.bookmarkId)
      if (bm && bm.url) {
        results.push({ bookmark: bm, score: match.score })
      } else {
        missingIds.push(match.bookmarkId)
      }
    }

    logger.info('OffscreenSemantic', '✅ 语义搜索完成', {
      query: data.query,
      vectorHitCount: vectorResults.length,
      resolvedCount: results.length,
      missingBookmarkIds: missingIds,
      totalDurationMs: Number((performance.now() - searchStart).toFixed(1)),
      results: results.map(result => ({
        id: result.bookmark.id,
        title: result.bookmark.title,
        url: result.bookmark.url,
        score: Number(result.score.toFixed(4))
      }))
    })
    return results
  },

  // 同步书签 embedding：在 Offscreen 里执行完整的 embedding 同步流程
  SYNC_BOOKMARK_EMBEDDINGS: async () => {
    const { embeddingService } = await import('@/infrastructure/embedding/embedding-service')
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    await embeddingService.syncBookmarks(allBookmarks, progress => {
      const pct = Math.round((progress.processed / progress.total) * 100)
      console.log(`[Offscreen] Embedding 进度: ${progress.processed}/${progress.total} (${pct}%)`)
    })
    return { success: true }
  },

  // 文件夹推荐：在 Offscreen 里完成向量计算和推荐
  GET_FOLDER_RECOMMENDATIONS: async payload => {
    const data = payload as {
      title: string
      url: string
      topK?: number
      minScore?: number
    }
    return handleFolderRecommendations(data)
  },

  // 同步文件夹向量：在 Offscreen 里加载 ONNX 模型生成文件夹向量
  // 避免在 Service Worker 中加载 WASM 导致失败
  SYNC_FOLDER_VECTORS: async () => {
    const { folderVectorService } = await import('@/application/folder/folder-vector-service')
    await indexedDBManager.initialize()
    await folderVectorService.syncFolderVectors()
    return { success: true }
  }
}

/**
 * 监听来自 Background Script 的消息
 *
 * Offscreen Document 通过消息机制接收任务请求
 */

// 立即输出日志，确认 Offscreen Document 已加载
logger.info('OffscreenDocument', '🚀 Offscreen Document 已加载，开始监听消息')
console.log('🚀 [Offscreen] Offscreen Document 已加载')

void (async () => {
  try {
    const { warmupEmbeddingEngine } =
      await import('@/infrastructure/embedding/embedding-bundle-health')
    const health = await warmupEmbeddingEngine()
    if (!health.ok) {
      logger.error('OffscreenDocument', 'Embedding 引擎预热失败', { issues: health.issues })
    }
  } catch (error) {
    logger.error('OffscreenDocument', 'Embedding 引擎预热异常', error)
  }
})()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return false
  logger.info('OffscreenDocument', '📨 收到消息', {
    hasOffscreenFlag: !!message?.__offscreenRequest__,
    type: message?.type,
    messageKeys: message ? Object.keys(message) : []
  })

  if (!message || !message.__offscreenRequest__) {
    logger.debug('OffscreenDocument', '⚠️ 消息不是 Offscreen 请求，忽略')
    return false
  }

  const handler = handlers[message.type]

  logger.info('OffscreenDocument', `🔄 处理 Offscreen 任务: ${message.type}`, {
    hasHandler: !!handler,
    availableHandlers: Object.keys(handlers)
  })
  ;(async () => {
    try {
      if (!handler) {
        const error = `Unsupported task: ${message.type}`
        logger.error('OffscreenDocument', `❌ ${error}`)
        sendResponse({ ok: false, error })
        return
      }
      logger.info('OffscreenDocument', `⚙️ 执行任务: ${message.type}`)
      const result = await handler(message.payload)
      logger.info('OffscreenDocument', `✅ 任务完成: ${message.type}`)
      sendResponse({ ok: true, result })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('OffscreenDocument', `❌ 任务失败: ${message.type}`, error)
      sendResponse({
        ok: false,
        error: errorMsg
      })
    }
  })()

  return true
})

/**
 * 初始化 Worker 文档索引
 *
 * 从 IndexedDB 加载书签数据并发送给 Worker 建立索引
 */
async function primeWorkerDocs(worker: Worker, docsFromPayload?: WorkerDoc[]) {
  if (searchState.primed && !docsFromPayload) {
    return
  }

  const docs = docsFromPayload ?? (await collectDocsFromIDB())
  worker.postMessage({ type: 'init', docs })
  // eslint-disable-next-line require-atomic-updates -- 文档索引初始化是原子操作，不会有竞态条件
  searchState.docCount = docs.length
  // eslint-disable-next-line require-atomic-updates -- 文档索引初始化是原子操作，不会有竞态条件
  searchState.primed = docs.length > 0
  logger.info('OffscreenSearch', `索引文档数量: ${searchState.docCount}`)
}

/**
 * 从 IndexedDB 收集文档数据
 *
 * 将书签数据转换为 Worker 所需的文档格式
 */
async function collectDocsFromIDB(): Promise<WorkerDoc[]> {
  await indexedDBManager.initialize()
  const bookmarks = await indexedDBManager.getAllBookmarks()
  return bookmarks
    .filter(record => !record.isFolder)
    .map(record => ({
      id: String(record.id),
      titleLower: record.titleLower,
      urlLower: record.urlLower,
      domain: record.domain,
      keywords: formatBookmarkSearchKeywordsText(record).split(/\s+/).filter(Boolean),
      isFolder: record.isFolder
    }))
}

export {}
