import { describe, it, expect } from 'vitest'
import {
  BOOKMARKS_BAR_ID,
  detectInvalidRootLayerNodes,
  isInvalidRootLayerNode,
  isVirtualBookmarkRootId,
  normalizeWritableBookmarkParentId
} from '@/core/bookmark/chrome-system-ids'

describe('chrome-system-ids', () => {
  describe('isVirtualBookmarkRootId', () => {
    it.each(['root', 'virtual-root', '0', undefined] as const)('应将 %s 识别为虚拟根', parentId => {
      expect(isVirtualBookmarkRootId(parentId)).toBe(true)
    })

    it('普通文件夹 ID 不应视为虚拟根', () => {
      expect(isVirtualBookmarkRootId('1')).toBe(false)
      expect(isVirtualBookmarkRootId('42')).toBe(false)
    })
  })

  describe('normalizeWritableBookmarkParentId', () => {
    it.each(['root', 'virtual-root', '0', undefined] as const)('应将 %s 归一到书签栏', parentId => {
      expect(normalizeWritableBookmarkParentId(parentId)).toBe(BOOKMARKS_BAR_ID)
    })

    it('应保留合法 Chrome parentId', () => {
      expect(normalizeWritableBookmarkParentId('42')).toBe('42')
      expect(normalizeWritableBookmarkParentId('2')).toBe('2')
    })

    it('遇到 temp_* 应抛出明确错误', () => {
      expect(() => normalizeWritableBookmarkParentId('temp_ai_1')).toThrow(
        '目标文件夹尚未创建: temp_ai_1'
      )
    })
  })

  describe('detectInvalidRootLayerNodes', () => {
    it('应识别 parentId=0 的普通节点', () => {
      const invalid = detectInvalidRootLayerNodes([
        { id: '1', title: '书签栏', parentId: '0' },
        { id: '99', title: '散落书签', parentId: '0', url: 'https://example.com' }
      ])

      expect(invalid).toEqual([{ id: '99', title: '散落书签', parentId: '0' }])
    })

    it('系统根目录 1/2/3 不应被判定为异常', () => {
      expect(isInvalidRootLayerNode('1', '0')).toBe(false)
      expect(isInvalidRootLayerNode('2', '0')).toBe(false)
      expect(isInvalidRootLayerNode('3', '0')).toBe(false)
    })
  })
})
