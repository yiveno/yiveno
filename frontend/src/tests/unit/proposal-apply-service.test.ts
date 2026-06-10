import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BookmarkOperation } from '@/application/bookmark/bookmark-diff-service'
import {
  ProposalApplyService,
  resolveProposalParentId,
  sortOperationsForApply
} from '@/application/bookmark/proposal-apply-service'

describe('proposal-apply-service', () => {
  describe('sortOperationsForApply', () => {
    it('应先创建父临时文件夹再创建子临时文件夹', () => {
      const operations: BookmarkOperation[] = [
        {
          type: 'create',
          nodeId: 'temp_child',
          title: '子文件夹',
          isFolder: true,
          parentId: 'temp_parent',
          index: 0
        },
        {
          type: 'create',
          nodeId: 'temp_parent',
          title: '父文件夹',
          isFolder: true,
          parentId: '1',
          index: 0
        },
        {
          type: 'delete',
          nodeId: 'bm-old',
          title: '旧书签',
          isFolder: false,
          parentId: '1'
        },
        {
          type: 'move',
          nodeId: 'bm-1',
          title: '移动书签',
          isFolder: false,
          fromParentId: '1',
          toParentId: 'temp_parent',
          fromIndex: 0,
          toIndex: 0,
          isSameParent: false
        }
      ]

      const sorted = sortOperationsForApply(operations)

      expect(sorted.map(op => op.nodeId)).toEqual(['temp_parent', 'temp_child', 'bm-1', 'bm-old'])
    })

    it('同级非文件夹 create 应排在 move 之后、delete 之前', () => {
      const operations: BookmarkOperation[] = [
        {
          type: 'delete',
          nodeId: 'bm-del',
          title: '删除',
          isFolder: false,
          parentId: '1'
        },
        {
          type: 'create',
          nodeId: 'bm-new',
          title: '新建',
          isFolder: false,
          parentId: '1',
          index: 0,
          url: 'https://example.com'
        },
        {
          type: 'move',
          nodeId: 'bm-move',
          title: '移动',
          isFolder: false,
          fromParentId: '1',
          toParentId: '2',
          fromIndex: 0,
          toIndex: 0,
          isSameParent: false
        },
        {
          type: 'edit',
          nodeId: 'bm-edit',
          title: '编辑',
          isFolder: false,
          oldTitle: '旧',
          newTitle: '新'
        }
      ]

      const sorted = sortOperationsForApply(operations)
      const types = sorted.map(op => op.type)

      expect(types).toEqual(['move', 'edit', 'create', 'delete'])
    })

    it('同父级新建文件夹应按目标 index 排序', () => {
      const operations: BookmarkOperation[] = [
        {
          type: 'create',
          nodeId: 'temp_later',
          title: '后建',
          isFolder: true,
          parentId: '1',
          index: 3
        },
        {
          type: 'create',
          nodeId: 'temp_first',
          title: '先建',
          isFolder: true,
          parentId: '1',
          index: 1
        }
      ]

      const sorted = sortOperationsForApply(operations)

      expect(sorted.map(op => op.nodeId)).toEqual(['temp_first', 'temp_later'])
    })
  })

  describe('resolveProposalParentId', () => {
    it('应将 temp 父 ID 映射为 Chrome 真实 ID', () => {
      const tempIdMap = new Map([['temp_parent', 'real-folder-id']])

      expect(resolveProposalParentId('temp_parent', tempIdMap)).toBe('real-folder-id')
    })
  })

  describe('ProposalApplyService.applyOperations', () => {
    const sendMessage = vi.fn()
    let service: ProposalApplyService

    beforeEach(() => {
      service = new ProposalApplyService()
      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: sendMessage,
          lastError: undefined
        }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      sendMessage.mockReset()
    })

    it('应按序发送 Chrome 消息并在失败时中止', async () => {
      sendMessage.mockImplementation(
        (message: { type: string; data?: unknown }, callback: (response: unknown) => void) => {
          if (message.type === 'UPDATE_BOOKMARK') {
            callback({ success: false, error: '更新失败' })
            return
          }
          callback({ success: true })
        }
      )

      const operations: BookmarkOperation[] = [
        {
          type: 'edit',
          nodeId: 'bm-1',
          title: 'A',
          isFolder: false,
          oldTitle: 'A',
          newTitle: 'B'
        },
        {
          type: 'delete',
          nodeId: 'bm-2',
          title: 'B',
          isFolder: false,
          parentId: '1'
        }
      ]

      const progressCalls: number[] = []
      const result = await service.applyOperations(operations, {
        onProgress: progress => {
          progressCalls.push(progress.current)
        },
        batchDelayMs: 0
      })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toBe('更新失败')
      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(progressCalls).toEqual([1])
    })

    it('成功时应映射临时文件夹并创建书签', async () => {
      sendMessage.mockImplementation(
        (message: { type: string; data?: unknown }, callback: (response: unknown) => void) => {
          if (message.type === 'CREATE_FOLDER') {
            callback({ success: true, folderId: 'chrome-folder-9' })
            return
          }
          if (message.type === 'CREATE_BOOKMARK') {
            callback({ success: true })
            return
          }
          callback({ success: true })
        }
      )

      const operations: BookmarkOperation[] = [
        {
          type: 'create',
          nodeId: 'temp_ai_1',
          title: '新文件夹',
          isFolder: true,
          parentId: '1',
          index: 0
        },
        {
          type: 'create',
          nodeId: 'bm-new',
          title: '新书签',
          isFolder: false,
          parentId: 'temp_ai_1',
          index: 0,
          url: 'https://example.com'
        }
      ]

      const result = await service.applyOperations(operations, { batchDelayMs: 0 })

      expect(result.success).toBe(true)
      expect(sendMessage).toHaveBeenCalledTimes(2)

      const createBookmarkCall = sendMessage.mock.calls.find(
        ([message]) => (message as { type: string }).type === 'CREATE_BOOKMARK'
      )
      expect(createBookmarkCall?.[0]).toMatchObject({
        type: 'CREATE_BOOKMARK',
        data: {
          parentId: 'chrome-folder-9',
          title: '新书签',
          url: 'https://example.com'
        }
      })
    })

    it('新建临时文件夹应使用提案目标 index', async () => {
      sendMessage.mockImplementation(
        (message: { type: string; data?: unknown }, callback: (response: unknown) => void) => {
          if (message.type === 'CREATE_FOLDER') {
            callback({ success: true, folderId: 'chrome-folder-22' })
            return
          }
          callback({ success: true })
        }
      )

      const operations: BookmarkOperation[] = [
        {
          type: 'create',
          nodeId: 'temp_manual_1',
          title: '22',
          isFolder: true,
          parentId: 'tech',
          index: 3
        }
      ]

      const result = await service.applyOperations(operations, { batchDelayMs: 0 })

      expect(result.success).toBe(true)
      expect(sendMessage).toHaveBeenCalledWith(
        {
          type: 'CREATE_FOLDER',
          data: {
            title: '22',
            parentId: 'tech',
            index: 3
          }
        },
        expect.any(Function)
      )
    })
  })
})
