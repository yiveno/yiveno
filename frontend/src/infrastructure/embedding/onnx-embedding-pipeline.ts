/**
 * 本地 ONNX Embedding 管道加载与输出解析
 *
 * 模型与 WASM 均从扩展包内读取，运行时禁止访问 HuggingFace Hub。
 */

import {
  EMBEDDING_MODEL_ID,
  configureEmbeddingTransformersEnv
} from '@/infrastructure/embedding/embedding-model-config'
import { logger } from '@/infrastructure/logging/logger'
import { pipeline, env } from '@huggingface/transformers'

const LOG_TAG = 'OnnxEmbeddingPipeline'
const MODEL_LOAD_TIMEOUT_MS = 60_000
const MAX_LOAD_ATTEMPTS = 2

export type EmbeddingPipeline = (
  text: string | string[],
  options?: Record<string, unknown>
) => Promise<unknown>

/**
 * 加载扩展内打包的 Embedding 模型管道
 */
export async function createLocalEmbeddingPipeline(): Promise<EmbeddingPipeline> {
  configureEmbeddingTransformersEnv(env)

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_LOAD_ATTEMPTS; attempt++) {
    try {
      const instance = await withTimeout(
        pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
          dtype: 'q8',
          device: 'wasm'
        }),
        MODEL_LOAD_TIMEOUT_MS,
        `本地模型加载超时（${MODEL_LOAD_TIMEOUT_MS / 1000}s）`
      )
      logger.info(LOG_TAG, `本地模型管道就绪: ${EMBEDDING_MODEL_ID}`, { attempt })
      return instance as EmbeddingPipeline
    } catch (error) {
      lastError = error
      if (attempt < MAX_LOAD_ATTEMPTS) {
        logger.warn(LOG_TAG, `本地模型加载失败，${attempt}/${MAX_LOAD_ATTEMPTS} 次重试`, error)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  throw lastError
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    )
  })
}

/** 解析单条 embedding 向量 */
export function extractEmbeddingVector(output: unknown): number[] {
  const tensor = output as { data: Float32Array | number[]; dims: number[] }
  if (tensor?.data) return Array.from(tensor.data)
  if (Array.isArray(output)) {
    const first = output[0]
    if (Array.isArray(first)) return first as number[]
    return output as number[]
  }
  throw new Error('无法解析 embedding 输出格式')
}

/** 解析批量 embedding 向量 */
export function extractEmbeddingBatchVectors(output: unknown, count: number): number[][] {
  const tensor = output as { data: Float32Array | number[]; dims: number[] }
  if (tensor?.data && tensor?.dims) {
    const dim =
      tensor.dims.length >= 2 ? tensor.dims[tensor.dims.length - 1] : tensor.data.length / count
    if (dim === undefined) {
      return []
    }
    const data = Array.from(tensor.data)
    const result: number[][] = []
    for (let i = 0; i < count; i++) {
      result.push(data.slice(i * dim, (i + 1) * dim))
    }
    return result
  }
  if (Array.isArray(output)) {
    return output.map(item =>
      Array.isArray(item) ? (item as number[]) : Array.from(item as Float32Array)
    )
  }
  throw new Error('无法解析批量 embedding 输出格式')
}
