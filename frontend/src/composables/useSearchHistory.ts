/**
 * 搜索历史记录 Composable
 * 
 * 功能：
 * - 保存搜索历史到 chrome.storage.local
 * - 获取最近的搜索历史
 * - 清空搜索历史
 * - 自动去重和限制数量
 */

import { ref, onMounted } from 'vue'
import { logger } from '@/infrastructure/logging/logger'

const STORAGE_KEY = 'acuity_search_history'
const MAX_HISTORY_SIZE = 20 // 最多保存 20 条历史记录

export interface SearchHistoryItem {
  /** 搜索关键词 */
  query: string
  /** 搜索时间戳 */
  timestamp: number
  /** 结果数量 */
  resultCount?: number | undefined
}

/**
 * 搜索历史记录 Hook
 */
export function useSearchHistory() {
  const history = ref<SearchHistoryItem[]>([])
  const isLoading = ref(false)

  /**
   * 加载搜索历史
   */
  const loadHistory = async (): Promise<void> => {
    try {
      isLoading.value = true
      
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY)
        const data = result[STORAGE_KEY]
        history.value = Array.isArray(data) ? data : []
      } else {
        // 兜底：使用 localStorage
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          history.value = Array.isArray(parsed) ? parsed : []
        } else {
          history.value = []
        }
      }
      
      logger.info('useSearchHistory', '搜索历史已加载', { count: history.value.length })
    } catch (error) {
      logger.error('useSearchHistory', '加载搜索历史失败', error)
      history.value = []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 保存搜索历史
   * @param query - 搜索关键词
   * @param resultCount - 结果数量（可选）
   */
  const addToHistory = async (query: string, resultCount?: number): Promise<void> => {
    try {
      // 过滤空查询
      const trimmedQuery = query.trim()
      if (!trimmedQuery) return

      // 去重：移除已存在的相同查询
      const filtered = history.value.filter(item => item.query !== trimmedQuery)

      // 添加新记录到开头
      const newItem: SearchHistoryItem = {
        query: trimmedQuery,
        timestamp: Date.now(),
        resultCount
      }
      
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_SIZE)
      history.value = updated

      // 保存到存储
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: updated })
      } else {
        // 兜底：使用 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }

      logger.info('useSearchHistory', '搜索历史已保存', { query: trimmedQuery, count: updated.length })
    } catch (error) {
      logger.error('useSearchHistory', '保存搜索历史失败', error)
    }
  }

  /**
   * 删除单条历史记录
   * @param query - 要删除的搜索关键词
   */
  const removeFromHistory = async (query: string): Promise<void> => {
    try {
      const updated = history.value.filter(item => item.query !== query)
      history.value = updated

      // 保存到存储
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: updated })
      } else {
        // 兜底：使用 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }

      logger.info('useSearchHistory', '历史记录已删除', { query })
    } catch (error) {
      logger.error('useSearchHistory', '删除历史记录失败', error)
    }
  }

  /**
   * 清空所有搜索历史
   */
  const clearHistory = async (): Promise<void> => {
    try {
      history.value = []

      // 清空存储
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove(STORAGE_KEY)
      } else {
        // 兜底：使用 localStorage
        localStorage.removeItem(STORAGE_KEY)
      }

      logger.info('useSearchHistory', '搜索历史已清空')
    } catch (error) {
      logger.error('useSearchHistory', '清空搜索历史失败', error)
    }
  }

  /**
   * 获取最近的 N 条历史记录
   * @param limit - 数量限制
   */
  const getRecentHistory = (limit = 10): SearchHistoryItem[] => {
    return history.value.slice(0, limit)
  }

  /**
   * 搜索历史记录（模糊匹配）
   * @param keyword - 搜索关键词
   */
  const searchHistory = (keyword: string): SearchHistoryItem[] => {
    if (!keyword.trim()) return history.value

    const lowerKeyword = keyword.toLowerCase()
    return history.value.filter(item => 
      item.query.toLowerCase().includes(lowerKeyword)
    )
  }

  // 组件挂载时自动加载历史
  onMounted(() => {
    loadHistory()
  })

  return {
    history,
    isLoading,
    loadHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentHistory,
    searchHistory
  }
}
