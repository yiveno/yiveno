/**
 * 文件夹描述生成服务
 *
 * 职责：
 * 1. 根据文件夹下的书签内容自动生成文件夹描述
 * 2. 批量生成多个文件夹的描述
 * 3. 提升文件夹可读性和搜索体验
 *
 * 使用 Summarizer API 生成高质量描述
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { builtInSummarizerClient } from '@/infrastructure/llm/builtin-summarizer-client'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'FolderDescriptionService'

/** 文件夹描述结果 */
export interface FolderDescriptionResult {
  /** 文件夹 ID */
  folderId: string
  /** 文件夹名称 */
  folderName: string
  /** 生成的描述 */
  description: string
  /** 使用的提供者 */
  provider: 'builtin' | 'openai' | 'claude' | 'gemini' | 'deepseek'
  /** 基于的书签数量 */
  bookmarkCount: number
}

/** 批量生成进度 */
export interface FolderDescriptionProgress {
  total: number
  processed: number
  failed: number
}

export class FolderDescriptionService {
  /**
   * 为单个文件夹生成描述
   *
   * 优先级：
   * 1. Summarizer API（headline 类型，生成标题式摘要）
   * 2. Prompt API（fallback）
   *
   * @param folderId 文件夹 ID
   */
  async generateDescription(folderId: string): Promise<FolderDescriptionResult> {
    // 1. 获取文件夹信息
    const folder = await indexedDBManager.getBookmarkById(folderId)
    if (!folder || !folder.isFolder) {
      throw new Error(`文件夹不存在或不是文件夹: ${folderId}`)
    }

    // 2. 获取该文件夹下的所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const childBookmarks = allBookmarks.filter(b => b.parentId === folderId && !b.isFolder && b.url)

    if (childBookmarks.length === 0) {
      // 空文件夹：返回默认描述
      return {
        folderId: folder.id,
        folderName: folder.title,
        description: '空文件夹',
        provider: 'builtin',
        bookmarkCount: 0
      }
    }

    // 3. 构造输入文本（所有书签标题）
    const bookmarkTitles = childBookmarks
      .map(b => b.title)
      .filter(Boolean)
      .slice(0, 50) // 最多取 50 个书签
      .join('\n')

    // 4. 优先尝试 Summarizer API
    try {
      const summarizerAvailable = await builtInSummarizerClient.isAvailable()

      if (summarizerAvailable) {
        logger.info(LOG_TAG, '使用 Summarizer API 生成文件夹描述', {
          folderId,
          folderName: folder.title,
          bookmarkCount: childBookmarks.length
        })

        const result = await builtInSummarizerClient.summarize(bookmarkTitles, {
          type: 'headline',
          format: 'plain-text',
          length: 'short'
        })

        return {
          folderId: folder.id,
          folderName: folder.title,
          description: result.summary,
          provider: 'builtin',
          bookmarkCount: childBookmarks.length
        }
      }
    } catch (error) {
      logger.warn(LOG_TAG, 'Summarizer API 失败，降级到 Prompt API', error)
    }

    // 5. 降级到 Prompt API
    logger.info(LOG_TAG, '使用 Prompt API 生成文件夹描述', {
      folderId,
      folderName: folder.title
    })

    try {
      const prompt = `请为这个书签文件夹生成一个简洁的描述（30字以内）：

文件夹名称：${folder.title}
包含书签：
${bookmarkTitles}

描述：`

      const result = await llmAdapter.complete(prompt, {
        maxTokens: 50,
        temperature: 0.5
      })

      return {
        folderId: folder.id,
        folderName: folder.title,
        description: result.text.trim(),
        provider: result.provider,
        bookmarkCount: childBookmarks.length
      }
    } catch (error) {
      logger.error(LOG_TAG, '文件夹描述生成失败', { error, folderId })
      throw new Error(`文件夹描述生成失败: ${String(error)}`)
    }
  }

  /**
   * 批量生成文件夹描述
   *
   * @param folderIds 文件夹 ID 数组（如果为空，则处理所有文件夹）
   * @param onProgress 进度回调
   */
  async generateBatch(
    folderIds?: string[],
    onProgress?: (progress: FolderDescriptionProgress) => void
  ): Promise<FolderDescriptionResult[]> {
    // 1. 获取所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // 2. 找出所有文件夹
    let folders = allBookmarks.filter(b => b.isFolder)

    // 3. 如果指定了 folderIds，则只处理这些文件夹
    if (folderIds && folderIds.length > 0) {
      folders = folders.filter(f => folderIds.includes(f.id))
    }

    if (folders.length === 0) {
      logger.info(LOG_TAG, '没有文件夹需要处理')
      return []
    }

    logger.info(LOG_TAG, `开始批量生成文件夹描述: ${folders.length} 个文件夹`)

    const progress: FolderDescriptionProgress = {
      total: folders.length,
      processed: 0,
      failed: 0
    }

    const results: FolderDescriptionResult[] = []

    // 4. 逐个生成描述
    for (const folder of folders) {
      try {
        const result = await this.generateDescription(folder.id)
        results.push(result)
      } catch (error) {
        logger.warn(LOG_TAG, `文件夹描述生成失败: ${folder.title}`, error)
        progress.failed++
      }

      progress.processed++
      onProgress?.(progress)

      // 让出主线程
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    logger.info(LOG_TAG, `批量生成完成: 成功 ${results.length} 个，失败 ${progress.failed} 个`)

    return results
  }

  /**
   * 检查是否有可用的描述生成服务
   */
  async isAvailable(): Promise<boolean> {
    // 检查 Summarizer API
    const summarizerAvailable = await builtInSummarizerClient.isAvailable()
    if (summarizerAvailable) {
      return true
    }

    // 检查 Prompt API
    return await llmAdapter.hasAvailableProvider()
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<{
    available: boolean
    provider: 'summarizer' | 'prompt' | 'none'
    message: string
  }> {
    const summarizerAvailable = await builtInSummarizerClient.isAvailable()
    if (summarizerAvailable) {
      return {
        available: true,
        provider: 'summarizer',
        message: '使用 Summarizer API（质量更高、速度更快）'
      }
    }

    const promptAvailable = await llmAdapter.hasAvailableProvider()
    if (promptAvailable) {
      return {
        available: true,
        provider: 'prompt',
        message: '使用 Prompt API（通用 LLM）'
      }
    }

    return {
      available: false,
      provider: 'none',
      message: '没有可用的 AI 服务，请在设置页面配置'
    }
  }
}

/**
 * 单例实例
 */
export const folderDescriptionService = new FolderDescriptionService()
