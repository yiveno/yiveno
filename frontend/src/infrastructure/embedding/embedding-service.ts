/**
 * Embedding 服务
 *
 * 使用 multilingual-e5-small 本地 ONNX；query/passage 分离编码。
 */

import type { EmbeddingProvider } from './embedding-provider'
import { ensureEmbeddingVectorsMigrated } from '@/infrastructure/embedding/embedding-migration'
import {
  buildBookmarkPassageText,
  formatEmbeddingPassage
} from '@/infrastructure/embedding/embedding-text'
import { EMBEDDING_VECTOR_MODEL_KEY } from '@/infrastructure/embedding/embedding-model-config'
import { onnxEmbeddingProvider } from './onnx-embedding-provider'
import { localVectorStore } from './local-vector-store'
import type { VectorRecord } from './local-vector-store'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingService'

const BATCH_SIZE = 32

export interface EmbeddingSyncProgress {
  total: number
  processed: number
  failed: number
}

export interface LocalSemanticResult {
  bookmarkId: string
  score: number
  title: string
  url: string
}

export class EmbeddingService {
  private readonly provider: EmbeddingProvider = onnxEmbeddingProvider

  async getProvider(): Promise<EmbeddingProvider | null> {
    return this.provider
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  /**
   * 同步书签向量（模型升级后自动全量 re-embed）
   */
  async syncBookmarks(
    bookmarks: BookmarkRecord[],
    onProgress?: (progress: EmbeddingSyncProgress) => void
  ): Promise<void> {
    const provider = await this.getProvider()
    if (!provider) {
      logger.warn(LOG_TAG, 'Embedding Provider 不可用，跳过同步')
      return
    }

    const urlBookmarks = bookmarks.filter(b => b.url && !b.isFolder)
    if (urlBookmarks.length === 0) return

    const migrated = await ensureEmbeddingVectorsMigrated()

    const existingIds = migrated ? new Set<string>() : await localVectorStore.getAllIds()

    const currentIds = new Set(urlBookmarks.map(b => b.id))
    const toDelete = Array.from(existingIds).filter(id => !currentIds.has(id))
    if (toDelete.length > 0) {
      await localVectorStore.deleteBatch(toDelete)
      logger.info(LOG_TAG, `清理已删除书签向量: ${toDelete.length} 条`)
    }

    const toEmbed = migrated ? urlBookmarks : urlBookmarks.filter(b => !existingIds.has(b.id))

    if (toEmbed.length === 0) {
      logger.info(LOG_TAG, '所有书签向量已是最新，无需同步')
      return
    }

    logger.info(LOG_TAG, `开始同步: ${toEmbed.length} 条书签需要 embedding`, {
      fullReembed: migrated,
      model: EMBEDDING_VECTOR_MODEL_KEY
    })

    const progress: EmbeddingSyncProgress = {
      total: toEmbed.length,
      processed: 0,
      failed: 0
    }

    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE)

      try {
        const texts = batch.map(b => buildBookmarkPassageText(b))
        const vectors = await provider.embedPassageBatch(texts)

        const updatedAt = Date.now()
        const records: VectorRecord[] = []
        batch.forEach((b, idx) => {
          const vector = vectors[idx]
          if (!vector || !b.url) return

          records.push({
            bookmarkId: b.id,
            vector,
            model: EMBEDDING_VECTOR_MODEL_KEY,
            title: b.title,
            url: b.url,
            updatedAt
          })
        })

        await localVectorStore.upsertBatch(records)
        progress.processed += batch.length
      } catch (error) {
        logger.warn(LOG_TAG, '批次 embedding 失败', error)
        progress.failed += batch.length
        progress.processed += batch.length
      }

      onProgress?.(progress)
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    logger.info(
      LOG_TAG,
      `同步完成: 成功 ${progress.processed - progress.failed} 条，失败 ${progress.failed} 条`
    )
  }

  /**
   * 本地语义搜索（query 编码 vs passage 向量库）
   */
  async search(query: string, topK = 10, minScore = 0.2): Promise<LocalSemanticResult[]> {
    const provider = await this.getProvider()
    if (!provider) return []

    const count = await localVectorStore.count()
    if (count === 0) {
      logger.info(LOG_TAG, '向量库为空，请先同步书签')
      return []
    }

    const queryVector = await provider.embedQuery(query.trim())
    return localVectorStore.search(queryVector, topK, minScore)
  }

  async getStats(): Promise<{ count: number; providerName: string | null }> {
    const [count, provider] = await Promise.all([localVectorStore.count(), this.getProvider()])
    return { count, providerName: provider?.name ?? null }
  }
}

/** 文件夹名称 passage 文本 */
export function buildFolderPassageText(folderTitle: string, folderPath?: string): string {
  const body =
    folderPath && folderPath !== folderTitle ? `${folderTitle} | ${folderPath}` : folderTitle
  return formatEmbeddingPassage(body)
}

export const embeddingService = new EmbeddingService()
