import { describe, expect, it } from 'vitest'
import type { BookmarkNode } from '@/types'
import {
  collectExpandableFolderIds,
  collectRootFolderIds
} from '@/application/bookmark/management-expanded-state-service'
import { prepareProposalTreeNodes } from '@/application/bookmark/proposal-tree-prepare'
import {
  getProposalPanelIcon,
  getProposalPanelTitle
} from '@/application/bookmark/management-proposal-ui'

describe('management-expanded-state-service', () => {
  const sampleTree: BookmarkNode[] = [
    {
      id: 'folder-a',
      title: 'A',
      children: [
        { id: 'bm-1', title: 'Link', url: 'https://example.com' },
        {
          id: 'folder-b',
          title: 'B',
          children: [{ id: 'bm-2', title: 'Nested', url: 'https://nested.example' }]
        }
      ]
    }
  ]

  it('collectExpandableFolderIds 应只收集文件夹', () => {
    expect(collectExpandableFolderIds(sampleTree)).toEqual(['folder-a', 'folder-b'])
  })

  it('collectRootFolderIds 应返回根层 ID', () => {
    expect(collectRootFolderIds(sampleTree)).toEqual(['folder-a'])
  })
})

describe('proposal-tree-prepare', () => {
  it('prepareProposalTreeNodes 应标记节点为已加载', () => {
    const nodes: BookmarkNode[] = [
      {
        id: 1,
        title: 'Root',
        children: [{ id: 'child', title: 'Child', url: 'https://example.com' }]
      }
    ]

    const prepared = prepareProposalTreeNodes(nodes)

    expect(prepared[0]?.id).toBe('1')
    expect(prepared[0]?._childrenLoaded).toBe(true)
    expect(prepared[0]?.children?.[0]?._childrenLoaded).toBe(true)
    expect(prepared[0]?.children?.[0]?.children).toEqual([])
  })
})

describe('management-proposal-ui', () => {
  it('应根据 AI 标记返回面板文案与图标', () => {
    expect(getProposalPanelTitle(true)).toBe('AI 整理建议')
    expect(getProposalPanelTitle(false)).toBe('整理建议')
    expect(getProposalPanelIcon(true)).toBe('sparkles')
    expect(getProposalPanelIcon(false)).toBe('zap')
  })
})
