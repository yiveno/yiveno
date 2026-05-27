/**
 * 书签整理服务
 *
 * 职责：
 * - 一键整理书签（AI 生成文件夹结构）
 * - 结合 Embedding 和 LLM 的混合方案
 * - 提供预览和手动调整功能
 * - 执行书签移动操作
 */

import { aiAppService } from '@/application/ai/ai-app-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { embeddingService } from '@/infrastructure/embedding/embedding-service'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 整理进度
 */
export interface OrganizeProgress {
  /** 总阶段数 */
  totalStages: number
  /** 当前阶段 */
  currentStage: number
  /** 当前阶段名称 */
  stageName: string
  /** 总书签数 */
  totalBookmarks: number
  /** 已处理书签数 */
  processedBookmarks: number
  /** 是否完成 */
  isComplete: boolean
}

/**
 * 文件夹结构
 */
export interface FolderStructure {
  name: string
  path: string
  bookmarkIds: string[]
}

/**
 * 整理结果
 */
export interface OrganizeResult {
  /** 生成的文件夹结构 */
  folders: FolderStructure[]
  /** 原始书签数量 */
  originalCount: number
  /** 分类书签数量 */
  organizedCount: number
  /** 未分类书签数量 */
  unclassifiedCount: number
  /** 使用的 AI 提供者 */
  aiProvider: string
}

/**
 * 书签整理服务
 */
export class BookmarkOrganizeService {
  private readonly loggerPrefix = 'BookmarkOrganizeService'

  /**
   * 一键整理书签
   *
   * 流程：
   * 1. 从 IndexedDB 获取所有书签
   * 2. 为书签生成 Embedding（如果没有）
   * 3. 使用 LLM 分析并生成文件夹结构
   * 4. 返回整理结果供用户预览
   *
   * @param progressCallback 进度回调
   * @returns 整理结果
   */
  async organizeBookmarks(
    progressCallback?: (progress: OrganizeProgress) => void
  ): Promise<OrganizeResult> {
    logger.info(this.loggerPrefix, '开始一键整理书签')

    // 阶段 1: 获取书签数据
    this.updateProgress(progressCallback, {
      totalStages: 4,
      currentStage: 1,
      stageName: '获取书签数据',
      totalBookmarks: 0,
      processedBookmarks: 0,
      isComplete: false
    })

    const bookmarks = await indexedDBManager.getAllBookmarks()
    logger.info(this.loggerPrefix, `获取到 ${bookmarks.length} 个书签`)

    // 过滤掉文件夹
    const bookmarkItems = bookmarks.filter(b => !b.isFolder)
    logger.info(this.loggerPrefix, `过滤后剩余 ${bookmarkItems.length} 个书签项`)

    // 阶段 2: 生成 Embedding
    this.updateProgress(progressCallback, {
      totalStages: 4,
      currentStage: 2,
      stageName: '生成向量嵌入',
      totalBookmarks: bookmarkItems.length,
      processedBookmarks: 0,
      isComplete: false
    })

    try {
      await embeddingService.syncBookmarks(bookmarkItems, progress => {
        this.updateProgress(progressCallback, {
          totalStages: 4,
          currentStage: 2,
          stageName: '生成向量嵌入',
          totalBookmarks: progress.total,
          processedBookmarks: progress.processed,
          isComplete: false
        })
      })
    } catch (error) {
      logger.warn(this.loggerPrefix, 'Embedding 同步失败，继续使用 AI 分析', error)
    }

    // 阶段 3: AI 分析并生成文件夹结构
    this.updateProgress(progressCallback, {
      totalStages: 4,
      currentStage: 3,
      stageName: 'AI 分析书签内容',
      totalBookmarks: bookmarkItems.length,
      processedBookmarks: bookmarkItems.length,
      isComplete: false
    })

    // 准备发送给 AI 的数据
    const aiBookmarks = bookmarkItems.map(b => ({
      id: b.id,
      title: b.title,
      url: b.url || '',
      existingTags: b.tags
    }))

    const aiResult = await aiAppService.autoOrganizeBookmarks(aiBookmarks)

    // 阶段 4: 完成
    this.updateProgress(progressCallback, {
      totalStages: 4,
      currentStage: 4,
      stageName: '整理完成',
      totalBookmarks: bookmarkItems.length,
      processedBookmarks: bookmarkItems.length,
      isComplete: true
    })

    // 统计结果
    const organizedCount = aiResult.folders.reduce(
      (sum, folder) => sum + folder.bookmarkIds.length,
      0
    )
    const unclassifiedCount = bookmarkItems.length - organizedCount

    const result: OrganizeResult = {
      folders: aiResult.folders,
      originalCount: bookmarkItems.length,
      organizedCount,
      unclassifiedCount,
      aiProvider: 'llm' // 实际应该从 aiResult 中获取
    }

    logger.info(this.loggerPrefix, '一键整理完成', {
      originalCount: result.originalCount,
      organizedCount: result.organizedCount,
      unclassifiedCount: result.unclassifiedCount,
      folderCount: result.folders.length
    })

    return result
  }

