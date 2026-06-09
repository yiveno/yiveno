/**
 * 整理页双树同步检索
 */

import { bookmarkSearchService } from '@/application/query/bookmark-search-service'
import type { EnhancedSearchResult } from '@/core/query-engine'
import { filterBookmarkNodes, recalculateChildrenCount } from '@/core/filter/bookmark-filter'
import { applyTraitFiltersToTree } from '@/core/filter/trait-tree-filter'
import { countBookmarkLeaves, pruneBookmarkTree } from '@/core/filter/tree-prune'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import type { BookmarkNode } from '@/types'

export interface ManagementTreeSearchInput {
  query: string
  traitFilterIds: string[]
  originalTree: BookmarkNode[]
  proposalTree: BookmarkNode[]
  limit?: number
}

export interface ManagementTreeSearchResult {
  leftTree: BookmarkNode[]
  rightTree: BookmarkNode[]
  leftMatchCount: number
  rightMatchCount: number
  isLeftFiltered: boolean
  isRightFiltered: boolean
}

/** 纯语义补充命中的最低分 */
const MANAGEMENT_SEMANTIC_MIN_SCORE = 0.5
/** 与最高语义分的差距上限（小库避免全员命中） */
const MANAGEMENT_SEMANTIC_SCORE_GAP = 0.06
/** 语义最多补充条数 */
const MANAGEMENT_SEMANTIC_MAX_EXTRA = 3

function bookmarkMatchesQueryText(bookmark: BookmarkRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return false

  const title = (bookmark.title ?? '').toLowerCase()
  const url = (bookmark.url ?? '').toLowerCase()
  const domain = (bookmark.domain ?? '').toLowerCase()
  const titleLower = (bookmark.titleLower ?? title).toLowerCase()
  const urlLower = (bookmark.urlLower ?? url).toLowerCase()

  return (
    title.includes(normalizedQuery) ||
    url.includes(normalizedQuery) ||
    domain.includes(normalizedQuery) ||
    titleLower.includes(normalizedQuery) ||
    urlLower.includes(normalizedQuery)
  )
}

/**
 * 判断 hybrid 命中是否应参与树裁剪（过滤低相关语义噪声）
 */
export function isRelevantManagementSearchHit(
  result: EnhancedSearchResult,
  query: string
): boolean {
  if (bookmarkMatchesQueryText(result.bookmark, query)) {
    return true
  }

  const matchedFields = result.matchedFields ?? []
  if (!matchedFields.includes('semantic')) {
    return false
  }

  return result.score >= MANAGEMENT_SEMANTIC_MIN_SCORE
}

/**
 * 从树形筛选结果收集书签叶子 ID（严格文本，禁用模糊）
 */
export function collectTextMatchIds(nodes: BookmarkNode[], query: string): Set<string> {
  const filtered = filterBookmarkNodes(nodes, query, {
    fuzzy: false,
    filterFolders: false
  })
  return collectBookmarkLeafIds(filtered)
}

/**
 * 从树形筛选结果收集书签叶子 ID
 */
