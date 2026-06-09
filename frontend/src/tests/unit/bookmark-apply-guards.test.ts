import { describe, it, expect } from 'vitest'
import {
  BOOKMARKS_BAR_ID,
  normalizeWritableBookmarkParentId
} from '@/core/bookmark/chrome-system-ids'
import {
  buildTempFolderChildrenMap,
  findRecentFolderInTree,
  isTransientMessageError,
  markFailedTempSubtree,
  operationDependsOnFailedTemp
} from '@/application/bookmark/bookmark-apply-guards'
import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'

describe('bookmark-apply-guards', () => {
  describe('MOVE_BOOKMARK parentId 防护（通过归一化函数）', () => {
    it('parentId=0 时实际应落到书签栏', () => {
      expect(normalizeWritableBookmarkParentId('0')).toBe(BOOKMARKS_BAR_ID)
    })
  })

  describe('CREATE_FOLDER temp parent 防护', () => {
    it('parentId=temp_* 时不应调用 Chrome API（抛出错误）', () => {
      expect(() => normalizeWritableBookmarkParentId('temp_folder_1')).toThrow(/目标文件夹尚未创建/)
    })
  })

  describe('临时文件夹失败阻断', () => {
    const operations: BookmarkOperation[] = [
      {
        type: 'create',
        nodeId: 'temp_ai_1',
        title: '父文件夹',
        isFolder: true,
        parentId: '1',
        index: 0
      },
      {
        type: 'create',
        nodeId: 'temp_ai_2',
        title: '子文件夹',
        isFolder: true,
        parentId: 'temp_ai_1',
        index: 0
      },
      {
        type: 'create',
        nodeId: 'bm-new',
        title: '新书签',
        isFolder: false,
        parentId: 'temp_ai_2',
        index: 0,
        url: 'https://example.com'
      },
      {
        type: 'move',
        nodeId: 'bm-1',
        title: '移动书签',
        isFolder: false,
        fromParentId: '1',
        toParentId: 'temp_ai_1',
        fromIndex: 0,
        toIndex: 0,
        isSameParent: false
      }
    ]

    it('父临时文件夹失败后应阻断子文件夹、子书签和移动操作', () => {
      const childrenMap = buildTempFolderChildrenMap(operations)
      const failedTempIds = new Set<string>()
      markFailedTempSubtree('temp_ai_1', childrenMap, failedTempIds)

      expect(failedTempIds.has('temp_ai_1')).toBe(true)
      expect(failedTempIds.has('temp_ai_2')).toBe(true)
      expect(operationDependsOnFailedTemp(operations[1]!, failedTempIds)).toBe(true)
      expect(operationDependsOnFailedTemp(operations[2]!, failedTempIds)).toBe(true)
      expect(operationDependsOnFailedTemp(operations[3]!, failedTempIds)).toBe(true)
      expect(operationDependsOnFailedTemp(operations[0]!, failedTempIds)).toBe(false)
    })
  })

  describe('findRecentFolderInTree', () => {
    it('应回查到同父同名的近期文件夹', () => {
      const since = Date.now()
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: '书签栏',
          parentId: '0',
          children: [
            {
              id: 'folder-99',
              title: 'AI 分类',
              parentId: '1',
              dateAdded: since
            }
          ]
        }
      ]

      const found = findRecentFolderInTree(tree, '1', 'AI 分类', since)
      expect(found?.id).toBe('folder-99')
    })

    it('响应丢失场景：回查成功后应能继续映射 temp 文件夹', () => {
      const since = Date.now()
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: '书签栏',
          parentId: '0',
          children: [
            {
              id: 'real-folder-id',
              title: '整理后',
              parentId: '1',
              dateAdded: since
            }
          ]
        }
      ]

      const recovered = findRecentFolderInTree(tree, '1', '整理后', since)
      expect(recovered?.id).toBe('real-folder-id')

      const tempIdMap = new Map<string, string>()
      if (recovered) {
        tempIdMap.set('temp_ai_1', recovered.id)
      }
      const resolvedParent = normalizeWritableBookmarkParentId(
        tempIdMap.get('temp_ai_1') ?? 'temp_ai_1'
      )
      expect(resolvedParent).toBe('real-folder-id')
    })
  })

  describe('isTransientMessageError', () => {
    it('应识别 message port closed 等瞬时错误', () => {
      expect(
        isTransientMessageError('The message port closed before a response was received.')
      ).toBe(true)
      expect(isTransientMessageError('普通业务错误')).toBe(false)
    })
  })
})
