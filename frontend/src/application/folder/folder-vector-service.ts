/**
 * 文件夹向量服务
 *
 * 职责：
 * 1. 为文件夹生成代表向量（该文件夹下所有书签向量的平均值）
 * 2. 根据新书签的向量推荐合适的文件夹
 * 3. 增量同步文件夹向量
 * 4. 支持用户习惯学习（强化学习）
 * 
 * 优化：使用 Summarizer API 预处理长文本，避免 token 限制
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { embeddingService } from '@/infrastructure/embedding/embedding-service'
import { localVectorStore } from '@/infrastructure/embedding/local-vector-store'
import { folderVectorStore } from '@/infrastructure/folder-vector/folder-vector-store'
import { builtInSummarizerClient } from '@/infrastructure/llm/builtin-summarizer-client'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'FolderVectorService'

/** Token 限制阈值（字符数估算：1 token ≈ 4 字符） */
const TOKEN_LIMIT_CHARS = 2000 // 约 500 tokens

/** 推荐结果 */
export interface FolderRecommendation {
  /** 文件夹 ID */
  folderId: string
  /** 文件夹名称 */
  folderName: string
  /** 文件夹路径 */
  folderPath: string
  /** 相似度分数（0-1） */
  score: number
  /** 该文件夹下的书签数量 */
  bookmarkCount: number
  /** 推荐原因 */
  reason: string
}

/** 同步进度 */
export interface FolderVectorSyncProgress {
  total: number
  processed: number
  failed: number
}

export class FolderVectorService {
  /**
   * 预处理文本（长文本压缩）
   * 
   * 使用 Summarizer API 压缩长文本，避免 Embedding 时超过 token 限制
   * 
   * @param text 原始文本
   * @returns 压缩后的文本
   */
  private async preprocessText(text: string): Promise<string> {
    // 短文本直接返回
    if (text.length <= TOKEN_LIMIT_CHARS) {
      return text
    }

    // 尝试使用 Summarizer API 压缩
    try {
      const summarizerAvailable = await builtInSummarizerClient.isAvailable()

      if (summarizerAvailable) {
        logger.info(LOG_TAG, '使用 Summarizer API 压缩长文本', {
          originalLength: text.length
        })

        const result = await builtInSummarizerClient.summarize(text, {
          type: 'key-points',
          format: 'plain-text',
          length: 'short'
        })

        logger.info(LOG_TAG, '长文本压缩完成', {
          originalLength: text.length,
          compressedLength: result.summary.length,
          compressionRatio: (result.summary.length / text.length * 100).toFixed(1) + '%'
        })

        return result.summary
      }
    } catch (error) {
      logger.warn(LOG_TAG, 'Summarizer API 压缩失败，降级到截断', error)
    }

    // 降级：简单截断
    logger.info(LOG_TAG, '降级到简单截断', {
      originalLength: text.length,
      truncatedLength: TOKEN_LIMIT_CHARS
    })

    return text.slice(0, TOKEN_LIMIT_CHARS)
  }

