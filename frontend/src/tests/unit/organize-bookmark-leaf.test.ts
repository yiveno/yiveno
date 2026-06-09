import { describe, expect, it } from 'vitest'
import { isOrganizeBookmarkLeaf } from '@/core/bookmark/organize-bookmark-leaf'
import type { BookmarkNode } from '@/types'

describe('organize-bookmark-leaf', () => {
  it('空 URL 仍视为书签叶子', () => {
    const node: BookmarkNode = {
      id: 'no-url',
      title: '无链接',
      url: ''
    }
    expect(isOrganizeBookmarkLeaf(node)).toBe(true)
  })

  it('文件夹无 url 字段则不是书签叶子', () => {
    const folder: BookmarkNode = {
      id: 'folder-1',
      title: '目录',
      children: []
    }
    expect(isOrganizeBookmarkLeaf(folder)).toBe(false)
  })
})
