/**
 * ONNX Embedding Provider - 直接运行版本
 * 仅在 Offscreen Document 里使用，不做环境检测
 */

import type { EmbeddingProvider } from './embedding-provider'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'OnnxEmbeddingProviderDirect'

export class OnnxEmbeddingProviderDirect implements EmbeddingProvider {
  readonly name = 'onnx-local'
  readonly dimensions = 384

  private pipeline:
    | ((text: string | string[], options?: Record<string, unknown>) => Promise<unknown>)
    | null = null
  private loadPromise: Promise<void> | null = null
  private loadFailed = false

  async isAvailable(): Promise<boolean> {
    // Offscreen Document 环境支持 ONNX，直接返回 true
    // 实际可用性会在 embed() 调用时验证
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

      try {
        const { pipeline, env } = await import('@huggingface/transformers')

        // 配置环境以支持 Chrome 扩展的 CSP 限制
        env.useBrowserCache = true
        env.allowLocalModels = false

        // 配置 WASM 后端，尝试使用单线程模式避免 CSP 问题
        const wasmBackend = env.backends.onnx.wasm
        if (wasmBackend) {
          wasmBackend.numThreads = 1
          // 设置 WASM 路径
          if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
            wasmBackend.wasmPaths = chrome.runtime.getURL('assets/')
          }
        }

        // 尝试使用 WASM 设备加载模型
        this.pipeline = (await pipeline(
          'feature-extraction',
          'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
          {
            dtype: 'q8',
            device: 'wasm'
          }
        )) as (text: string | string[], options?: Record<string, unknown>) => Promise<unknown>

        logger.info(LOG_TAG, `模型加载完成，耗时 ${Date.now() - startTime}ms`)
      } catch (error) {
        logger.error(LOG_TAG, '模型加载失败', error)
        // 如果是 CSP 相关错误，提供更详细的错误信息
        if (error instanceof Error && error.message.includes('Content Security Policy')) {
          logger.error(LOG_TAG, 'CSP 错误：需要允许 WebAssembly 执行。请检查扩展的 CSP 配置。')
        }
        throw error
      }
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
    const output = await this.pipeline!(text, { pooling: 'mean', normalize: true })
    return extractVector(output)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    await this.ensureLoaded()
    const output = await this.pipeline!(texts, { pooling: 'mean', normalize: true })
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

/** Offscreen Document 专用单例 */
export const onnxEmbeddingProviderDirect = new OnnxEmbeddingProviderDirect()