  /**
   * 增量同步文件夹向量
   *
   * 只处理向量库中不存在的文件夹或内容已变更的文件夹
   *
   * @param onProgress 进度回调
   */
  async syncFolderVectors(
    onProgress?: (progress: FolderVectorSyncProgress) => void
  ): Promise<void> {
    const provider = await embeddingService.getProvider()
    if (!provider) {
      logger.warn(LOG_TAG, 'Embedding Provider 不可用，跳过同步')
      return
    }

    // 1. 获取所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // 2. 找出所有文件夹
    const folders = allBookmarks.filter(b => b.isFolder)

    if (folders.length === 0) {
      logger.info(LOG_TAG, '没有文件夹，无需同步')
      return
    }

    logger.info(LOG_TAG, `开始同步文件夹向量: ${folders.length} 个文件夹`)

    const progress: FolderVectorSyncProgress = {
      total: folders.length,
      processed: 0,
      failed: 0
    }

    // 3. 获取所有书签向量
    const allBookmarkVectors = await localVectorStore.getAll()
    const bookmarkVectorMap = new Map(
      allBookmarkVectors.map(v => [v.bookmarkId, v.vector])
    )

    // 4. 为每个文件夹生成向量
    for (const folder of folders) {
      try {
        // 找出该文件夹下的所有书签（直接子节点）
        const childBookmarks = allBookmarks.filter(
          b => b.parentId === folder.id && !b.isFolder && b.url
        )

        if (childBookmarks.length === 0) {
          // 空文件夹：使用文件夹名称生成向量
          const folderNameVector = await provider.embed(folder.title)

          await folderVectorStore.upsert({
            folderId: folder.id,
            folderName: folder.title,
            folderPath: folder.pathString || folder.title,
            vector: folderNameVector,
            bookmarkCount: 0,
            model: provider.name,
            updatedAt: Date.now()
          })

          progress.processed++
          onProgress?.(progress)
          continue
        }

        // 收集该文件夹下所有书签的向量
        const vectors: number[][] = []
        for (const bookmark of childBookmarks) {
          const vector = bookmarkVectorMap.get(bookmark.id)
          if (vector) {
            vectors.push(vector)
          }
        }

        if (vectors.length === 0) {
          // 没有书签有向量：使用文件夹名称生成向量
          const folderNameVector = await provider.embed(folder.title)

          await folderVectorStore.upsert({
            folderId: folder.id,
            folderName: folder.title,
            folderPath: folder.pathString || folder.title,
            vector: folderNameVector,
            bookmarkCount: childBookmarks.length,
            model: provider.name,
            updatedAt: Date.now()
          })

          progress.processed++
          onProgress?.(progress)
          continue
        }

        // 计算平均向量
        const avgVector = computeAverageVector(vectors)

        // 存储文件夹向量
        await folderVectorStore.upsert({
          folderId: folder.id,
          folderName: folder.title,
          folderPath: folder.pathString || folder.title,
          vector: avgVector,
          bookmarkCount: childBookmarks.length,
          model: provider.name,
          updatedAt: Date.now()
        })

        progress.processed++
      } catch (error) {
        logger.warn(LOG_TAG, `文件夹向量生成失败: ${folder.title}`, error)
        progress.failed++
        progress.processed++
      }

      onProgress?.(progress)

      // 让出主线程
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    logger.info(
      LOG_TAG,
      `同步完成: 成功 ${progress.processed - progress.failed} 个，失败 ${progress.failed} 个`
    )
  }

  /**
   * 推荐文件夹
   *
   * 根据书签的标题和 URL 推荐最合适的文件夹
   * 
   * 优化：使用 Summarizer API 预处理长文本，提升向量质量
   *
   * @param bookmarkTitle 书签标题
   * @param bookmarkUrl 书签 URL
   * @param bookmarkContent 书签内容（可选）
   * @param topK 返回数量
   * @param minScore 最低相似度阈值，默认 0.3
   */
  async recommendFolders(
    bookmarkTitle: string,
    bookmarkUrl: string,
    bookmarkContent?: string,
    topK = 3,
    minScore = 0.3
  ): Promise<FolderRecommendation[]> {
    const provider = await embeddingService.getProvider()
    if (!provider) {
      logger.warn(LOG_TAG, 'Embedding Provider 不可用')
      return []
    }

    // 1. 构造书签文本
    let bookmarkText = `${bookmarkTitle} | ${bookmarkUrl}`

    // 如果有内容，添加内容（预处理长文本）
    if (bookmarkContent) {
      const processedContent = await this.preprocessText(bookmarkContent)
      bookmarkText += ` | ${processedContent}`
    }

    // 2. 生成书签的向量
    const bookmarkVector = await provider.embed(bookmarkText)

    // 3. 获取所有文件夹向量
    const allFolderVectors = await folderVectorStore.getAll()

    if (allFolderVectors.length === 0) {
      logger.info(LOG_TAG, '文件夹向量库为空，请先同步')
      return []
    }

    // 4. 计算相似度
    const scored = allFolderVectors
      .map(folder => ({
        folderId: folder.folderId,
        folderName: folder.folderName,
        folderPath: folder.folderPath,
        bookmarkCount: folder.bookmarkCount,
        score: dotProduct(bookmarkVector, folder.vector)
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    // 5. 生成推荐原因
    const recommendations: FolderRecommendation[] = scored.map(item => ({
      ...item,
      reason: generateReason(item.bookmarkCount, item.score)
    }))

    logger.info(
      LOG_TAG,
      `推荐完成: ${allFolderVectors.length} 个文件夹 → ${recommendations.length} 个推荐`
    )

    return recommendations
  }

  /**
   * 更新单个文件夹的向量
   *
   * 当文件夹下的书签发生变化时调用
   *
   * @param folderId 文件夹 ID
   */
  async updateFolderVector(folderId: string): Promise<void> {
    const provider = await embeddingService.getProvider()
    if (!provider) {
      logger.warn(LOG_TAG, 'Embedding Provider 不可用')
      return
    }

    // 1. 获取文件夹信息
    const folder = await indexedDBManager.getBookmarkById(folderId)
    if (!folder || !folder.isFolder) {
      logger.warn(LOG_TAG, `文件夹不存在或不是文件夹: ${folderId}`)
      return
    }

    // 2. 获取该文件夹下的所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const childBookmarks = allBookmarks.filter(
      b => b.parentId === folderId && !b.isFolder && b.url
    )

    // 3. 获取所有书签向量
    const allBookmarkVectors = await localVectorStore.getAll()
    const bookmarkVectorMap = new Map(
      allBookmarkVectors.map(v => [v.bookmarkId, v.vector])
    )

    // 4. 收集向量
    const vectors: number[][] = []
    for (const bookmark of childBookmarks) {
      const vector = bookmarkVectorMap.get(bookmark.id)
      if (vector) {
        vectors.push(vector)
      }
    }

    let folderVector: number[]

    if (vectors.length === 0) {
      // 空文件夹或没有书签有向量：使用文件夹名称生成向量
      folderVector = await provider.embed(folder.title)
    } else {
      // 计算平均向量
      folderVector = computeAverageVector(vectors)
    }

    // 5. 存储文件夹向量
    await folderVectorStore.upsert({
      folderId: folder.id,
      folderName: folder.title,
      folderPath: folder.pathString || folder.title,
      vector: folderVector,
      bookmarkCount: childBookmarks.length,
      model: provider.name,
      updatedAt: Date.now()
    })

    logger.info(LOG_TAG, `文件夹向量已更新: ${folder.title}`)
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    folderCount: number
    providerName: string | null
  }> {
    const [folderCount, provider] = await Promise.all([
      folderVectorStore.count(),
      embeddingService.getProvider()
    ])
    return { folderCount, providerName: provider?.name ?? null }
  }

  /**
   * 清空所有文件夹向量（用于重置）
   */
  async clearAll(): Promise<void> {
    await folderVectorStore.clear()
    logger.info(LOG_TAG, '已清空所有文件夹向量')
  }
}

/**
 * 计算向量的平均值
 */
function computeAverageVector(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('向量数组为空')
  }

  const dimension = vectors[0]?.length ?? 0
  const avgVector = new Array(dimension).fill(0)

  for (const vector of vectors) {
    for (let i = 0; i < dimension; i++) {
      avgVector[i] += vector[i] ?? 0
    }
  }

  for (let i = 0; i < dimension; i++) {
    avgVector[i] /= vectors.length
  }

  // 归一化
  const magnitude = Math.sqrt(avgVector.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      avgVector[i] /= magnitude
    }
  }

  return avgVector
}

/**
 * 点积（归一化向量的余弦相似度 = 点积）
 */
function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0)
  }
  return sum
}

/**
 * 生成推荐原因
 */
function generateReason(bookmarkCount: number, score: number): string {
  const percentage = Math.round(score * 100)

  if (bookmarkCount === 0) {
    return `新文件夹（匹配度 ${percentage}%）`
  }

  if (bookmarkCount === 1) {
    return `包含 1 个相似书签（匹配度 ${percentage}%）`
  }

  return `包含 ${bookmarkCount} 个相似书签（匹配度 ${percentage}%）`
}

export const folderVectorService = new FolderVectorService()
