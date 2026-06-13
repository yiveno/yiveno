/**
 * AI 应用服务
 *
 * 提供高级 AI 功能：
 * - 书签摘要
 * - 语义搜索增强
 * - 标签生成
 * - 一键整理
 *
 * 注意：书签分类功能已迁移到基于向量的本地推荐（folderVectorService）
 */
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { userLLMClient, type UserAPIKeyConfig } from '@/infrastructure/llm/user-llm-client'
import { hostedLLMClient, type HostedQuotaInfo } from '@/infrastructure/llm/hosted-llm-client'
import {
  createSummarizePrompt,
  createSemanticSearchPrompt,
  createTagGenerationPrompt,
  createAutoOrganizePrompt
} from '@/core/ai/prompts'
import {
  createDeterministicChunkFallback,
  mergeOrganizeFolderBatches,
  parseOrganizeLlmResponse,
  sanitizeOrganizeFolders,
  type ParsedOrganizeFolder
} from '@/application/ai/organize-response-parser'
import type { LLMProvider } from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

export type { UserLLMProvider } from '@/infrastructure/llm/user-llm-client'
export type UserLLMConfig = UserAPIKeyConfig
export type { HostedQuotaInfo } from '@/infrastructure/llm/hosted-llm-client'

/** 一键整理每批发送给 LLM 的书签数量 */
export const AI_ORGANIZE_BATCH_SIZE = 40

/** 一键整理 AI 批次进度 */
export interface AutoOrganizeBatchProgress {
  processedBatches: number
  totalBatches: number
  processedBookmarks: number
  totalBookmarks: number
}

/**
 * 书签摘要结果
 */
export interface BookmarkSummaryResult {
  /** 摘要文本 */
  summary: string
  /** 使用的 LLM 提供者 */
  provider: LLMProvider
}

/**
 * AI 应用服务
 */
export class AIAppService {
  private readonly loggerPrefix = 'AIAppService'