  /**
   * 应用整理结果
   *
   * 根据用户确认的文件夹结构，执行书签移动操作
   *
   * @param folderStructure 文件夹结构
   * @param progressCallback 进度回调
   */
  async applyOrganization(
    folderStructure: FolderStructure[],
    progressCallback?: (progress: OrganizeProgress) => void
  ): Promise<void> {
    logger.info(this.loggerPrefix, '开始应用整理结果', { folderCount: folderStructure.length })

    const totalBookmarks = folderStructure.reduce((sum, f) => sum + f.bookmarkIds.length, 0)
    let processedBookmarks = 0

    // 阶段 1: 创建文件夹
    this.updateProgress(progressCallback, {
      totalStages: 3,
      currentStage: 1,
      stageName: '创建文件夹',
      totalBookmarks,
      processedBookmarks: 0,
      isComplete: false
    })

    const folderIdMap = new Map<string, string>() // path -> folderId

    for (const folder of folderStructure) {
      try {
        // 解析文件夹路径（例如："技术 > 前端 > React"）
        const pathParts = folder.path.split(' > ').filter(p => p.trim())
        let currentParentId = '1' // 默认创建在书签栏

        // 逐级创建文件夹
        for (let i = 0; i < pathParts.length; i++) {
          const folderName = pathParts[i]
          const currentPath = pathParts.slice(0, i + 1).join(' > ')

          // 检查是否已创建
          if (folderIdMap.has(currentPath)) {
            currentParentId = folderIdMap.get(currentPath)!
            continue
          }

          // 创建文件夹
          const response = await chrome.runtime.sendMessage({
            type: 'CREATE_FOLDER',
            data: {
              title: folderName,
              parentId: currentParentId
            }
          })

          if (response.success) {
            folderIdMap.set(currentPath, response.folderId)
            currentParentId = response.folderId
            logger.info(this.loggerPrefix, `创建文件夹: ${currentPath} -> ${response.folderId}`)
          } else {
            throw new Error(`创建文件夹失败: ${response.error}`)
          }
        }

        // 保存最终文件夹 ID
        folderIdMap.set(folder.path, currentParentId)
      } catch (error) {
        logger.warn(this.loggerPrefix, `创建文件夹失败: ${folder.path}`, error)
      }
    }

    // 阶段 2: 移动书签
    this.updateProgress(progressCallback, {
      totalStages: 3,
      currentStage: 2,
      stageName: '移动书签',
      totalBookmarks,
      processedBookmarks: 0,
      isComplete: false
    })

    for (const folder of folderStructure) {
      const targetFolderId = folderIdMap.get(folder.path)
      if (!targetFolderId) {
        logger.warn(this.loggerPrefix, `跳过文件夹（未创建）: ${folder.path}`)
        continue
      }

      for (const bookmarkId of folder.bookmarkIds) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'MOVE_BOOKMARK',
            data: {
              id: bookmarkId,
              parentId: targetFolderId
            }
          })

          if (response.success) {
            processedBookmarks++
            this.updateProgress(progressCallback, {
              totalStages: 3,
              currentStage: 2,
              stageName: '移动书签',
              totalBookmarks,
              processedBookmarks,
              isComplete: false
            })
          } else {
            logger.warn(this.loggerPrefix, `移动书签失败: ${bookmarkId}`, response.error)
          }

          // 让出主线程
          await new Promise(resolve => setTimeout(resolve, 0))
        } catch (error) {
          logger.warn(this.loggerPrefix, `移动书签失败: ${bookmarkId}`, error)
        }
      }
    }

    // 阶段 3: 完成
    this.updateProgress(progressCallback, {
      totalStages: 3,
      currentStage: 3,
      stageName: '整理完成',
      totalBookmarks,
      processedBookmarks,
      isComplete: true
    })

    logger.info(this.loggerPrefix, '整理结果应用完成', {
      totalBookmarks,
      processedBookmarks,
      folderCount: folderStructure.length
    })
  }

  /**
   * 更新进度
   */
  private updateProgress(
    callback: ((progress: OrganizeProgress) => void) | undefined,
    progress: OrganizeProgress
  ): void {
    if (callback) {
      callback(progress)
    }
  }
}

/**
 * 单例实例
 */
export const bookmarkOrganizeService = new BookmarkOrganizeService()