export function collectBookmarkLeafIds(nodes: BookmarkNode[]): Set<string> {
  const ids = new Set<string>()

  const walk = (nodeList: BookmarkNode[]): void => {
    for (const node of nodeList) {
      if (node.url) {
        ids.add(String(node.id))
        continue
      }
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }

  walk(nodes)
  return ids
}

/**
 * 从 hybrid 结果中挑选少量高置信语义补充 ID（文本未命中时）
 */
export function pickSemanticSupplementIds(
  results: EnhancedSearchResult[],
  query: string
): Set<string> {
  const ids = new Set<string>()

  const semanticCandidates = results.filter(result => {
    if (bookmarkMatchesQueryText(result.bookmark, query)) {
      return false
    }
    return (result.matchedFields ?? []).includes('semantic')
  })

  if (semanticCandidates.length === 0) {
    return ids
  }

  semanticCandidates.sort((a, b) => b.score - a.score)
  const topScore = semanticCandidates[0]?.score ?? 0
  const scoreThreshold = Math.max(
    MANAGEMENT_SEMANTIC_MIN_SCORE,
    topScore - MANAGEMENT_SEMANTIC_SCORE_GAP
  )

  let added = 0
  for (const result of semanticCandidates) {
    if (result.score < scoreThreshold) {
      break
    }
    ids.add(String(result.bookmark.id))
    added += 1
    if (added >= MANAGEMENT_SEMANTIC_MAX_EXTRA) {
      break
    }
  }

  return ids
}

function collectStrictMatchIds(
  nodes: BookmarkNode[],
  query: string,
  hybridResults: EnhancedSearchResult[]
): Set<string> {
  const matchedIds = collectTextMatchIds(nodes, query)

  for (const result of hybridResults) {
    if (bookmarkMatchesQueryText(result.bookmark, query)) {
      matchedIds.add(String(result.bookmark.id))
    }
  }

  const semanticIds = pickSemanticSupplementIds(hybridResults, query)
  for (const id of semanticIds) {
    matchedIds.add(id)
  }

  return matchedIds
}

function cloneTreeSnapshot(nodes: BookmarkNode[]): BookmarkNode[] {
  return nodes.map(node => {
    const snapshot: BookmarkNode = { ...node }
    if (node.children?.length) {
      snapshot.children = cloneTreeSnapshot(node.children)
    } else if (!node.url) {
      snapshot.children = []
    }
    return snapshot
  })
}

function buildPrunedTree(
  nodes: BookmarkNode[],
  query: string,
  matchedIds: Set<string>
): BookmarkNode[] {
  if (matchedIds.size === 0) {
    return []
  }

  const pruned = pruneBookmarkTree(nodes, {
    matchedBookmarkIds: matchedIds,
    folderTitleQuery: query
  })

  return recalculateChildrenCount(cloneTreeSnapshot(pruned))
}

/**
 * 整理页检索：IndexedDB hybrid 命中 ID → 双树裁剪；特征筛选仅作用于右侧提案树
 */
export async function searchManagementTrees(
  input: ManagementTreeSearchInput
): Promise<ManagementTreeSearchResult> {
  const trimmedQuery = input.query.trim()
  const traitFilterIds = input.traitFilterIds
  const hasTextQuery = trimmedQuery.length > 0
  const hasTraitFilters = traitFilterIds.length > 0

  if (!hasTextQuery && !hasTraitFilters) {
    return {
      leftTree: input.originalTree,
      rightTree: input.proposalTree,
      leftMatchCount: 0,
      rightMatchCount: 0,
      isLeftFiltered: false,
      isRightFiltered: false
    }
  }

  let hybridResults: EnhancedSearchResult[] = []

  if (hasTextQuery) {
    const searchResult = await bookmarkSearchService.searchWithMetadata(trimmedQuery, {
      limit: input.limit ?? 500,
      highlight: false,
      useCache: false,
      minScore: MANAGEMENT_SEMANTIC_MIN_SCORE
    })

    if (searchResult.ok) {
      hybridResults = searchResult.value.results
    }
  }

  let leftTree = input.originalTree
  let rightTree = input.proposalTree
  let isLeftFiltered = false
  let isRightFiltered = false

  if (hasTextQuery) {
    const leftIds = collectStrictMatchIds(input.originalTree, trimmedQuery, hybridResults)
    const rightIds = collectStrictMatchIds(input.proposalTree, trimmedQuery, hybridResults)

    leftTree = buildPrunedTree(input.originalTree, trimmedQuery, leftIds)
    rightTree = buildPrunedTree(input.proposalTree, trimmedQuery, rightIds)
    isLeftFiltered = true
    isRightFiltered = true
  }

  if (hasTraitFilters) {
    rightTree = recalculateChildrenCount(applyTraitFiltersToTree(rightTree, traitFilterIds))
    isRightFiltered = true
  }

  return {
    leftTree,
    rightTree,
    leftMatchCount: isLeftFiltered ? countBookmarkLeaves(leftTree) : 0,
    rightMatchCount: isRightFiltered ? countBookmarkLeaves(rightTree) : 0,
    isLeftFiltered,
    isRightFiltered
  }
}
