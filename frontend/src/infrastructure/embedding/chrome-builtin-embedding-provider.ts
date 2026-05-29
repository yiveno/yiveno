/**
 * Chrome Built-in AI Embedding Provider（方案1，未来预留）
 *
 * 依赖 Chrome 内置的 Gemini Nano 模型。
 * 目前 Chrome 的 Embedding API 尚未正式发布，此实现作为占位符，
 * 待 Chrome AI API 成熟后替换内部实现即可，外部接口保持不变。
 *
 * 参考：https://developer.chrome.com/docs/ai/built-in
 */

import type { EmbeddingProvider } from './embedding-provider'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'ChromeBuiltinEmbeddingProvider'

export class ChromeBuiltinEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'chrome-builtin'
  readonly dimensions = 768

  async isAvailable(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ai = (window as any).ai
      if (!ai?.embedder) return false
      const availability = await ai.embedder.availability()
      return availability === 'available'
    } catch {
      return false
    }
  }

  async embed(text: string): Promise<number[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ai = (window as any).ai
    if (!ai?.embedder) throw new Error('Chrome Built-in AI Embedder 不可用')

    logger.info(LOG_TAG, '使用 Chrome Built-in AI 生成 embedding')
    const session = await ai.embedder.create()
    try {
      const vector = await session.computeEmbedding(text)
      return Array.from(vector as Float32Array)
    } finally {
      session.destroy()
    }
  }
}

export const chromeBuiltinEmbeddingProvider = new ChromeBuiltinEmbeddingProvider()
