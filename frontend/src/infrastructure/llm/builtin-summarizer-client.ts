/**
 * Chrome 内置 Summarizer API 客户端
 *
 * 用于调用 Chrome 138+ 的 Summarizer API
 * 专用于文本摘要生成，比通用 Prompt API 更快、更准确
 */
import type {
  BuiltInLLMAPI,
  BuiltInSummarizer,
  SummarizerCapabilities,
  SummarizerOptions,
  SummarizerType,
  SummarizerLength
} from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'BuiltInSummarizerClient'

/**
 * Summarizer 结果
 */
export interface SummarizerResult {
  /** 摘要文本 */
  summary: string
  /** 使用的类型 */
  type: SummarizerType
  /** 使用的长度 */
  length: SummarizerLength
}

/**
 * Chrome 内置 Summarizer 客户端
 */
export class BuiltInSummarizerClient {
  /**
   * 检测 Summarizer API 是否可用
   */
  async isAvailable(): Promise<boolean> {
    // Service Worker 环境检查
    if (typeof window === 'undefined') {
      logger.debug(LOG_TAG, 'Service Worker 环境不支持 Summarizer API')
      return false
    }

    // 检查 API 是否存在
    if (!('ai' in window)) {
      logger.debug(LOG_TAG, 'window.ai 不存在')
      return false
    }

    const ai = window.ai as BuiltInLLMAPI | undefined

    if (!ai?.summarizer) {
      logger.debug(LOG_TAG, 'window.ai.summarizer 不存在')
      return false
    }

    try {
      const capabilities = await ai.summarizer.capabilities()
      const available = capabilities.available === 'readily'

      if (available) {
        logger.info(LOG_TAG, 'Summarizer API 可用', capabilities)
      } else {
        logger.debug(LOG_TAG, 'Summarizer API 不可用', capabilities)
      }

      return available
    } catch (error) {
      logger.warn(LOG_TAG, '检测 Summarizer API 时出错', error)
      return false
    }
  }

  /**
   * 获取 Summarizer 能力
   */
  async getCapabilities(): Promise<SummarizerCapabilities | null> {
    if (typeof window === 'undefined' || !window.ai?.summarizer) {
      return null
    }

    try {
      return await window.ai.summarizer.capabilities()
    } catch (error) {
      logger.warn(LOG_TAG, '获取 Summarizer 能力失败', error)
      return null
    }
  }

  /**
   * 生成摘要
   *
   * @param text 原始文本
   * @param options 配置选项
   */
  async summarize(text: string, options?: SummarizerOptions): Promise<SummarizerResult> {
    const available = await this.isAvailable()

    if (!available) {
      throw new Error('Summarizer API 不可用')
    }

    const ai = window.ai as BuiltInLLMAPI

    try {
      // 创建 Summarizer 实例
      const summarizer = await ai.summarizer!.create(options)

      // 生成摘要
      const summary = await summarizer.summarize(text)

      // 清理实例
      summarizer.destroy()

      return {
        summary: summary.trim(),
        type: options?.type || 'tl;dr',
        length: options?.length || 'short'
      }
    } catch (error) {
      logger.error(LOG_TAG, '生成摘要失败', { error, textLength: text.length })
      throw new Error(`生成摘要失败: ${String(error)}`)
    }
  }

  /**
   * 流式生成摘要
   *
   * @param text 原始文本
   * @param options 配置选项
   */
  async *summarizeStreaming(text: string, options?: SummarizerOptions): AsyncIterable<string> {
    const available = await this.isAvailable()

    if (!available) {
      throw new Error('Summarizer API 不可用')
    }

    const ai = window.ai as BuiltInLLMAPI

    let summarizer: BuiltInSummarizer | null = null

    try {
      // 创建 Summarizer 实例
      summarizer = await ai.summarizer!.create(options)

      // 流式生成摘要
      for await (const chunk of summarizer.summarizeStreaming(text)) {
        yield chunk
      }
    } catch (error) {
      logger.error(LOG_TAG, '流式生成摘要失败', {
        error,
        textLength: text.length
      })
      throw new Error(`流式生成摘要失败: ${String(error)}`)
    } finally {
      // 清理实例
      if (summarizer) {
        summarizer.destroy()
      }
    }
  }

  /**
   * 批量生成摘要
   *
   * @param texts 文本数组
   * @param options 配置选项
   */
  async summarizeBatch(texts: string[], options?: SummarizerOptions): Promise<SummarizerResult[]> {
    const available = await this.isAvailable()

    if (!available) {
      throw new Error('Summarizer API 不可用')
    }

    const results: SummarizerResult[] = []

    for (const text of texts) {
      try {
        const result = await this.summarize(text, options)
        results.push(result)
      } catch (error) {
        logger.warn(LOG_TAG, '批量摘要中某项失败', { error, textLength: text.length })
        // 失败时返回空摘要
        results.push({
          summary: '',
          type: options?.type || 'tl;dr',
          length: options?.length || 'short'
        })
      }

      // 让出主线程
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    return results
  }

  /**
   * 获取用户启用指南
   */
  getEnableGuide(): {
    title: string
    steps: string[]
    requirements: {
      chromeVersion: string
      platform: string
    }
  } {
    return {
      title: '启用 Chrome 内置 Summarizer API（免费、本地处理）',
      steps: [
        '1. 确保 Chrome 版本 >= 138',
        '2. 在地址栏输入 chrome://flags/#summarization-api-for-gemini-nano',
        '3. 设置为 "Enabled"',
        '4. 重启浏览器',
        '5. 访问 chrome://components/ 检查模型下载状态',
        '6. 点击 "Optimization Guide On Device Model" 的 "Check for update"',
        '7. 等待模型下载完成'
      ],
      requirements: {
        chromeVersion: '138+',
        platform: '桌面端'
      }
    }
  }
}

/**
 * 单例实例
 */
export const builtInSummarizerClient = new BuiltInSummarizerClient()
