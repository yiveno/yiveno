/**
 * 书签筛选核心函数（纯函数）
 *
 * 数据源无关的筛选逻辑：
 * - 可以筛选 IndexedDB 数据
 * - 可以筛选内存数据
 * - 可以筛选 LLM 返回的数据
 *
 * @module core/filter/bookmark-filter
 */

import type { BookmarkNode } from '@/types'

/**
 * 筛选选项
 */
export interface BookmarkFilterOptions {
  /** 是否启用模糊匹配 */
  fuzzy?: boolean

  /** 匹配阈值 (0-1) */
  threshold?: number

  /** 是否过滤文件夹（仅返回书签） */
  filterFolders?: boolean

  /** 是否区分大小写 */
  caseSensitive?: boolean

  /** 最大结果数量限制 */
  limit?: number

  /** 匹配字段 */
  fields?: Array<'title' | 'url' | 'domain' | 'tags'>
}

/**
 * 筛选结果
 */
export interface FilteredBookmarkNode extends BookmarkNode {
  /** 匹配的字段列表 */
  matchedFields?: string[]

  /** 匹配分数 (0-1) */
  filterScore?: number
}

/**
 * 筛选书签节点（纯函数）
 *
 * @param nodes - 书签节点数组
 * @param query - 筛选条件（关键字）
 * @param options - 筛选选项
 * @returns 符合条件的书签节点
 *
 * @example
 * ```typescript
 * const filtered = filterBookmarkNodes(allNodes, 'React', {
 *   fuzzy: true,
 *   filterFolders: true
 * })
 * ```
 */
export function filterBookmarkNodes(
  nodes: BookmarkNode[],
  query: string,
  options: BookmarkFilterOptions = {}
): FilteredBookmarkNode[] {
  const {
    fuzzy = false,
    threshold = 0.6,
    filterFolders = false,
    caseSensitive = false,
    limit,
    fields = ['title', 'url', 'domain', 'tags']
  } = options

  // 空查询，返回所有节点
  if (!query || !query.trim()) {
    return nodes.slice(0, limit)
  }

  const trimmedQuery = query.trim()
  const lowerQuery = caseSensitive ? trimmedQuery : trimmedQuery.toLowerCase()

  // 检查是否是标签查询
  const isTagQuery = lowerQuery.startsWith('tag:') || lowerQuery.startsWith('#')
  const tagTerm = isTagQuery
    ? lowerQuery
        .replace(/^tag:\s*/i, '')
        .replace(/^#/, '')
        .trim()
    : ''

  /**
   * 匹配单个节点
   */
  function matchNode(node: BookmarkNode): {
    matched: boolean
    matchedFields: string[]
    score: number
  } {
    const matchedFields: string[] = []
    let score = 0

    // 如果是文件夹且 filterFolders=true，跳过
    if (filterFolders && !node.url) {
      return { matched: false, matchedFields, score: 0 }
    }

    // 获取要匹配的字段值
    const title = caseSensitive
      ? node.title || ''
      : (node.title || '').toLowerCase()
    const url = caseSensitive ? node.url || '' : (node.url || '').toLowerCase()
    const domain = caseSensitive
      ? node.domain || ''
      : (node.domain || '').toLowerCase()
    const tags = (node.tags || []).map(t =>
      caseSensitive ? t : t.toLowerCase()
    )

    // 标签查询
    if (isTagQuery) {
      const hasTagMatch = tags.some(t => t.includes(tagTerm))
      if (hasTagMatch) {
        matchedFields.push('tags')
        score = 1.0
      }
      return { matched: hasTagMatch, matchedFields, score }
    }

    // 普通查询：检查各个字段
    if (fields.includes('title') && title.includes(lowerQuery)) {
      matchedFields.push('title')
      score = Math.max(score, 0.9) // 标题匹配权重最高
    }

    if (fields.includes('url') && url.includes(lowerQuery)) {
      matchedFields.push('url')
      score = Math.max(score, 0.7)
    }

    if (fields.includes('domain') && domain.includes(lowerQuery)) {
      matchedFields.push('domain')
      score = Math.max(score, 0.6)
    }

    if (fields.includes('tags')) {
      const hasTagMatch = tags.some(t => t.includes(lowerQuery))
      if (hasTagMatch) {
        matchedFields.push('tags')
        score = Math.max(score, 0.8) // 标签匹配权重较高
      }
    }

    // 模糊匹配逻辑（简化版）
    if (fuzzy && matchedFields.length === 0) {
      const fuzzyScore = calculateFuzzyScore(title, lowerQuery)
      if (fuzzyScore >= threshold) {
        matchedFields.push('title')
        score = fuzzyScore
      }
    }

    return {
      matched: matchedFields.length > 0,
      matchedFields,
      score
    }
  }

  /**
   * 递归筛选节点
   */
  function filterRecursive(nodeList: BookmarkNode[]): FilteredBookmarkNode[] {
    const results: FilteredBookmarkNode[] = []

    for (const node of nodeList) {
      const { matched, matchedFields, score } = matchNode(node)

      // 递归处理子节点
      const childMatches = node.children ? filterRecursive(node.children) : []

      // 如果节点匹配或有子节点匹配，则包含此节点
      if (matched || childMatches.length > 0) {
        const resultNode: FilteredBookmarkNode = {
          ...node
        }
        
        if (matched) {
          resultNode.matchedFields = matchedFields
          resultNode.filterScore = score
        }
        
        if (childMatches.length > 0) {
          resultNode.children = childMatches
        } else if (!node.url) {
          resultNode.children = []
        }
        
        results.push(resultNode)
      }
    }

    return results
  }

  // 执行筛选
  let filtered = filterRecursive(nodes)

  // 按分数排序（如果有分数）
  filtered = filtered.sort((a, b) => {
    const scoreA = a.filterScore ?? 0
    const scoreB = b.filterScore ?? 0
    return scoreB - scoreA
  })

  // 限制结果数量
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit)
  }

  return filtered
}

