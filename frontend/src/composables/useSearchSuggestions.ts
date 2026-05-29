/**
 * 搜索建议 Composable
 *
 * 功能：
 * - 基于书签标题和 URL 生成搜索建议
 * - 支持模糊匹配
 * - 自动去重和排序
 */

import { ref, computed } from 'vue'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'

export interface SearchSuggestion {
  /** 建议文本 */
  text: string
  /** 建议类型 */
  type: 'title' | 'url' | 'tag' | 'folder'
  /** 匹配的书签（可选） */
  bookmark?: BookmarkRecord
  /** 匹配度分数（用于排序） */
  score: number
}

/**
 * 搜索建议 Hook
 */
export function useSearchSuggestions() {
  const suggestions = ref<SearchSuggestion[]>([])
  const isLoading = ref(false)

  /**
   * 生成搜索建议
   * @param query - 搜索关键词
   * @param limit - 建议数量限制
   */
  const generateSuggestions = async (query: string, limit = 10): Promise<SearchSuggestion[]> => {
    try {
      isLoading.value = true

      // 过滤空查询
      const trimmedQuery = query.trim().toLowerCase()
      if (!trimmedQuery || trimmedQuery.length < 2) {
        suggestions.value = []
        return []
      }

      // 从 IndexedDB 获取所有书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 生成建议
      const suggestionMap = new Map<string, SearchSuggestion>()

      // 辅助函数：添加建议到 map
      const addSuggestion = (
        key: string,
        text: string,
        type: 'title' | 'url' | 'tag',
        bookmark: BookmarkRecord
      ) => {
        if (!suggestionMap.has(key)) {
          suggestionMap.set(key, {
            text,
            type,
            bookmark,
            score: calculateScore(text, trimmedQuery, type)
          })
        }
      }

      // 辅助函数：处理标签匹配
      const processTags = (bookmark: BookmarkRecord) => {
        if (!bookmark.tags || !Array.isArray(bookmark.tags)) return
        for (const tag of bookmark.tags) {
          if (tag.toLowerCase().includes(trimmedQuery)) {
            addSuggestion(`tag:${tag}`, tag, 'tag', bookmark)
          }
        }
      }

      for (const bookmark of allBookmarks) {
        // 跳过文件夹
        if (!bookmark.url) continue

        // 标题匹配
        if (bookmark.title && bookmark.title.toLowerCase().includes(trimmedQuery)) {
          addSuggestion(`title:${bookmark.title}`, bookmark.title, 'title', bookmark)
        }

        // URL 匹配
        if (bookmark.url && bookmark.url.toLowerCase().includes(trimmedQuery)) {
          addSuggestion(`url:${bookmark.url}`, bookmark.url, 'url', bookmark)
        }

        // 标签匹配
        processTags(bookmark)
      }

      // 转换为数组并排序
      const result = Array.from(suggestionMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      suggestions.value = result
      return result
    } catch (error) {
      logger.error('useSearchSuggestions', '生成搜索建议失败', error)
      suggestions.value = []
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 计算匹配分数
   * @param text - 文本
   * @param query - 查询关键词
   * @param type - 类型
   */
  const calculateScore = (
    text: string,
    query: string,
    type: 'title' | 'url' | 'tag' | 'folder'
  ): number => {
    const lowerText = text.toLowerCase()
    const lowerQuery = query.toLowerCase()

    let score = 0

    // 完全匹配：最高分
    if (lowerText === lowerQuery) {
      score += 100
    }

    // 开头匹配：高分
    if (lowerText.startsWith(lowerQuery)) {
      score += 50
    }

    // 包含匹配：基础分
    if (lowerText.includes(lowerQuery)) {
      score += 20
    }

    // 类型权重
    switch (type) {
      case 'title':
        score += 10 // 标题优先
        break
      case 'tag':
        score += 5 // 标签次之
        break
      case 'url':
        score += 2 // URL 最后
        break
      case 'folder':
        score += 3
        break
    }

    // 长度惩罚：越短越好
    score -= text.length * 0.1

    return score
  }

  /**
   * 清空建议
   */
  const clearSuggestions = (): void => {
    suggestions.value = []
  }

  /**
   * 获取建议数量
   */
  const suggestionCount = computed(() => suggestions.value.length)

  /**
   * 是否有建议
   */
  const hasSuggestions = computed(() => suggestions.value.length > 0)

  return {
    suggestions,
    isLoading,
    suggestionCount,
    hasSuggestions,
    generateSuggestions,
    clearSuggestions
  }
}
