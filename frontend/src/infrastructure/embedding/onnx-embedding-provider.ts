/**
 * ONNX Embedding Provider
 *
 * 直接在当前页面运行 ONNX，不走 Offscreen Document。
 * 使用单线程 WASM 后端，避免需要 blob: Worker（Chrome 扩展 CSP 限制）。
 */

import type { EmbeddingProvider } from './embedding-provider'
import { logger } from '@/infrastructure/logging/logger'
import { pipeline, env } from '@huggingface/transformers'

const LOG_TAG = 'OnnxEmbeddingProvider'
const DEFAULT_DIMENSIONS = 384

class OnnxEmbeddingProviderDirect implements EmbeddingProvider {
  readonly name = 'onnx-local'
  readonly dimensions = DEFAULT_DIMENSIONS

  private pipeline:
    | ((text: string | string[], options?: Record<string, unknown>) => Promise<unknown>)
    | null = null
  private loadPromise: Promise<void> | null = null
  private loadFailed = false

  async isAvailable(): Promise<boolean> {
    return true
  }

  private async ensureLoaded(): Promise<void> {
    if (this.pipeline) return
    if (this.loadFailed) throw new Error('模型加载失败')
    if (this.loadPromise) {
      await this.loadPromise
      return
    }

    this.loadPromise = (async () => {
      logger.info(LOG_TAG, '加载模型: Xenova/paraphrase-multilingual-MiniLM-L12-v2')
      const startTime = Date.now()

      env.useBrowserCache = true
      env.allowLocalModels = false
      // 强制单线程，禁止从外部 CDN 加载 WASM 运行时文件
      // Chrome 扩展 MV3 的 script-src 不允许外部域名
      const wasmBackend = env.backends.onnx.wasm
      if (wasmBackend) {
        wasmBackend.numThreads = 1
      }
      // 设置 WASM 文件路径为扩展本地 assets，避免从 cdn.jsdelivr.net 加载
      if (wasmBackend && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        wasmBackend.wasmPaths = chrome.runtime.getURL('assets/')
      }

      this.pipeline = (await pipeline(
        'feature-extraction',
        'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        { dtype: 'q8', device: 'wasm' }
      )) as (text: string | string[], options?: Record<string, unknown>) => Promise<unknown>

      logger.info(LOG_TAG, `模型加载完成，耗时 ${Date.now() - startTime}ms`)
    })()

    try {
      await this.loadPromise
    } catch (err) {
      this.loadFailed = true
      this.pipeline = null
      throw err
    } finally {
      this.loadPromise = null
    }
  }

  async embed(text: string): Promise<number[]> {
    await this.ensureLoaded()
    const output = await this.pipeline!(text, {
      pooling: 'mean',
      normalize: true
    })
    return extractVector(output)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    await this.ensureLoaded()
    const output = await this.pipeline!(texts, {
      pooling: 'mean',
      normalize: true
    })
    return extractBatchVectors(output, texts.length)
  }
}

function extractVector(output: unknown): number[] {
  const tensor = output as { data: Float32Array | number[]; dims: number[] }
  if (tensor?.data) return Array.from(tensor.data)
  if (Array.isArray(output)) {
    const first = output[0]
    if (Array.isArray(first)) return first as number[]
    return output as number[]
  }
  throw new Error('无法解析 embedding 输出格式')
}

function extractBatchVectors(output: unknown, count: number): number[][] {
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

export const onnxEmbeddingProvider: EmbeddingProvider = new OnnxEmbeddingProviderDirect()