/**
 * 计算模糊匹配分数（简化版）
 *
 * @param text - 待匹配文本
 * @param query - 查询字符串
 * @returns 匹配分数 (0-1)
 */
function calculateFuzzyScore(text: string, query: string): number {
  if (!text || !query) return 0

  // 简化的模糊匹配算法
  let score = 0
  let queryIndex = 0

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      score += 1
      queryIndex++
    }
  }

  // 所有查询字符都匹配到
  if (queryIndex === query.length) {
    return score / text.length
  }

  return 0
}

/**
 * 扁平化筛选结果（去除树结构）
 *
 * @param nodes - 筛选后的树形节点
 * @returns 扁平化的节点数组
 */
export function flattenFilterResults(
  nodes: FilteredBookmarkNode[]
): FilteredBookmarkNode[] {
  const results: FilteredBookmarkNode[] = []

  function traverse(nodeList: FilteredBookmarkNode[]) {
    for (const node of nodeList) {
      // 只添加实际匹配的节点（不包括为了保留层级的父节点）
      if (node.matchedFields && node.matchedFields.length > 0) {
        results.push(node)
      }

      if (node.children && node.children.length > 0) {
        traverse(node.children as FilteredBookmarkNode[])
      }
    }
  }

  traverse(nodes)
  return results
}

/**
 * 高亮匹配文本
 *
 * @param text - 原始文本
 * @param query - 查询字符串
 * @param caseSensitive - 是否区分大小写
 * @returns 带高亮标记的文本段落
 */
export function highlightMatches(
  text: string,
  query: string,
  caseSensitive = false
): Array<{ text: string; highlighted: boolean }> {
  if (!text || !query) {
    return [{ text, highlighted: false }]
  }

  const lowerText = caseSensitive ? text : text.toLowerCase()
  const lowerQuery = caseSensitive ? query : query.toLowerCase()

  const segments: Array<{ text: string; highlighted: boolean }> = []
  let lastIndex = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index !== -1) {
    // 添加非高亮部分
    if (index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, index),
        highlighted: false
      })
    }

    // 添加高亮部分
    segments.push({
      text: text.substring(index, index + query.length),
      highlighted: true
    })

    lastIndex = index + query.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  // 添加剩余部分
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      highlighted: false
    })
  }

  return segments
}

/**
 * 重新计算筛选结果中每个节点的 childrenCount
 *
 * 筛选后的树结构中，文件夹的 children 已经被过滤，
 * 但 childrenCount 还是原始的完整树的数量，需要重新计算
 *
 * @param nodes - 筛选后的树形节点
 * @returns 更新了 childrenCount 的节点
 */
export function recalculateChildrenCount(
  nodes: FilteredBookmarkNode[]
): FilteredBookmarkNode[] {
  function updateNode(node: FilteredBookmarkNode): FilteredBookmarkNode {
    // 如果是书签（有 url），直接返回
    if (node.url) {
      return node
    }

    // 如果是文件夹，递归处理子节点
    const updatedChildren = node.children
      ? node.children.map(child => updateNode(child as FilteredBookmarkNode))
      : []

    // 重新计算 childrenCount（基于筛选后的 children）
    return {
      ...node,
      children: updatedChildren,
      childrenCount: updatedChildren.length
    }
  }

  return nodes.map(node => updateNode(node))
}
