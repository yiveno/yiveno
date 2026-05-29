/**
 * 性能基准测试
 *
 * 测试目标：
 * 1. 大量数据处理性能
 * 2. 搜索性能
 * 3. 渲染性能
 */

import { describe, it, expect } from 'vitest'
import { createMockBookmark, createMockFolder } from '../setup'

// 临时实现用于测试
function flattenTreeToMap(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()

  const walk = (node: chrome.bookmarks.BookmarkTreeNode) => {
    if (!node) return
    map.set(node.id, node)
    if (node.children) {
      node.children.forEach(walk)
    }
  }

  nodes.forEach(walk)
  return map
}

interface Bookmark {
  id: string
  title: string
  url?: string
}

class SearchAppService {
  private bookmarks: Bookmark[] = []

  indexBookmarks(bookmarks: Bookmark[]) {
    this.bookmarks = bookmarks
  }

  search(query: string): Bookmark[] {
    const lowerQuery = query.toLowerCase()
    return this.bookmarks.filter(b => b.title.toLowerCase().includes(lowerQuery))
  }
}

const searchAppService = new SearchAppService()

describe('性能基准测试', () => {
  it('处理 2 万书签应该在 200ms 内', () => {
    const bookmarks = Array.from({ length: 20000 }, (_, i) =>
      createMockBookmark({ id: `bookmark-${i}`, title: `Bookmark ${i}` })
    )

    const start = performance.now()
    const map = flattenTreeToMap(bookmarks)
    const duration = performance.now() - start

    expect(map.size).toBe(20000)
    expect(duration).toBeLessThan(200)

    console.log(`✅ 处理 2 万书签耗时: ${duration.toFixed(2)}ms`)
  })

  it('搜索 2 万书签应该在 100ms 内', () => {
    const bookmarks = Array.from({ length: 20000 }, (_, i) =>
      createMockBookmark({
        id: `bookmark-${i}`,
        title: `${i % 2 === 0 ? 'Vue' : 'React'} Tutorial ${i}`
      })
    )

    searchAppService.indexBookmarks(bookmarks)

    const start = performance.now()
    const results = searchAppService.search('Vue')
    const duration = performance.now() - start

    expect(results.length).toBeGreaterThan(0)
    expect(duration).toBeLessThan(100)

    console.log(`✅ 搜索 2 万书签耗时: ${duration.toFixed(2)}ms`)
  })

  it('深层嵌套树（10 层）应该在 500ms 内处理', () => {
    const createDeepTree = (depth: number): chrome.bookmarks.BookmarkTreeNode => {
      if (depth === 0) {
        return createMockBookmark({
          id: `leaf-${depth}`
        }) as chrome.bookmarks.BookmarkTreeNode
      }

      return createMockFolder({
        id: `folder-${depth}`,
        children: [createDeepTree(depth - 1)]
      }) as chrome.bookmarks.BookmarkTreeNode
    }

    const tree = [createDeepTree(10)]

    const start = performance.now()
    const map = flattenTreeToMap(tree)
    const duration = performance.now() - start

    expect(map.size).toBe(11) // 10 folders + 1 bookmark
    expect(duration).toBeLessThan(500)

    console.log(`✅ 处理 10 层嵌套树耗时: ${duration.toFixed(2)}ms`)
  })

  it('内存使用测试：2 万书签应该小于 50MB', () => {
    const bookmarks = Array.from({ length: 20000 }, (_, i) =>
      createMockBookmark({
        id: `bookmark-${i}`,
        title: `Bookmark ${i}`,
        url: `https://example.com/${i}`
      })
    )

    // 获取初始内存
    const initialMemory =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ||
      0

    const map = flattenTreeToMap(bookmarks)

    // 获取处理后内存
    const finalMemory =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ||
      0

    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024 // MB

    expect(map.size).toBe(20000)

    // 如果浏览器支持 memory API
    if (initialMemory > 0) {
      expect(memoryUsed).toBeLessThan(50)
      console.log(`✅ 内存使用: ${memoryUsed.toFixed(2)}MB`)
    }
  })
})
