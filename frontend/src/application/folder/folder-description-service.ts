/**
 * 文件夹描述生成服务
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import type { LLMProvider } from '@/types/infrastructure/llm'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'FolderDescriptionService'

/** 文件夹描述结果 */
export interface FolderDescriptionResult {
  folderId: string
  folderName: string
  description: string
  provider: LLMProvider
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
   */
  async generateDescription(folderId: string): Promise<FolderDescriptionResult> {
    const folder = await indexedDBManager.getBookmarkById(folderId)
    if (!folder || !folder.isFolder) {
      throw new Error(`文件夹不存在或不是文件夹: ${folderId}`)
    }

    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const childBookmarks = allBookmarks.filter(b => b.parentId === folderId && !b.isFolder && b.url)

    if (childBookmarks.length === 0) {
      return {
        folderId: folder.id,
        folderName: folder.title,
        description: '空文件夹',
        provider: 'hosted',
        bookmarkCount: 0
      }
    }

    const bookmarkTitles = childBookmarks
      .map(b => b.title)
      .filter(Boolean)
      .slice(0, 50)
      .join('\n')

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
   */
  async generateBatch(
    folderIds?: string[],
    onProgress?: (progress: FolderDescriptionProgress) => void
  ): Promise<FolderDescriptionResult[]> {
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    let folders = allBookmarks.filter(b => b.isFolder)

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
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    logger.info(LOG_TAG, `批量生成完成: 成功 ${results.length} 个，失败 ${progress.failed} 个`)

    return results
  }

  /**
   * 检查是否有可用的描述生成服务
   */
  async isAvailable(): Promise<boolean> {
    return llmAdapter.hasAvailableProvider()
  }

  /**
   * 获取服务状态
   */
  async getStatus(): Promise<{
    available: boolean
    provider: 'llm' | 'none'
    message: string
  }> {
    const available = await llmAdapter.hasAvailableProvider()
    if (available) {
      return {
        available: true,
        provider: 'llm',
        message: '使用 otterSage 托管 AI 或自定义 API Key'
      }
    }

    return {
      available: false,
      provider: 'none',
      message: '没有可用的 AI 服务，请登录 Pro 或配置 API Key'
    }
  }
}

export const folderDescriptionService = new FolderDescriptionService()
