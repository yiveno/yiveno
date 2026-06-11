/**
 * 筛选功能 Store
 * 负责书签筛选、筛选统计等功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

export interface SearchResult {
  id?: string
  title: string
  url: string
  path: string
  score: number
  matchedFields: string[]
}

export interface SearchStatistics {
  totalSearches: number
  averageResultCount: number
  mostSearchedTerms: string[]
  searchPerformance: {
    averageTime: number
    totalTime: number
  }
}

/**
 * Local Storage 键位常量（持久化用户设置）
 */
const LOCAL_KEYS = {
  SEARCH_SETTINGS: 'search_settings'
} as const

export const useQueryStore = defineStore('query', () => {
  // === 搜索状态 ===
  const searchQuery = ref('')
  const searchResults = ref<SearchResult[]>([])
  const isSearching = ref(false)
  const searchProgress = ref(0)
  const hasSearchResults = ref(false)
  const searchError = ref<string | null>(null)

  // === 搜索统计 ===
  const searchStatistics = ref<SearchStatistics>({
    totalSearches: 0,
    averageResultCount: 0,
    mostSearchedTerms: [],
    searchPerformance: {
      averageTime: 0,
      totalTime: 0
    }
  })

  // === 搜索设置（从 chrome.storage.local 加载） ===
  const defaultSearchSettings = {
    caseSensitive: false,
    includeUrl: true,
    includeTitle: true,
    includePath: true,
    maxResults: 100,
    fuzzySearch: true,
    highlightMatches: true
  }

  const searchSettings = ref({ ...defaultSearchSettings })

  const loadSearchSettings = async () => {
    try {
      const settings = await chromeStorage.getLocal<typeof defaultSearchSettings>(
        LOCAL_KEYS.SEARCH_SETTINGS,
        defaultSearchSettings
      )
      searchSettings.value = { ...defaultSearchSettings, ...(settings ?? {}) }
      logger.debug('QueryStore', '✅ 搜索设置已从 local storage 恢复', settings)
    } catch (error) {
      logger.error('QueryStore', '加载搜索设置失败', error)
      searchSettings.value = { ...defaultSearchSettings }
    }
  }

  loadSearchSettings().catch(err => {
    logger.warn('QueryStore', '搜索设置初始化失败', err)
  })

  const saveSearchSettings = async () => {
    try {
      await chromeStorage.setLocal(LOCAL_KEYS.SEARCH_SETTINGS, searchSettings.value)
      logger.debug('QueryStore', '搜索设置已保存', searchSettings.value)
    } catch (error) {
      logger.warn('QueryStore', '保存搜索设置失败', error)
    }
  }

  const searchPerformance = computed(() => {
    return {
      isSearching: isSearching.value,
      progress: searchProgress.value,
      hasResults: hasSearchResults.value,
      resultCount: searchResults.value.length
    }
  })

  const search = async (query: string) => {
    try {
      if (!query.trim()) {
        searchResults.value = []
        hasSearchResults.value = false
        return
      }

      isSearching.value = true
      searchProgress.value = 0
      searchError.value = null
      searchQuery.value = query

      const startTime = performance.now()

      const results: SearchResult[] = [
        {
          id: '1',
          title: `搜索结果: ${query}`,
          url: 'https://example.com',
          path: '示例路径',
          score: 0.95,
          matchedFields: ['title']
        }
      ]

      const endTime = performance.now()

      searchResults.value = results
      hasSearchResults.value = results.length > 0
      isSearching.value = false
      searchProgress.value = 100

      updateSearchStatistics(endTime - startTime, results.length, query)

      logger.info('Search', '搜索完成', {
        query,
        resultCount: results.length,
        searchTime: `${(endTime - startTime).toFixed(2)}ms`
      })
    } catch (error) {
      isSearching.value = false
      searchError.value = error instanceof Error ? error.message : '搜索失败'
      logger.error('Search', '搜索失败', error)
      throw error
    }
  }

  const quickSearch = async (query: string) => {
    try {
      if (!query.trim()) {
        searchResults.value = []
        hasSearchResults.value = false
        return
      }

      const results: SearchResult[] = [
        {
          id: '1',
          title: `快速搜索: ${query}`,
          url: 'https://example.com',
          path: '示例路径',
          score: 0.9,
          matchedFields: ['title']
        }
      ]

      searchResults.value = results
      hasSearchResults.value = results.length > 0
      searchQuery.value = query

      logger.info('Search', '快速搜索完成', {
        query,
        resultCount: results.length
      })
    } catch (error) {
      logger.error('Search', '快速搜索失败', error)
      throw error
    }
  }

  const clearSearchResults = () => {
    searchResults.value = []
    hasSearchResults.value = false
    searchQuery.value = ''
    searchError.value = null
    logger.info('Search', '搜索结果已清空')
  }

  const updateSearchStatistics = (searchTime: number, resultCount: number, query: string) => {
    const stats = searchStatistics.value
    stats.totalSearches++
    stats.searchPerformance.totalTime += searchTime
    stats.searchPerformance.averageTime = stats.searchPerformance.totalTime / stats.totalSearches
    stats.averageResultCount =
      (stats.averageResultCount * (stats.totalSearches - 1) + resultCount) / stats.totalSearches

    const term = query.toLowerCase().trim()
    if (term && !stats.mostSearchedTerms.includes(term)) {
      stats.mostSearchedTerms = [term, ...stats.mostSearchedTerms].slice(0, 10)
    }
  }

  const updateSearchSettings = (settings: Partial<typeof searchSettings.value>) => {
    searchSettings.value = { ...searchSettings.value, ...settings }
    logger.info('Search', '搜索设置已更新', settings)
    saveSearchSettings().catch(err => {
      logger.warn('QueryStore', '保存搜索设置失败', err)
    })
  }

  const getSearchStatistics = () => {
    return { ...searchStatistics.value }
  }

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchProgress,
    hasSearchResults,
    searchError,
    searchStatistics,
    searchSettings,
    searchPerformance,
    search,
    quickSearch,
    clearSearchResults,
    updateSearchSettings,
    getSearchStatistics
  }
})
