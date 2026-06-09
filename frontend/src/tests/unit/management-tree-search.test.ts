import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  pickSemanticSupplementIds,
  searchManagementTrees
} from '@/application/bookmark/management-tree-search'
import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import { ok } from '@/core/common/result'
import type { BookmarkNode } from '@/types'
import type { EnhancedSearchResult } from '@/core/query-engine'

vi.mock('@/application/query/bookmark-search-service', () => ({
  bookmarkSearchService: {
    searchWithMetadata: vi.fn()
  }
}))

const originalTree: BookmarkNode[] = [
  {
    id: 'f1',
    title: '工作',
    parentId: '0',
    children: [
      {
        id: 'b1',
        title: 'Vue Docs',
        url: 'https://vuejs.org',
        parentId: 'f1'
      }
    ]
  }
]

const proposalTree: BookmarkNode[] = [
  {
    id: 'f2',
    title: '前端',
    parentId: '0',
    children: [
      {
        id: 'b1',
        title: 'Vue Docs',
        url: 'https://vuejs.org',
        parentId: 'f2'
      }
    ]
  },
  {
    id: 'b2',
    title: '重复书签',
    url: 'https://example.com',
    parentId: '0',
    traitTags: ['duplicate']
  }
]

function makeSemanticResult(
  id: string,
  title: string,
  url: string,
  score: number
): EnhancedSearchResult {
  return {
    bookmark: {
      id,
      title,
      url,
      parentId: '0'
    },
    score,
    pathString: title,
    matchedFields: ['semantic'],
    highlights: {},
    relevanceFactors: {}
  }
}

describe('management-tree-search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空查询且无特征筛选时返回原树', async () => {
    const result = await searchManagementTrees({
      query: '',
      traitFilterIds: [],
      originalTree,
      proposalTree
    })

    expect(result.isLeftFiltered).toBe(false)
    expect(result.isRightFiltered).toBe(false)
    expect(result.leftTree).toBe(originalTree)
    expect(result.rightTree).toBe(proposalTree)
  })

  it('文本检索同步裁剪左右树', async () => {
    vi.mocked(bookmarkSearchService.searchWithMetadata).mockResolvedValue(
      ok({
        results: [
          {
            bookmark: {
              id: 'b1',
              title: 'Vue Docs',
              url: 'https://vuejs.org',
              parentId: 'f1'
            },
            score: 1,
            pathString: '工作/Vue Docs',
            matchedFields: ['title'],
            highlights: {},
            relevanceFactors: {}
          }
        ],
        metadata: {
          duration: 1,
          totalCount: 1,
          cacheHit: false,
          strategy: 'hybrid',
          query: 'vue'
        }
      })
    )

    const result = await searchManagementTrees({
      query: 'vue',
      traitFilterIds: [],
      originalTree,
      proposalTree
    })

    expect(bookmarkSearchService.searchWithMetadata).toHaveBeenCalled()
    expect(result.isLeftFiltered).toBe(true)
    expect(result.isRightFiltered).toBe(true)
    expect(result.leftMatchCount).toBe(1)
    expect(result.rightMatchCount).toBe(1)
  })

  it('过滤低相关语义噪声，仅保留文本命中与高分语义补充', async () => {
    const noisyTree: BookmarkNode[] = [
      {
        id: 'bar',
        title: '书签栏',
        children: [
          {
            id: 'cloud',
            title: '云服务',
            children: [
              {
                id: 'aliyun',
                title: '开年焕新，限时特惠',
                url: 'https://www.aliyun.com/minisite/goods'
              }
            ]
          },
          {
            id: 'shop',
            title: '购物',
            children: [
              {
                id: 'taobao',
                title: '淘宝',
                url: 'https://www.taobao.com'
              },
              {
                id: 'landsend',
                title: "Women's Crepe Fluid Blazer | Lands' End",
                url: 'https://www.landsend.com/item'
              }
            ]
          }
        ]
      }
    ]

    vi.mocked(bookmarkSearchService.searchWithMetadata).mockResolvedValue(
      ok({
        results: [
          makeSemanticResult(
            'aliyun',
            '开年焕新，限时特惠',
            'https://www.aliyun.com/minisite/goods',
            0.91
          ),
          makeSemanticResult('taobao', '淘宝', 'https://www.taobao.com', 0.84),
          makeSemanticResult('landsend', "Women's Crepe", 'https://www.landsend.com/item', 0.83),
          makeSemanticResult('b-extra-1', '其他 1', 'https://example.com/1', 0.82),
          makeSemanticResult('b-extra-2', '其他 2', 'https://example.com/2', 0.81)
        ],
        metadata: {
          duration: 1,
          totalCount: 5,
          cacheHit: false,
          strategy: 'hybrid',
          query: '阿里云'
        }
      })
    )

    const result = await searchManagementTrees({
      query: '阿里云',
      traitFilterIds: [],
      originalTree: noisyTree,
      proposalTree: noisyTree
    })

    expect(result.leftMatchCount).toBe(1)
    expect(result.rightMatchCount).toBe(1)
    expect(result.leftTree[0]?.children).toHaveLength(1)
    expect(result.leftTree[0]?.children?.[0]?.id).toBe('cloud')
    expect(result.leftTree[0]?.children?.[0]?.children).toHaveLength(1)
    expect(result.leftTree[0]?.children?.[0]?.children?.[0]?.id).toBe('aliyun')
    expect(result.leftTree[0]?.children?.[0]?.children?.[0]?.children).toBeUndefined()
  })

  it('pickSemanticSupplementIds 仅保留接近最高分的少量语义结果', () => {
    const ids = pickSemanticSupplementIds(
      [
        makeSemanticResult('aliyun', '开年焕新，限时特惠', 'https://www.aliyun.com', 0.91),
        makeSemanticResult('taobao', '淘宝', 'https://www.taobao.com', 0.84),
        makeSemanticResult('github', 'GitHub', 'https://github.com', 0.83)
      ],
      '阿里云'
    )

    expect(Array.from(ids)).toEqual(['aliyun'])
  })

  it('特征筛选仅作用于右侧提案树', async () => {
    const result = await searchManagementTrees({
      query: '',
      traitFilterIds: ['duplicate'],
      originalTree,
      proposalTree
    })

    expect(result.isLeftFiltered).toBe(false)
    expect(result.isRightFiltered).toBe(true)
    expect(result.leftMatchCount).toBe(0)
    expect(result.rightMatchCount).toBe(1)
    expect(result.rightTree).toHaveLength(1)
    expect(result.rightTree[0]?.id).toBe('b2')
  })
})
