/**
 * AI 自动添加书签流程
 *
 * 职责：
 * - 根据书签标题和 URL 获取推荐目录
 * - 自动创建书签到最合适的目录
 * - 返回创建结果，供不同入口展示各自的通知
 */

import { logger } from '@/infrastructure/logging/logger'
import { getFolderRecommendations } from './folder-recommendation'
import { folderVectorStore } from '@/infrastructure/folder-vector/folder-vector-store'
import { dispatchOffscreenRequest } from '@/infrastructure/offscreen/manager'

export interface AutoAddBookmarkData {
  title: string
  url: string
  favIconUrl?: string | undefined
}

export interface AutoAddBookmarkResult {
  success: boolean
  bookmarkId?: string
  folderId?: string
  folderPath?: string
  error?: string
  /** AI 分类是否生效（false = 降级到默认书签栏） */
  aiUsed?: boolean
}

async function getFolderPath(folderId: string): Promise<string> {
  try {
    const pathParts: string[] = []
    let currentId = folderId

    while (currentId) {
      const nodes = await chrome.bookmarks.get(currentId)
      if (nodes.length === 0) break

      const node = nodes[0]
      if (!node) break

      if (node.title) {
        pathParts.unshift(node.title)
      }

      if (!node.parentId) break
      currentId = node.parentId
    }

    return pathParts.join(' > ') || '书签栏'
  } catch (error) {
    logger.warn('AutoAddBookmark', '获取文件夹路径失败', error)
    return '未知位置'
  }
}

async function getBookmarksBarId(): Promise<string> {
  const tree = await chrome.bookmarks.getTree()
  const bookmarksBar = tree[0]?.children?.find(
    node => node.title === '书签栏' || node.title === 'Bookmarks Bar'
  )
  return bookmarksBar?.id || '1'
}

async function resolveFolderId(bookmarkData: AutoAddBookmarkData): Promise<{
  folderId: string
  folderPath: string
  aiUsed: boolean
}> {
  let recommendations = await getFolderRecommendations(
    bookmarkData.title,
    bookmarkData.url,
    1,
    0.1 // 使用正常的阈值
  )

  // 推荐为空时，检查是否为文件夹向量未就绪，尝试同步后重试一次
  if (recommendations.length === 0) {
    const folderVectorCount = await folderVectorStore.count()
    if (folderVectorCount === 0) {
      logger.info('AutoAddBookmark', '文件夹向量为空，通过 Offscreen 同步后重试')
      await dispatchOffscreenRequest<{ success: boolean }>(
        { type: 'SYNC_FOLDER_VECTORS' },
        { timeout: 300_000 }
      )
      recommendations = await getFolderRecommendations(
        bookmarkData.title,
        bookmarkData.url,
        1,
        0.1
      )
    }
  }

  if (recommendations.length > 0) {
    const topRecommendation = recommendations[0]
    if (topRecommendation) {
      return {
        folderId: topRecommendation.folderId,
        folderPath: topRecommendation.folderPath,
        aiUsed: true
      }
    }
  }

  const folderId = await getBookmarksBarId()
  const folderPath = await getFolderPath(folderId)
  return { folderId, folderPath, aiUsed: false }
}

export async function autoAddBookmark(
  bookmarkData: AutoAddBookmarkData
): Promise<AutoAddBookmarkResult> {
  try {
    if (!bookmarkData.url || bookmarkData.url.trim() === '') {
      return { success: false, error: 'URL 不能为空' }
    }

    const { folderId, folderPath, aiUsed } = await resolveFolderId(bookmarkData)

    const bookmark = await chrome.bookmarks.create({
      parentId: folderId,
      title: bookmarkData.title || bookmarkData.url,
      url: bookmarkData.url
    })

    logger.info('AutoAddBookmark', '✅ 书签自动添加成功', {
      bookmarkId: bookmark.id,
      folderId,
      folderPath,
      aiUsed
    })

    return {
      success: true,
      bookmarkId: bookmark.id,
      folderId,
      folderPath,
      aiUsed
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('AutoAddBookmark', '❌ 书签自动添加失败', error)
    return {
      success: false,
      error: errorMessage
    }
  }
}
