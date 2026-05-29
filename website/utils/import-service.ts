/**
 * 导入服务 - 官网版本
 * 用于将分享的书签导入到 Chrome 浏览器
 */

/**
 * Chrome Bookmarks API 接口
 */
interface ChromeBookmarksAPI {
  create: (
    bookmark: {
      parentId?: string
      title: string
      url?: string
      index?: number
    },
    callback?: (result: ChromeBookmarkNode) => void
  ) => void
  getTree: (callback: (results: ChromeBookmarkNode[]) => void) => void
}

/**
 * Chrome Runtime API 接口
 */
interface ChromeRuntimeAPI {
  lastError?: { message: string }
}

/**
 * Chrome API 接口
 */
interface ChromeAPI {
  bookmarks?: ChromeBookmarksAPI
  runtime?: ChromeRuntimeAPI
}

/**
 * Chrome 书签节点
 */
interface ChromeBookmarkNode {
  id: string
  parentId?: string
  index?: number
  url?: string
  title: string
  dateAdded?: number
  dateGroupModified?: number
  children?: ChromeBookmarkNode[]
}

/**
 * 导入选项
 */
export interface ImportOptions {
  /** 书签列表 */
  bookmarks: Array<{ title: string; url: string; description?: string }>
  /** 目标文件夹 ID */
  targetFolderId: string
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void
}

/**
 * 导入结果
 */
export interface ImportResult {
  /** 成功数量 */
  success: number
  /** 失败数量 */
  failed: number
  /** 错误列表 */
  errors: Array<{ bookmark: string; error: string }>
}

/**
 * 文件夹树节点（简化版）
 */
export interface FolderNode {
  id: string
  title: string
  parentId?: string
  children?: FolderNode[]
}

/**
 * 导入服务类
 */
class ImportService {
  /**
   * 获取 Chrome API
   */
  private getChromeAPI(): ChromeAPI | null {
    if (typeof window === 'undefined') {
      return null
    }

    const chrome = (window as unknown as { chrome?: ChromeAPI }).chrome
    if (!chrome || !chrome.bookmarks) {
      return null
    }

    return chrome
  }

  /**
   * 获取书签文件夹树
   * @returns Promise<FolderNode[]> 文件夹树
   */
  async getFolderTree(): Promise<FolderNode[]> {
    const chrome = this.getChromeAPI()
    if (!chrome || !chrome.bookmarks) {
      throw new Error('浏览器不支持 Chrome Bookmarks API')
    }

    return new Promise((resolve, reject) => {
      chrome.bookmarks!.getTree(results => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }

        // 递归提取文件夹节点
        const extractFolders = (node: ChromeBookmarkNode): FolderNode[] => {
          const folders: FolderNode[] = []

          // 如果当前节点是文件夹（没有 url）
          if (!node.url) {
            const folder: FolderNode = {
              id: node.id,
              title: node.title,
              parentId: node.parentId
            }

            // 递归处理子节点
            if (node.children) {
              const childFolders: FolderNode[] = []
              for (const child of node.children) {
                childFolders.push(...extractFolders(child))
              }
              if (childFolders.length > 0) {
                folder.children = childFolders
              }
            }

            folders.push(folder)
          }

          return folders
        }

        const folderTree = results.flatMap(extractFolders)
        resolve(folderTree)
      })
    })
  }

  /**
   * 获取默认文件夹 ID（书签栏）
   * @returns Promise<string> 默认文件夹 ID
   */
  async getDefaultFolderId(): Promise<string> {
    const tree = await this.getFolderTree()

    // 查找书签栏（通常 ID 为 "1"）
    const findBookmarksBar = (nodes: FolderNode[]): string | null => {
      for (const node of nodes) {
        // Chrome 的书签栏通常 ID 为 "1"
        if (node.id === '1') {
          return node.id
        }
        // 或者标题为 "书签栏" / "Bookmarks Bar"
        if (
          node.title === '书签栏' ||
          node.title === 'Bookmarks Bar' ||
          node.title === 'Bookmarks bar'
        ) {
          return node.id
        }
        // 递归查找子节点
        if (node.children) {
          const found = findBookmarksBar(node.children)
          if (found) return found
        }
      }
      return null
    }

    const bookmarksBarId = findBookmarksBar(tree)
    if (bookmarksBarId) {
      return bookmarksBarId
    }

    // 如果找不到书签栏，返回第一个根节点的第一个子节点
    if (tree.length > 0) {
      const firstNode = tree[0]
      if (firstNode?.children && firstNode.children.length > 0) {
        const firstChild = firstNode.children[0]
        if (firstChild?.id) {
          return firstChild.id
        }
      }
    }

    throw new Error('无法找到默认文件夹')
  }

  /**
   * 批量导入书签
   * @param options 导入选项
   * @returns Promise<ImportResult> 导入结果
   */
  async importBookmarks(options: ImportOptions): Promise<ImportResult> {
    const chrome = this.getChromeAPI()
    if (!chrome || !chrome.bookmarks) {
      throw new Error('浏览器不支持 Chrome Bookmarks API')
    }

    const { bookmarks, targetFolderId, onProgress } = options
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: []
    }

    // 分批导入（每批 10 个，避免阻塞 UI）
    const BATCH_SIZE = 10
    const total = bookmarks.length

    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE)

      // 导入当前批次
      for (const bookmark of batch) {
        try {
          await this.createBookmark({
            parentId: targetFolderId,
            title: bookmark.title,
            url: bookmark.url
          })

          result.success++
        } catch (error) {
          result.failed++
          result.errors.push({
            bookmark: bookmark.title,
            error: error instanceof Error ? error.message : String(error)
          })
        }

        // 更新进度
        if (onProgress) {
          onProgress(result.success + result.failed, total)
        }
      }

      // 让出主线程（避免阻塞 UI）
      if (i + BATCH_SIZE < bookmarks.length) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    return result
  }

  /**
   * 创建单个书签
   * @param bookmark 书签信息
   * @returns Promise<ChromeBookmarkNode> 创建的书签节点
   */
  private async createBookmark(bookmark: {
    parentId: string
    title: string
    url: string
  }): Promise<ChromeBookmarkNode> {
    const chrome = this.getChromeAPI()
    if (!chrome || !chrome.bookmarks) {
      throw new Error('浏览器不支持 Chrome Bookmarks API')
    }

    return new Promise((resolve, reject) => {
      chrome.bookmarks!.create(
        {
          parentId: bookmark.parentId,
          title: bookmark.title,
          url: bookmark.url
        },
        result => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(result)
          }
        }
      )
    })
  }
}

/**
 * 导入服务单例
 */
export const importService = new ImportService()
