/**
 * AI 应用服务
 *
 * 提供高级 AI 功能：
 * - 书签摘要（优先使用 Summarizer API，降级到 Prompt API）
 * - 语义搜索增强
 * - 标签生成
 * 
 * 注意：书签分类功能已迁移到基于向量的本地推荐（folderVectorService）
 */
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { builtInSummarizerClient } from '@/infrastructure/llm/builtin-summarizer-client'
import {
  createSummarizePrompt,
  createSemanticSearchPrompt,
  createTagGenerationPrompt
} from '@/core/ai/prompts'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 书签摘要结果
 */
export interface BookmarkSummaryResult {
  /** 摘要文本 */
  summary: string
  /** 使用的 LLM 提供者 */
  provider: 'builtin' | 'openai' | 'claude' | 'gemini'
}

/**
 * AI 应用服务
 */
export class AIAppService {
  private readonly loggerPrefix = 'AIAppService'

  /**
   * 生成书签摘要
   * 
   * 优先级：
   * 1. Chrome Summarizer API（Chrome 138+，专用摘要模型，质量更高、速度更快）
   * 2. Prompt API（通用 LLM，fallback）
   */
  async summarizeBookmark(bookmark: {
    title: string
    url: string
    content?: string
  }): Promise<BookmarkSummaryResult> {
    // 1. 优先尝试 Summarizer API
    try {
      const summarizerAvailable = await builtInSummarizerClient.isAvailable()

      if (summarizerAvailable) {
        logger.info(this.loggerPrefix, '使用 Summarizer API 生成摘要')

        // 构造输入文本
        const text = [
          `标题：${bookmark.title}`,
          `URL：${bookmark.url}`,
          bookmark.content ? `内容：${bookmark.content.slice(0, 1000)}` : ''
        ]
          .filter(Boolean)
          .join('\n')

        // 使用 Summarizer API
        const result = await builtInSummarizerClient.summarize(text, {
          type: 'tl;dr',
          format: 'plain-text',
          length: 'short'
        })

        return {
          summary: result.summary,
          provider: 'builtin'
        }
      }
    } catch (error) {
      logger.warn(this.loggerPrefix, 'Summarizer API 失败，降级到 Prompt API', error)
      // 继续执行，降级到 Prompt API
    }

    // 2. 降级到 Prompt API
    logger.info(this.loggerPrefix, '使用 Prompt API 生成摘要')

    const prompt = createSummarizePrompt(bookmark)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 100,
        temperature: 0.5
      })

      return {
        summary: result.text.trim(),
        provider: result.provider
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '书签摘要生成失败', { error, bookmark })
      throw new Error(`书签摘要生成失败: ${String(error)}`)
    }
  }

  /**
   * 语义搜索增强
   *
   * 理解用户搜索意图，提取关键词和概念
   */
  async enhanceSemanticSearch(query: string): Promise<{
    keywords: string[]
    concepts: string[]
    synonyms: string[]
  }> {
    const prompt = createSemanticSearchPrompt(query)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 200,
        temperature: 0.4
      })

      // 尝试解析 JSON
      try {
        const parsed = JSON.parse(result.text)
        return {
          keywords: parsed.keywords || [],
          concepts: parsed.concepts || [],
          synonyms: parsed.synonyms || []
        }
      } catch {
        // JSON 解析失败，返回默认值
        return {
          keywords: query.split(/\s+/),
          concepts: [],
          synonyms: []
        }
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '语义搜索增强失败', { error, query })
      // 降级：返回原始查询的关键词
      return {
        keywords: query.split(/\s+/),
        concepts: [],
        synonyms: []
      }
    }
  }

  /**
   * 生成书签标签
   */
  async generateTags(bookmark: {
    title: string
    url: string
    content?: string
  }): Promise<string[]> {
    const prompt = createTagGenerationPrompt(bookmark)

    try {
      const result = await llmAdapter.complete(prompt, {
        maxTokens: 50,
        temperature: 0.5
      })

      // 尝试解析 JSON 数组
      try {
        const parsed = JSON.parse(result.text)
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (tag): tag is string =>
              typeof tag === 'string' && tag.trim().length > 0
          )
        }
      } catch {
        // JSON 解析失败，尝试提取标签
        const tags =
          result.text
            .match(/\[(.*?)\]/)?.[1]
            ?.split(',')
            .map(tag => tag.trim().replace(/['"]/g, ''))
            .filter(Boolean) || []

        return tags
      }

      return []
    } catch (error) {
      logger.error(this.loggerPrefix, '标签生成失败', { error, bookmark })
      return []
    }
  }

  /**
   * 检测可用 LLM 提供者
   * 
   * 包含 Summarizer API 的能力检测
   */
  async detectCapabilities() {
    const capabilities = await llmAdapter.detectCapabilities()

    // 额外检测 Summarizer API
    const summarizerAvailable = await builtInSummarizerClient.isAvailable()

    return {
      ...capabilities,
      summarizer: {
        available: summarizerAvailable,
        capabilities: summarizerAvailable
          ? await builtInSummarizerClient.getCapabilities()
          : null
      }
    }
  }

  /**
   * 获取 Chrome 内置 LLM 启用指南
   */
  getBuiltInLLMGuide() {
    return llmAdapter.getBuiltInLLMGuide()
  }

  /**
   * 获取 Summarizer API 启用指南
   */
  getSummarizerGuide() {
    return builtInSummarizerClient.getEnableGuide()
  }
}

/**
 * 单例实例
 */
export const aiAppService = new AIAppService()
