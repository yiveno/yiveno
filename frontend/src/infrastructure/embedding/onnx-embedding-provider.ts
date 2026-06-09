/**
 * ONNX Embedding Provider（multilingual-e5-small，query/passage 分离）
 */

import type { EmbeddingProvider } from './embedding-provider'
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_ID,
  EMBEDDING_VECTOR_MODEL_KEY
} from '@/infrastructure/embedding/embedding-model-config'
import {
  formatEmbeddingPassage,
  formatEmbeddingQuery
} from '@/infrastructure/embedding/embedding-text'
import {
  createLocalEmbeddingPipeline,
  extractEmbeddingBatchVectors,
  extractEmbeddingVector,
  type EmbeddingPipeline
} from '@/infrastructure/embedding/onnx-embedding-pipeline'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'OnnxEmbeddingProvider'

class OnnxEmbeddingProvider implements EmbeddingProvider {
  readonly name = EMBEDDING_VECTOR_MODEL_KEY
  readonly dimensions = EMBEDDING_DIMENSIONS

  private pipeline: EmbeddingPipeline | null = null
  private loadPromise: Promise<void> | null = null
  private loadFailed = false

  async isAvailable(): Promise<boolean> {
    return true
  }

  private async ensureLoaded(): Promise<void> {
    if (this.pipeline) return
    if (this.loadFailed) throw new Error('本地 Embedding 模型加载失败')
    if (this.loadPromise) {
      await this.loadPromise
      return
    }

    this.loadPromise = (async () => {
      logger.info(LOG_TAG, `加载本地模型: ${EMBEDDING_MODEL_ID}`)
      const startTime = Date.now()
      this.pipeline = await createLocalEmbeddingPipeline()
      logger.info(LOG_TAG, `本地模型加载完成，耗时 ${Date.now() - startTime}ms`)
    })()

    try {
      await this.loadPromise
    } catch (error) {
      this.loadFailed = true
      this.pipeline = null
      throw error
    } finally {
      this.loadPromise = null
    }
  }

  private async runPipeline(text: string | string[]): Promise<unknown> {
    await this.ensureLoaded()
    return this.pipeline!(text, {
      pooling: 'mean',
      normalize: true
    })
  }

  async embedQuery(text: string): Promise<number[]> {
    const output = await this.runPipeline(formatEmbeddingQuery(text))
    return extractEmbeddingVector(output)
  }

  async embedPassage(text: string): Promise<number[]> {
    const output = await this.runPipeline(formatEmbeddingPassage(text))
    return extractEmbeddingVector(output)
  }

  async embedPassageBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const formatted = texts.map(formatEmbeddingPassage)
    const output = await this.runPipeline(formatted)
    return extractEmbeddingBatchVectors(output, texts.length)
  }

  async embed(text: string): Promise<number[]> {
    return this.embedPassage(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return this.embedPassageBatch(texts)
  }
}

export const onnxEmbeddingProvider: EmbeddingProvider = new OnnxEmbeddingProvider()
