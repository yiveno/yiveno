import { describe, expect, it } from 'vitest'
import { countBookmarkLeaves, pruneBookmarkTree } from '@/core/filter/tree-prune'
import type { BookmarkNode } from '@/types'

function makeTree(): BookmarkNode[] {
  return [
    {
      id: 'folder-music',
      title: '音乐',
      parentId: '0',
      children: [
        {
          id: 'bm-1',
          title: '网易云',
          url: 'https://music.163.com',
          parentId: 'folder-music'
        }
      ]
    },
    {
      id: 'bm-2',
      title: 'GitHub',
      url: 'https://github.com',
      parentId: '0'
    }
  ]
}

describe('tree-prune', () => {
  it('按书签 ID 裁剪并保留祖先路径', () => {
    const pruned = pruneBookmarkTree(makeTree(), {
      matchedBookmarkIds: new Set(['bm-1'])
    })

    expect(pruned).toHaveLength(1)
    expect(pruned[0]?.id).toBe('folder-music')
    expect(pruned[0]?.children).toHaveLength(1)
    expect(pruned[0]?.children?.[0]?.id).toBe('bm-1')
  })

  it('按文件夹标题补充匹配提案侧新文件夹', () => {
    const pruned = pruneBookmarkTree(makeTree(), {
      matchedBookmarkIds: new Set(),
      folderTitleQuery: '音乐'
    })

    expect(pruned).toHaveLength(1)
    expect(pruned[0]?.id).toBe('folder-music')
  })

  it('统计叶子书签数量', () => {
    const pruned = pruneBookmarkTree(makeTree(), {
      matchedBookmarkIds: new Set(['bm-1', 'bm-2'])
    })

    expect(countBookmarkLeaves(pruned)).toBe(2)
  })

  it('祖先文件夹仅保留命中的子节点，不泄漏原始 children 引用', () => {
    const tree: BookmarkNode[] = [
      {
        id: 'bar',
        title: '书签栏',
        children: [
          {
            id: 'shop',
            title: '购物',
            children: [
              {
                id: 'taobao',
                title: '淘宝网',
                url: 'https://www.taobao.com'
              },
              {
                id: 'jd',
                title: '京东',
                url: 'https://www.jd.com'
              }
            ]
          },
          {
            id: 'dev',
            title: '技术开发',
            children: [
              {
                id: 'github',
                title: 'GitHub',
                url: 'https://github.com'
              }
            ]
          }
        ]
      }
    ]

    const pruned = pruneBookmarkTree(tree, {
      matchedBookmarkIds: new Set(['taobao'])
    })

    expect(pruned).toHaveLength(1)
    expect(pruned[0]?.children).toHaveLength(1)
    expect(pruned[0]?.children?.[0]?.id).toBe('shop')
    expect(pruned[0]?.children?.[0]?.children).toHaveLength(1)
    expect(pruned[0]?.children?.[0]?.children?.[0]?.id).toBe('taobao')
    expect(countBookmarkLeaves(pruned)).toBe(1)
  })
})