  /**
   * 生成书签摘要
   */
  async summarizeBookmark(bookmark: {
    title: string
    url: string
    content?: string
  }): Promise<BookmarkSummaryResult> {
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

      try {
        const parsed = JSON.parse(result.text)
        return {
          keywords: parsed.keywords || [],
          concepts: parsed.concepts || [],
          synonyms: parsed.synonyms || []
        }
      } catch {
        return {
          keywords: query.split(/\s+/),
          concepts: [],
          synonyms: []
        }
      }
    } catch (error) {
      logger.error(this.loggerPrefix, '语义搜索增强失败', { error, query })
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

      try {
        const parsed = JSON.parse(result.text)
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (tag): tag is string => typeof tag === 'string' && tag.trim().length > 0
          )
        }
      } catch {
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
   */
  async detectCapabilities() {
    return llmAdapter.detectCapabilities()
  }

  /** 清除 LLM 能力探测缓存 */
  clearLlmCapabilitiesCache(): void {
    llmAdapter.clearCapabilitiesCache()
  }

  /** 读取用户自带 API Key 配置 */
  async getUserLlmConfig(): Promise<UserAPIKeyConfig | null> {
    return userLLMClient.getConfig()
  }

  /** 保存用户自带 API Key 配置 */
  async saveUserLlmConfig(config: UserAPIKeyConfig): Promise<void> {
    await userLLMClient.saveConfig(config)
    this.clearLlmCapabilitiesCache()
  }

  /** 清除用户自带 API Key 配置 */
  async clearUserLlmConfig(): Promise<void> {
    await userLLMClient.clearConfig()
    this.clearLlmCapabilitiesCache()
  }

  /** 测试用户自带 API Key 连通性 */
  async testUserLlmConnection(): Promise<void> {
    await userLLMClient.complete('请回复"ok"', { maxTokens: 5 })
  }

  /** 查询 Pro 托管 AI 配额 */
  async fetchHostedQuota(forceRefresh = false): Promise<HostedQuotaInfo | null> {
    return hostedLLMClient.fetchQuota(forceRefresh)
  }

  /**
   * 自动分类书签
   */
  async autoOrganizeBookmarks(
    bookmarks: Array<{
      id: string
      title: string
      url: string
      content?: string
      existingTags?: string[]
    }>,
    options?: {
      userNotes?: string
      /** 批次进度回调（每批开始前与完成后触发） */
      onProgress?: (progress: AutoOrganizeBatchProgress) => void
    }
  ): Promise<{
    folders: ParsedOrganizeFolder[]
    provider: BookmarkSummaryResult['provider']
  }> {
    if (bookmarks.length === 0) {
      return { folders: [], provider: 'hosted' }
    }

    const validIds = new Set(bookmarks.map(b => b.id))
    const allBookmarkIds = bookmarks.map(bookmark => bookmark.id)
    const MAX_BATCH_PARSE_RETRIES = 1
    const batches: ParsedOrganizeFolder[][] = []
    let lastProvider: BookmarkSummaryResult['provider'] = 'hosted'
    const totalBatches = Math.max(1, Math.ceil(bookmarks.length / AI_ORGANIZE_BATCH_SIZE))

    const reportProgress = (processedBatches: number, processedBookmarks: number) => {
      options?.onProgress?.({
        processedBatches,
        totalBatches,
        processedBookmarks,
        totalBookmarks: bookmarks.length
      })
    }

    try {
      reportProgress(0, 0)

      for (let offset = 0; offset < bookmarks.length; offset += AI_ORGANIZE_BATCH_SIZE) {
        const batchIndex = Math.floor(offset / AI_ORGANIZE_BATCH_SIZE)
        const chunk = bookmarks.slice(offset, offset + AI_ORGANIZE_BATCH_SIZE)
        const chunkIds = chunk.map(bookmark => bookmark.id)
        const prompt = createAutoOrganizePrompt(chunk, options?.userNotes)

        const idByListIndex = new Map(
          chunk.map((bookmark, index) => [String(index + 1), bookmark.id])
        )

        let parsed: ParsedOrganizeFolder[] = []
        for (let attempt = 0; attempt <= MAX_BATCH_PARSE_RETRIES; attempt++) {
          const result = await llmAdapter.complete(prompt, {
            maxTokens: 4000,
            temperature: attempt === 0 ? 0.3 : 0.1
          })
          lastProvider = result.provider
          parsed = parseOrganizeLlmResponse(result.text, validIds, idByListIndex)

          if (parsed.length > 0) {
            break
          }

          if (attempt < MAX_BATCH_PARSE_RETRIES) {
            logger.warn(this.loggerPrefix, '批次解析失败，重试 LLM', {
              offset,
              chunkSize: chunk.length,
              attempt: attempt + 1
            })
          }
        }

        if (parsed.length > 0) {
          batches.push(parsed)
        } else {
          logger.warn(this.loggerPrefix, '批次解析仍失败，使用确定性兜底文件夹', {
            offset,
            chunkSize: chunk.length
          })
          batches.push([createDeterministicChunkFallback(chunkIds)])
        }

        reportProgress(batchIndex + 1, Math.min(offset + chunk.length, bookmarks.length))
      }
    } catch (error) {
      logger.error(this.loggerPrefix, 'AI 自动分类失败', {
        error,
        bookmarkCount: bookmarks.length
      })
      throw new Error(`AI 自动分类失败: ${error instanceof Error ? error.message : String(error)}`)
    }

    let folders = mergeOrganizeFolderBatches(batches)
    folders = sanitizeOrganizeFolders(folders, allBookmarkIds)

    if (folders.length === 0) {
      folders = [createDeterministicChunkFallback(allBookmarkIds)]
    }

    logger.info(this.loggerPrefix, 'AI 自动分类成功', {
      folderCount: folders.length,
      bookmarkCount: bookmarks.length,
      batchCount: batches.length
    })

    return { folders, provider: lastProvider }
  }
}

export const aiAppService = new AIAppService()
