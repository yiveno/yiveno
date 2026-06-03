/**
 * 书签树结构转换单元测试
 *
 * 测试目标：bookmark-tree-store.ts 中的真实树扁平化函数
 */

import { describe, it, expect } from 'vitest'
import { flattenBookmarkTreeToMap } from '@/stores/bookmark-tree-store'
import { createMockBookmark, createMockFolder } from '../setup'

// 包装函数，返回 Map（与原测试兼容）
function flattenTreeToMapWrapper(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): Map<string, chrome.bookmarks.BookmarkTreeNode> {
  const map = new Map<string, chrome.bookmarks.BookmarkTreeNode>()
  flattenBookmarkTreeToMap(nodes, map)
  return map
}

describe('书签树结构转换', () => {
  it('应该正确转换扁平书签列表', () => {
    const bookmarks = [
      createMockBookmark({ id: '1', title: 'Bookmark 1' }),
      createMockBookmark({ id: '2', title: 'Bookmark 2' })
    ]

    const map = flattenTreeToMapWrapper(bookmarks)

    expect(map.size).toBe(2)
    expect(map.get('1')?.title).toBe('Bookmark 1')
    expect(map.get('2')?.title).toBe('Bookmark 2')
  })

  it('应该正确处理嵌套文件夹', () => {
    const tree = [
      createMockFolder({
        id: 'folder-1',
        title: 'Folder 1',
        children: [createMockBookmark({ id: 'bookmark-1', title: 'Nested Bookmark' })]
      })
    ]

    const map = flattenTreeToMapWrapper(tree)

    expect(map.size).toBe(2) // 1 folder + 1 bookmark
    expect(map.get('folder-1')?.title).toBe('Folder 1')
    expect(map.get('bookmark-1')?.title).toBe('Nested Bookmark')
  })

  it('应该正确处理空树', () => {
    const map = flattenTreeToMapWrapper([])
    expect(map.size).toBe(0)
  })

  it('应该正确处理深层嵌套（性能测试）', () => {
    // 创建 5 层嵌套，每层 10 个节点
    const createDeepTree = (
      depth: number,
      breadth: number
    ): chrome.bookmarks.BookmarkTreeNode[] => {
      if (depth === 0) {
        return Array.from({ length: breadth }, (_, i) =>
          createMockBookmark({ id: `leaf-${depth}-${i}` })
        )
      }

      return Array.from({ length: breadth }, (_, i) =>
        createMockFolder({
          id: `folder-${depth}-${i}`,
          children: createDeepTree(depth - 1, breadth)
        })
      )
    }

    const tree = createDeepTree(5, 10)

    const start = performance.now()
    const map = flattenTreeToMapWrapper(tree)
    const duration = performance.now() - start

    // 修正期望值：5层嵌套，每层10个节点
    // 第5层: 10个文件夹
    // 第4层: 10个文件夹
    // 第3层: 10个文件夹
    // 第2层: 10个文件夹
    // 第1层: 10个文件夹
    // 第0层: 10个书签
    // 总计: 50个文件夹 + 10个书签 = 60个节点
    expect(map.size).toBe(60)

    // 性能要求：处理应该在 100ms 内
    expect(duration).toBeLessThan(100)
  })
})
