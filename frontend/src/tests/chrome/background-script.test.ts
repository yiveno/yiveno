/**
 * Background Script 测试
 *
 * 测试目标：
 * 1. Chrome API 调用
 * 2. 消息传递
 * 3. 书签同步逻辑
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockBookmark } from '../setup'

interface BookmarkTreeNode {
  id: string
  title: string
  url?: string
  children?: BookmarkTreeNode[]
}

interface Message {
  type: string
  payload?: Record<string, unknown>
}

type MessageHandler = (
  payload?: Record<string, unknown>
) => void | Promise<void | chrome.bookmarks.BookmarkTreeNode>

// 模拟 Background Script 的核心逻辑
class BookmarkSyncManager {
  private listeners: Map<string, MessageHandler[]> = new Map()

  async syncBookmarks() {
    // 1. 从 Chrome API 获取书签
    const tree = await chrome.bookmarks.getTree()

    // 2. 转换为扁平结构
    const bookmarks = this.flattenTree(tree)

    // 3. 保存到 IndexedDB
    await this.saveToIndexedDB(bookmarks)

    return bookmarks
  }

  private flattenTree(nodes: BookmarkTreeNode[]): BookmarkTreeNode[] {
    const result: BookmarkTreeNode[] = []

    const walk = (node: BookmarkTreeNode) => {
      if (node.url) {
        result.push(node)
      }
      if (node.children) {
        node.children.forEach(walk)
      }
    }

    nodes.forEach(walk)
    return result
  }

  private async saveToIndexedDB(_bookmarks: BookmarkTreeNode[]) {
    // 模拟 IndexedDB 保存
    return Promise.resolve()
  }

  onMessage(type: string, handler: MessageHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, [])
    }
    this.listeners.get(type)!.push(handler)
  }

  async handleMessage(message: Message) {
    const handlers = this.listeners.get(message.type) || []
    for (const handler of handlers) {
      await handler(message.payload)
    }
  }
}

describe('Background Script - 书签同步', () => {
  let syncManager: BookmarkSyncManager

  beforeEach(() => {
    syncManager = new BookmarkSyncManager()

    // Mock chrome.bookmarks.getTree
    const mockTree: chrome.bookmarks.BookmarkTreeNode[] = [
      {
        id: '0',
        title: 'Root',
        children: [
          createMockBookmark({
            id: '1',
            title: 'Bookmark 1'
          }) as chrome.bookmarks.BookmarkTreeNode,
          {
            id: '2',
            title: 'Folder 1',
            children: [
              createMockBookmark({
                id: '3',
                title: 'Nested Bookmark'
              }) as chrome.bookmarks.BookmarkTreeNode
            ]
          } as chrome.bookmarks.BookmarkTreeNode
        ]
      } as chrome.bookmarks.BookmarkTreeNode
    ]
    // @ts-expect-error - Mock 类型定义问题
    vi.mocked(chrome.bookmarks.getTree).mockResolvedValue(mockTree)
  })

  it('应该能够同步书签到 IndexedDB', async () => {
    const bookmarks = await syncManager.syncBookmarks()

    // 应该调用了 chrome.bookmarks.getTree
    expect(chrome.bookmarks.getTree).toHaveBeenCalled()

    // 应该返回扁平化的书签列表（不包含文件夹）
    expect(bookmarks).toHaveLength(2)
    expect(bookmarks[0]).toBeDefined()
    expect(bookmarks[1]).toBeDefined()
    expect(bookmarks[0]!.id).toBe('1')
    expect(bookmarks[1]!.id).toBe('3')
  })

  it('应该能够处理来自前端的消息', async () => {
    const handler = vi.fn()
    syncManager.onMessage('GET_BOOKMARKS', handler)

    await syncManager.handleMessage({
      type: 'GET_BOOKMARKS',
      payload: { folderId: '1' }
    })

    expect(handler).toHaveBeenCalledWith({ folderId: '1' })
  })

  it('应该能够监听书签变化', async () => {
    const onCreatedHandler = vi.fn()

    // 注册监听器
    chrome.bookmarks.onCreated.addListener(onCreatedHandler)

    // 模拟书签创建
    const newBookmark = createMockBookmark({
      id: '999',
      title: 'New Bookmark'
    }) as chrome.bookmarks.BookmarkTreeNode

    // 触发 onCreated 事件
    const listeners = vi.mocked(chrome.bookmarks.onCreated.addListener).mock.calls
    expect(listeners[0]).toBeDefined()
    const registeredHandler = listeners[0]![0]
    registeredHandler('999', newBookmark)

    expect(onCreatedHandler).toHaveBeenCalledWith('999', newBookmark)
  })
})

describe('Background Script - 消息传递', () => {
  it('应该能够响应前端的 CREATE_BOOKMARK 消息', async () => {
    const syncManager = new BookmarkSyncManager()

    // Mock chrome.bookmarks.create
    const mockBookmark = createMockBookmark({
      id: '999',
      title: 'New Bookmark'
    }) as chrome.bookmarks.BookmarkTreeNode
    // @ts-expect-error - Mock 类型定义问题
    vi.mocked(chrome.bookmarks.create).mockResolvedValue(mockBookmark)

    // 注册消息处理器
    syncManager.onMessage('CREATE_BOOKMARK', async (payload?: Record<string, unknown>) => {
      return await chrome.bookmarks.create(payload as chrome.bookmarks.CreateDetails)
    })

    // 发送消息
    await syncManager.handleMessage({
      type: 'CREATE_BOOKMARK',
      payload: {
        title: 'New Bookmark',
        url: 'https://example.com'
      }
    })

    // 验证 chrome.bookmarks.create 被调用
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      title: 'New Bookmark',
      url: 'https://example.com'
    })
  })
})
