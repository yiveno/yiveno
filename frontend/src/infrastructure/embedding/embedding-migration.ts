/**
 * Embedding 模型版本迁移：检测到旧向量时清空并触发全量 re-embed
 */

import { EMBEDDING_VECTOR_MODEL_KEY } from '@/infrastructure/embedding/embedding-model-config'
import { localVectorStore } from '@/infrastructure/embedding/local-vector-store'
import { folderVectorStore } from '@/infrastructure/folder-vector/folder-vector-store'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingMigration'

/**
 * 若 IndexedDB 中向量由旧模型生成，则清空书签向量与文件夹向量。
 * @returns 是否执行了迁移（调用方应全量 re-embed）
 */
export async function ensureEmbeddingVectorsMigrated(): Promise<boolean> {
  const [bookmarkVectors, folderVectors] = await Promise.all([
    localVectorStore.getAll(),
    folderVectorStore.getAll()
  ])

  const bookmarkOutdated =
    bookmarkVectors.length > 0 &&
    bookmarkVectors.some(record => record.model !== EMBEDDING_VECTOR_MODEL_KEY)

  const folderOutdated =
    folderVectors.length > 0 &&
    folderVectors.some(record => record.model !== EMBEDDING_VECTOR_MODEL_KEY)

  if (!bookmarkOutdated && !folderOutdated) {
    return false
  }

  logger.info(LOG_TAG, '检测到旧 Embedding 模型向量，开始迁移', {
    bookmarkVectors: bookmarkVectors.length,
    folderVectors: folderVectors.length,
    targetModel: EMBEDDING_VECTOR_MODEL_KEY
  })

  if (bookmarkOutdated || bookmarkVectors.length > 0) {
    await localVectorStore.clearAll()
  }

  if (folderOutdated || folderVectors.length > 0) {
    await folderVectorStore.clear()
  }

  logger.info(LOG_TAG, '旧向量已清空，将执行全量 re-embed')
  return true
}

/**
 * 向量库是否可用于当前 E5 模型检索（非空且 model 版本一致）
 */
export async function areEmbeddingVectorsReady(): Promise<boolean> {
  const count = await localVectorStore.count()
  if (count === 0) return false

  const sample = await localVectorStore.getSample(8)
  if (sample.length === 0) return false

  return sample.every(record => record.model === EMBEDDING_VECTOR_MODEL_KEY)
}
